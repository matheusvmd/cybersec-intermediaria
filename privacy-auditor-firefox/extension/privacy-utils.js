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

  return {
    classifyCookie,
    classifyDomain,
    classifyIdentifierParameter,
    cookieKey,
    detectBounceTracking,
    fallbackRegistrableDomain,
    findIdentifierSharing,
    getRegistrableDomain,
    isIpAddress,
    normalizeHostname,
    redactIdentifierParameters,
  };
});
