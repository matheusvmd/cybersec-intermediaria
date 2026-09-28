"use strict";

(function exposePrivacyUtils(root, factory) {
  const privacyUtils = factory();

  root.PrivacyUtils = privacyUtils;

  if (typeof module === "object" && module.exports) {
    module.exports = privacyUtils;
  }
})(typeof globalThis === "object" ? globalThis : this, () => {
  const IDENTIFIER_PARAMETER_NAMES = new Set([
    "id",
    "uid",
    "user_id",
    "userid",
    "cid",
    "client_id",
    "visitor",
    "token",
    "sync",
    "partner_id",
  ]);
  const COMMON_IDENTIFIER_VALUES = new Set([
    "0",
    "1",
    "true",
    "false",
    "null",
    "undefined",
    "yes",
    "no",
    "on",
    "off",
    "anonymous",
    "guest",
    "default",
    "unknown",
  ]);
  const COMMON_PARAMETER_NAMES = new Set([
    "q",
    "query",
    "search",
    "page",
    "lang",
    "locale",
    "ref",
    "source",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ]);

  function normalizeHostname(hostname) {
    return String(hostname || "")
      .trim()
      .toLowerCase()
      .replace(/^\./, "")
      .replace(/\.$/, "");
  }

  function isIpAddress(hostname) {
    const normalized = normalizeHostname(hostname).replace(/^\[|\]$/g, "");

    if (normalized.includes(":")) {
      return true;
    }

    const parts = normalized.split(".");
    return (
      parts.length === 4 &&
      parts.every(
        (part) => /^\d{1,3}$/.test(part) && Number(part) <= 255
      )
    );
  }

  function fallbackRegistrableDomain(hostname) {
    const normalized = normalizeHostname(hostname);

    if (!normalized || normalized === "localhost" || isIpAddress(normalized)) {
      return normalized;
    }

    const labels = normalized.split(".");
    return labels.length > 2 ? labels.slice(-2).join(".") : normalized;
  }

  function getRegistrableDomain(hostname, publicSuffixApi) {
    const normalized = normalizeHostname(hostname);

    if (!normalized || normalized === "localhost" || isIpAddress(normalized)) {
      return normalized;
    }

    try {
      if (publicSuffixApi && typeof publicSuffixApi.getDomain === "function") {
        const domain = publicSuffixApi.getDomain(normalized);
        if (domain) {
          return normalizeHostname(domain);
        }
      }
    } catch (_error) {
      // O fallback mantém a classificação disponível sem a API do Firefox.
    }

    return fallbackRegistrableDomain(normalized);
  }

  function classifyDomain(pageHostname, resourceHostname, publicSuffixApi) {
    const pageDomain = getRegistrableDomain(pageHostname, publicSuffixApi);
    const resourceDomain = getRegistrableDomain(
      resourceHostname,
      publicSuffixApi
    );

    return {
      pageDomain,
      resourceDomain,
      isThirdParty: Boolean(
        pageDomain && resourceDomain && pageDomain !== resourceDomain
      ),
    };
  }

  function classifyCookie(cookie, pageHostname, publicSuffixApi) {
    const cookieHostname = normalizeHostname(cookie && cookie.domain);
    const classification = classifyDomain(
      pageHostname,
      cookieHostname,
      publicSuffixApi
    );

    return {
      domain: cookieHostname,
      registrableDomain: classification.resourceDomain,
      isThirdParty: classification.isThirdParty,
      isSession: Boolean(cookie && cookie.session),
    };
  }

  function cookieKey(cookie) {
    const partitionKey = cookie && cookie.partitionKey;
    const partition = partitionKey
      ? JSON.stringify(partitionKey)
      : String((cookie && cookie.firstPartyDomain) || "");

    return [
      String((cookie && cookie.storeId) || ""),
      normalizeHostname(cookie && cookie.domain),
      String((cookie && cookie.path) || "/"),
      String((cookie && cookie.name) || ""),
      partition,
    ].join("\n");
  }

  function normalizeParameterName(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_")
      .replace(/\[\]$/, "");
  }

  function hasIdentifierShape(value, minimumLength) {
    const normalized = String(value || "").trim();

    if (
      normalized.length < minimumLength ||
      normalized.length > 2048 ||
      COMMON_IDENTIFIER_VALUES.has(normalized.toLowerCase()) ||
      /\s/.test(normalized) ||
      /^(?:https?|ftp):\/\//i.test(normalized)
    ) {
      return false;
    }

    return new Set(normalized.toLowerCase()).size >= 4;
  }

  function classifyIdentifierParameter(name, value) {
    const parameterName = normalizeParameterName(name);
    const knownName = IDENTIFIER_PARAMETER_NAMES.has(parameterName);

    if (knownName && hasIdentifierShape(value, 6)) {
      return {
        isCandidate: true,
        parameterName,
        rule: "nome identificador conhecido",
      };
    }

    if (
      !COMMON_PARAMETER_NAMES.has(parameterName) &&
      hasIdentifierShape(value, 16)
    ) {
      return {
        isCandidate: true,
        parameterName,
        rule: "valor longo com aparência de identificador",
      };
    }

    return {
      isCandidate: false,
      parameterName,
      rule: "",
    };
  }

  function redactIdentifierParameters(url) {
    try {
      const parsedUrl = new URL(url);
      const redactedParameters = new URLSearchParams();

      parsedUrl.searchParams.forEach((value, name) => {
        const replacement = classifyIdentifierParameter(name, value)
          .isCandidate
          ? "[identificador omitido]"
          : value;
        redactedParameters.append(name, replacement);
      });

      parsedUrl.search = redactedParameters.toString();
      return parsedUrl.href;
    } catch (_error) {
      return String(url || "");
    }
  }

  function findIdentifierSharing(occurrences) {
    const byHash = new Map();

    (Array.isArray(occurrences) ? occurrences : []).forEach((occurrence) => {
      if (!occurrence || !occurrence.hash || !occurrence.domain) {
        return;
      }

      const grouped = byHash.get(occurrence.hash) || [];
      grouped.push(occurrence);
      byHash.set(occurrence.hash, grouped);
    });

    const detections = [];
    byHash.forEach((group, hash) => {
      const queryOccurrences = group.filter(
        (occurrence) => occurrence.source === "query"
      );
      const cookieOccurrences = group.filter(
        (occurrence) => occurrence.source === "cookie"
      );
      const queryDomains = [
        ...new Set(queryOccurrences.map((occurrence) => occurrence.domain)),
      ];
      const allDomains = [
        ...new Set(group.map((occurrence) => occurrence.domain)),
      ].sort();
      const parameterTypes = [
        ...new Set(
          queryOccurrences.map(
            (occurrence) => occurrence.parameterName || occurrence.rule
          )
        ),
      ].filter(Boolean);

      if (queryDomains.length >= 2) {
        detections.push({
          hash,
          rule: "mesmo hash em domínios terceiros diferentes",
          domains: allDomains,
          parameterTypes,
        });
      }

      if (queryOccurrences.length > 0 && cookieOccurrences.length > 0) {
        detections.push({
          hash,
          rule: "mesmo hash em cookie e parâmetro de URL",
          domains: allDomains,
          parameterTypes,
        });
      }
    });

    return detections;
  }

  function detectBounceTracking(redirects, maximumIntervalMs = 3000) {
    const entries = Array.isArray(redirects) ? redirects : [];
    const detections = [];

    for (let index = 0; index < entries.length - 1; index += 1) {
      const incoming = entries[index];
      const outgoing = entries[index + 1];
      const interval = outgoing.timestamp - incoming.timestamp;
      const sameIntermediate =
        incoming.toDomain && incoming.toDomain === outgoing.fromDomain;
      const distinctIntermediate =
        incoming.toDomain !== incoming.fromDomain &&
        incoming.toDomain !== outgoing.toDomain;

      if (
        incoming.automatic &&
        outgoing.automatic &&
        sameIntermediate &&
        distinctIntermediate &&
        interval >= 0 &&
        interval <= maximumIntervalMs
      ) {
        detections.push({
          intermediateDomain: incoming.toDomain,
          intervalMs: interval,
          redirectIndexes: [index, index + 1],
          justification:
            "domínio intermediário distinto redirecionou automaticamente em curto intervalo",
        });
      }
    }

    return detections;
  }

  function detectPersistentPolling(events, options = {}) {
    const minimumCalls = Number.isInteger(options.minimumCalls)
      ? options.minimumCalls
      : 4;
    const minimumIntervalMs = Number.isFinite(options.minimumIntervalMs)
      ? options.minimumIntervalMs
      : 250;
    const maximumIntervalMs = Number.isFinite(options.maximumIntervalMs)
      ? options.maximumIntervalMs
      : 60000;
    const maximumDeviationRatio = Number.isFinite(options.maximumDeviationRatio)
      ? options.maximumDeviationRatio
      : 0.35;
    const sorted = (Array.isArray(events) ? events : [])
      .filter((event) => event && Number.isFinite(event.timestamp))
      .slice()
      .sort((left, right) => left.timestamp - right.timestamp);

    if (sorted.length < minimumCalls) {
      return { detected: false, callCount: sorted.length, intervals: [] };
    }

    const recent = sorted.slice(-minimumCalls);
    const intervals = recent
      .slice(1)
      .map((event, index) => event.timestamp - recent[index].timestamp);
    const averageIntervalMs =
      intervals.reduce((total, interval) => total + interval, 0) /
      intervals.length;
    const maximumDeviation = Math.max(
      ...intervals.map((interval) => Math.abs(interval - averageIntervalMs))
    );
    const regular =
      averageIntervalMs > 0 &&
      maximumDeviation / averageIntervalMs <= maximumDeviationRatio;
    const intervalInRange = intervals.every(
      (interval) =>
        interval >= minimumIntervalMs && interval <= maximumIntervalMs
    );

    return {
      detected: regular && intervalInRange,
      callCount: sorted.length,
      intervals,
      averageIntervalMs: Math.round(averageIntervalMs),
      justification:
        regular && intervalInRange
          ? `${minimumCalls} chamadas recentes ao mesmo endpoint com intervalo regular`
          : "repetição insuficiente ou intervalos irregulares",
    };
  }

  function normalizeBlockDomain(input) {
    const value = String(input || "").trim().toLowerCase();
    if (!value) {
      return "";
    }

    try {
      const withScheme = value.includes("://") ? value : `https://${value}`;
      return normalizeHostname(new URL(withScheme).hostname);
    } catch (_error) {
      return "";
    }
  }

  function matchesBlockDomain(hostname, blockedDomain) {
    const normalizedHostname = normalizeHostname(hostname);
    const normalizedBlocked = normalizeBlockDomain(blockedDomain);
    return Boolean(
      normalizedHostname &&
        normalizedBlocked &&
        (normalizedHostname === normalizedBlocked ||
          normalizedHostname.endsWith(`.${normalizedBlocked}`))
    );
  }

  function calculatePrivacyScore(report = {}) {
    const cookies = report.cookies || {};
    const rawCookieRecords = [
      ...(Array.isArray(cookies.preexisting) ? cookies.preexisting : []),
      ...(Array.isArray(cookies.changed) ? cookies.changed : []),
    ];
    const cookiesByKey = new Map();
    rawCookieRecords.forEach((cookie, index) => {
      const identity = cookie
        ? [cookie.storeId, cookie.domain, cookie.path, cookie.name]
        : [];
      const key = identity.some((part) => part !== undefined && part !== null)
        ? identity.join("\n")
        : `registro-${index}`;
      cookiesByKey.set(key, cookie);
    });
    const cookieRecords = [...cookiesByKey.values()];
    const storageReports = Array.isArray(report.storage) ? report.storage : [];
    const hijacking = report.hijacking || {};
    const thirdPartyCount = Array.isArray(report.thirdPartyDomains)
      ? new Set(report.thirdPartyDomains).size
      : 0;

    const category = (key, label, maximum, rawDiscount, reasons) => ({
      key,
      label,
      maximum,
      discount: Math.min(maximum, Math.max(0, rawDiscount)),
      reasons: reasons.filter(Boolean),
    });

    const thirdPartyDiscount = thirdPartyCount * 2;
    const thirdPartyCookies = cookieRecords.filter(
      (cookie) => cookie && cookie.isThirdParty
    );
    const thirdPartyPersistent = thirdPartyCookies.filter(
      (cookie) => !cookie.isSession
    ).length;
    const thirdPartySession = thirdPartyCookies.filter(
      (cookie) => cookie.isSession
    ).length;
    const firstPartyPersistent = cookieRecords.filter(
      (cookie) => cookie && !cookie.isThirdParty && !cookie.isSession
    ).length;
    const cookieDiscount =
      thirdPartyPersistent * 3 +
      thirdPartySession * 2 +
      firstPartyPersistent;

    const storageByOrigin = new Map();
    storageReports.forEach((storage) => {
      const origin = String(storage?.origin || "origem desconhecida");
      const usage = storageByOrigin.get(origin) || {
        localStorage: false,
        sessionStorage: false,
        indexedDB: false,
      };
      if (storage?.localStorage?.keyCount > 0) {
        usage.localStorage = true;
      }
      if (storage?.sessionStorage?.keyCount > 0) {
        usage.sessionStorage = true;
      }
      if (storage?.indexedDB?.databases?.length > 0) {
        usage.indexedDB = true;
      }
      storageByOrigin.set(origin, usage);
    });
    const storageUsage = [...storageByOrigin.values()];
    const localStorageOrigins = storageUsage.filter(
      (usage) => usage.localStorage
    ).length;
    const sessionStorageOrigins = storageUsage.filter(
      (usage) => usage.sessionStorage
    ).length;
    const indexedDbOrigins = storageUsage.filter(
      (usage) => usage.indexedDB
    ).length;
    const storageDiscount =
      localStorageOrigins * 2 +
      sessionStorageOrigins +
      indexedDbOrigins * 3;
    const canvasDetected = Boolean(report.canvas?.detected);
    const bounceDetected = Boolean(report.bounceTracking?.detected);
    const syncDetected = Boolean(report.identifierSharing?.detected);
    const hookCount = Array.isArray(hijacking.hookReplacements)
      ? hijacking.hookReplacements.length
      : 0;
    const websocketCount = Array.isArray(hijacking.thirdPartyWebSockets)
      ? hijacking.thirdPartyWebSockets.length
      : 0;
    const pollingCount = Array.isArray(hijacking.polling)
      ? hijacking.polling.filter((item) => item.detected).length
      : 0;

    const categories = [
      category(
        "third_parties",
        "Domínios de terceira parte",
        20,
        thirdPartyDiscount,
        [thirdPartyCount && `${thirdPartyCount} domínio(s) × 2 pontos`]
      ),
      category("cookies", "Cookies", 20, cookieDiscount, [
        thirdPartyPersistent &&
          `${thirdPartyPersistent} cookie(s) persistente(s) de terceiro × 3`,
        thirdPartySession &&
          `${thirdPartySession} cookie(s) de sessão de terceiro × 2`,
        firstPartyPersistent &&
          `${firstPartyPersistent} cookie(s) persistente(s) de primeira parte × 1`,
      ]),
      category("storage", "Armazenamento HTML5", 10, storageDiscount, [
        localStorageOrigins && `${localStorageOrigins} origem(ns) com localStorage × 2`,
        sessionStorageOrigins &&
          `${sessionStorageOrigins} origem(ns) com sessionStorage × 1`,
        indexedDbOrigins && `${indexedDbOrigins} origem(ns) com IndexedDB × 3`,
      ]),
      category(
        "fingerprinting",
        "Canvas fingerprinting",
        20,
        canvasDetected ? 20 : 0,
        [canvasDetected && "leitura do conteúdo de canvas observada"]
      ),
      category(
        "bounce_sync",
        "Bounce tracking e cookie sync",
        15,
        (bounceDetected ? 7 : 0) + (syncDetected ? 8 : 0),
        [
          bounceDetected && "possível bounce tracking: 7 pontos",
          syncDetected && "possível compartilhamento de identificador: 8 pontos",
        ]
      ),
      category(
        "hijacking",
        "Hijacking e hooks",
        15,
        (hookCount ? 8 : 0) +
          (websocketCount ? 4 : 0) +
          (pollingCount ? 3 : 0),
        [
          hookCount && "substituição de API monitorada: 8 pontos",
          websocketCount && "WebSocket de terceiro: 4 pontos",
          pollingCount && "polling persistente: 3 pontos",
        ]
      ),
    ];
    const totalDiscount = categories.reduce(
      (total, item) => total + item.discount,
      0
    );

    return {
      score: Math.max(0, 100 - totalDiscount),
      maximumScore: 100,
      totalDiscount,
      categories,
      disclaimer:
        "Score heurístico baseado somente nos sinais observados nesta navegação.",
    };
  }

  return {
    classifyCookie,
    classifyDomain,
    classifyIdentifierParameter,
    calculatePrivacyScore,
    cookieKey,
    detectBounceTracking,
    detectPersistentPolling,
    fallbackRegistrableDomain,
    findIdentifierSharing,
    getRegistrableDomain,
    isIpAddress,
    matchesBlockDomain,
    normalizeBlockDomain,
    normalizeHostname,
    redactIdentifierParameters,
  };
});
