"use strict";

const tabStates = new Map();
const {
  calculatePrivacyScore,
  classifyCookie,
  classifyDomain,
  classifyIdentifierParameter,
  cookieKey,
  detectBounceTracking,
  detectPersistentPolling,
  findIdentifierSharing,
  getRegistrableDomain,
  matchesBlockDomain,
  normalizeBlockDomain,
  normalizeHostname,
  redactIdentifierParameters,
} = globalThis.PrivacyUtils;
const navigationChains = new Map();
const BOUNCE_INTERVAL_MS = 3000;
const blockSettings = {
  enabled: false,
  domains: new Set(),
};

const blockSettingsReady = browser.storage.local
  .get({ blockingEnabled: false, blockedDomains: [] })
  .then((stored) => {
    blockSettings.enabled = Boolean(stored.blockingEnabled);
    blockSettings.domains = new Set(
      (Array.isArray(stored.blockedDomains) ? stored.blockedDomains : [])
        .map(normalizeBlockDomain)
        .filter(Boolean)
    );
  })
  .catch(() => {
    // A extensão continua funcionando com bloqueio desativado.
  });

function parseUrl(url) {
  try {
    return new URL(url);
  } catch (_error) {
    return null;
  }
}

function createTabState(url = "") {
  const parsedUrl = parseUrl(url);
  const hostname = parsedUrl ? normalizeHostname(parsedUrl.hostname) : "";
  const state = {
    url: redactIdentifierParameters(url),
    hostname,
    registrableDomain: getRegistrableDomain(hostname, browser.publicSuffix),
    requests: [],
    requestIds: new Set(),
    countsByType: Object.create(null),
    storageReports: new Map(),
    canvasCalls: [],
    hijacking: {
      networkCalls: [],
      thirdPartyWebSockets: [],
      hookReplacements: [],
      dynamicScripts: [],
    },
    blockMatches: [],
    blockMatchIds: new Set(),
    identifierOccurrences: [],
    identifierOccurrenceKeys: new Set(),
    observedDomains: new Set(),
    cookieStoreId: "",
    cookies: {
      preexisting: new Map(),
      changed: new Map(),
      scannedHosts: new Set(),
      errors: [],
    },
    navigationChain: null,
  };

  if (state.registrableDomain) {
    state.observedDomains.add(state.registrableDomain);
  }

  return state;
}

function startTabState(tabId, url = "") {
  const state = createTabState(url);
  tabStates.set(tabId, state);
  return state;
}

function getOrCreateTabState(tabId, url = "") {
  return tabStates.get(tabId) || startTabState(tabId, url);
}

function preserveCurrentDocumentStorage(previousState, nextState, details) {
  if (!previousState) {
    return;
  }

  const parsedUrl = parseUrl(details.url);
  const navigationOrigin = parsedUrl ? parsedUrl.origin : "";
  const navigationTimestamp = Number.isFinite(details.timeStamp)
    ? details.timeStamp
    : Date.now();

  previousState.storageReports.forEach((report, key) => {
    const sameDocument = Boolean(
      details.documentId && report.documentId === details.documentId
    );
    const recentSameOrigin = Boolean(
      !details.documentId &&
        !report.documentId &&
        report.origin === navigationOrigin &&
        report.timestamp >= navigationTimestamp - 5000
    );

    if (sameDocument || recentSameOrigin) {
      nextState.storageReports.set(key, report);
    }
  });
}

function updateMainDocument(state, url) {
  const parsedUrl = parseUrl(url);
  state.url = redactIdentifierParameters(url);
  state.hostname = parsedUrl ? normalizeHostname(parsedUrl.hostname) : "";
  state.registrableDomain = getRegistrableDomain(
    state.hostname,
    browser.publicSuffix
  );

  if (state.registrableDomain) {
    state.observedDomains.add(state.registrableDomain);
  }
}

function registrableDomainFromUrl(url) {
  const parsedUrl = parseUrl(url);
  return parsedUrl
    ? getRegistrableDomain(parsedUrl.hostname, browser.publicSuffix)
    : "";
}

function appendNavigationEntry(chain, url, timestamp, transition) {
  const safeUrl = redactIdentifierParameters(url);
  const lastEntry = chain.entries[chain.entries.length - 1];
  if (lastEntry && lastEntry.url === safeUrl) {
    return lastEntry;
  }

  const entry = {
    url: safeUrl,
    registrableDomain: registrableDomainFromUrl(url),
    timestamp,
    transition,
  };
  chain.entries.push(entry);
  return entry;
}

function appendNavigationTransition(
  chain,
  fromUrl,
  toUrl,
  timestamp,
  options = {}
) {
  const safeFromUrl = redactIdentifierParameters(fromUrl);
  const safeToUrl = redactIdentifierParameters(toUrl);
  const previous = chain.redirects[chain.redirects.length - 1];

  if (
    previous &&
    previous.fromUrl === safeFromUrl &&
    previous.toUrl === safeToUrl
  ) {
    if (options.automatic) {
      previous.automatic = true;
    }
    if (options.transition) {
      previous.transition = options.transition;
    }
    return previous;
  }

  const navigation = {
    fromUrl: safeFromUrl,
    fromDomain: registrableDomainFromUrl(fromUrl),
    toUrl: safeToUrl,
    toDomain: registrableDomainFromUrl(toUrl),
    timestamp,
    statusCode: options.statusCode || 0,
    automatic: Boolean(options.automatic),
    transition: options.transition || "navegação",
  };
  chain.redirects.push(navigation);
  return navigation;
}

function recordMainFrameNavigation(details) {
  const timestamp = Number.isFinite(details.timeStamp)
    ? details.timeStamp
    : Date.now();
  let chain = navigationChains.get(details.tabId);
  const previousState = tabStates.get(details.tabId);
  const isNewRequest = !chain || chain.requestId !== details.requestId;
  const chainExpired = Boolean(
    chain &&
      isNewRequest &&
      timestamp - (chain.lastActivity || 0) > BOUNCE_INTERVAL_MS
  );

  if (!chain || chainExpired) {
    chain = {
      requestId: details.requestId,
      entries: [],
      redirects: [],
      lastActivity: timestamp,
    };
    navigationChains.set(details.tabId, chain);

    if (previousState?.url && previousState.url !== details.url) {
      appendNavigationEntry(chain, previousState.url, timestamp, "origem");
    }
  }

  const previousEntry = chain.entries[chain.entries.length - 1];
  appendNavigationEntry(chain, details.url, timestamp, "navegação");
  const currentEntry = chain.entries[chain.entries.length - 1];

  if (
    isNewRequest &&
    previousEntry &&
    currentEntry &&
    previousEntry.url !== currentEntry.url
  ) {
    appendNavigationTransition(
      chain,
      previousEntry.url,
      currentEntry.url,
      timestamp
    );
  }

  chain.requestId = details.requestId;
  chain.lastActivity = timestamp;
  return chain;
}

function recordMainFrameRedirect(details) {
  if (details.tabId === -1) {
    return;
  }

  const timestamp = Number.isFinite(details.timeStamp)
    ? details.timeStamp
    : Date.now();
  const chain =
    navigationChains.get(details.tabId) || recordMainFrameNavigation(details);

  appendNavigationEntry(chain, details.url, timestamp, "navegação");
  appendNavigationEntry(chain, details.redirectUrl, timestamp, "redirecionamento");
  appendNavigationTransition(chain, details.url, details.redirectUrl, timestamp, {
    statusCode: details.statusCode,
    automatic: true,
    transition: "redirecionamento HTTP",
  });
  chain.lastActivity = timestamp;

  const state = tabStates.get(details.tabId);
  if (state) {
    state.navigationChain = chain;
  }
}

function recordCommittedMainFrameNavigation(details) {
  if (details.frameId !== 0 || details.tabId === -1) {
    return;
  }

  const timestamp = Number.isFinite(details.timeStamp)
    ? details.timeStamp
    : Date.now();
  const chain = navigationChains.get(details.tabId);
  const qualifiers = Array.isArray(details.transitionQualifiers)
    ? details.transitionQualifiers
    : [];
  const automaticTransition = qualifiers.find((qualifier) =>
    ["client_redirect", "server_redirect"].includes(qualifier)
  );

  if (chain) {
    const safeUrl = redactIdentifierParameters(details.url);
    const transition = chain.redirects
      .slice()
      .reverse()
      .find((item) => item.toUrl === safeUrl);

    if (transition && automaticTransition) {
      transition.automatic = true;
      transition.transition = automaticTransition;
      transition.timestamp = timestamp;
    }

    const lastEntry = chain.entries[chain.entries.length - 1];
    if (lastEntry && lastEntry.url === safeUrl && automaticTransition) {
      lastEntry.transition = automaticTransition;
      lastEntry.timestamp = timestamp;
    }

    chain.lastActivity = timestamp;
  }

  const state = getOrCreateTabState(details.tabId, details.url);
  if (chain) {
    state.navigationChain = chain;
  }
  updateMainDocument(state, details.url);
  snapshotCookiesForHostname(details.tabId, state, state.hostname);
}

async function hashIdentifierValue(value) {
  try {
    if (!globalThis.crypto?.subtle || typeof TextEncoder !== "function") {
      return "";
    }

    const bytes = new TextEncoder().encode(String(value));
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch (_error) {
    return "";
  }
}

async function addIdentifierOccurrence(tabId, state, value, occurrence) {
  const hash = await hashIdentifierValue(value);
  if (!hash || tabStates.get(tabId) !== state) {
    return;
  }

  const key = [
    hash,
    occurrence.source,
    occurrence.domain,
    occurrence.parameterName || "",
  ].join("\n");

  if (state.identifierOccurrenceKeys.has(key)) {
    return;
  }

  state.identifierOccurrenceKeys.add(key);
  state.identifierOccurrences.push({
    hash,
    source: occurrence.source,
    domain: occurrence.domain,
    parameterName: occurrence.parameterName || "",
    rule: occurrence.rule || "",
    timestamp: Date.now(),
  });
}

function analyzeThirdPartyQuery(tabId, state, request) {
  if (!request.isThirdParty || !request.registrableDomain) {
    return;
  }

  const parsedUrl = parseUrl(request.url);
  if (!parsedUrl) {
    return;
  }

  parsedUrl.searchParams.forEach((value, name) => {
    const classification = classifyIdentifierParameter(name, value);
    if (!classification.isCandidate) {
      return;
    }

    addIdentifierOccurrence(tabId, state, value, {
      source: "query",
      domain: request.registrableDomain,
      parameterName: classification.parameterName,
      rule: classification.rule,
    });
  });
}

function analyzeCookieIdentifier(tabId, state, cookie, cookieDomain) {
  const classification = classifyIdentifierParameter(cookie.name, cookie.value);
  if (!classification.isCandidate || !cookieDomain) {
    return;
  }

  let normalizedValue = String(cookie.value || "");
  try {
    normalizedValue = decodeURIComponent(normalizedValue);
  } catch (_error) {
    // Mantém a representação original se não houver encoding válido.
  }

  addIdentifierOccurrence(tabId, state, normalizedValue, {
    source: "cookie",
    domain: cookieDomain,
    parameterName: "",
    rule: classification.rule,
  });
}

function createCookieRecord(cookie, state, changeInfo = null) {
  const classification = classifyCookie(
    cookie,
    state.hostname,
    browser.publicSuffix
  );

  return {
    name: String(cookie.name || ""),
    domain: classification.domain,
    registrableDomain: classification.registrableDomain,
    path: String(cookie.path || "/"),
    storeId: String(cookie.storeId || ""),
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly),
    sameSite: String(cookie.sameSite || "unspecified"),
    expirationDate: Number.isFinite(cookie.expirationDate)
      ? cookie.expirationDate
      : null,
    isSession: classification.isSession,
    isThirdParty: classification.isThirdParty,
    partitioned: Boolean(cookie.partitionKey),
    firstPartyDomain: String(cookie.firstPartyDomain || ""),
    removed: Boolean(changeInfo && changeInfo.removed),
    cause: changeInfo ? String(changeInfo.cause || "unknown") : "snapshot",
    timestamp: Date.now(),
  };
}

function addCookieError(state, hostname) {
  const message = `Não foi possível consultar cookies de ${hostname}.`;
  if (!state.cookies.errors.includes(message)) {
    state.cookies.errors.push(message);
  }
}

function snapshotCookiesForHostname(tabId, state, hostname) {
  const normalized = normalizeHostname(hostname);

  if (!normalized || state.cookies.scannedHosts.has(normalized)) {
    return;
  }

  state.cookies.scannedHosts.add(normalized);
  const query = { domain: normalized };
  if (state.cookieStoreId) {
    query.storeId = state.cookieStoreId;
  }

  browser.cookies
    .getAll(query)
    .then((cookies) => {
      if (tabStates.get(tabId) !== state) {
        return;
      }

      cookies.forEach((cookie) => {
        const record = createCookieRecord(cookie, state);
        const key = cookieKey(cookie);

        if (
          record.registrableDomain &&
          state.observedDomains.has(record.registrableDomain) &&
          !state.cookies.changed.has(key)
        ) {
          state.cookies.preexisting.set(key, record);
          analyzeCookieIdentifier(
            tabId,
            state,
            cookie,
            record.registrableDomain
          );
        }
      });
    })
    .catch(() => {
      if (tabStates.get(tabId) === state) {
        addCookieError(state, normalized);
      }
    });
}

function recordCookieChange(changeInfo) {
  const cookie = changeInfo && changeInfo.cookie;
  if (!cookie) {
    return;
  }

  tabStates.forEach((state, tabId) => {
    if (state.cookieStoreId && cookie.storeId !== state.cookieStoreId) {
      return;
    }

    const record = createCookieRecord(cookie, state, changeInfo);

    if (
      record.registrableDomain &&
      state.observedDomains.has(record.registrableDomain)
    ) {
      state.cookies.changed.set(cookieKey(cookie), record);
      analyzeCookieIdentifier(
        tabId,
        state,
        cookie,
        record.registrableDomain
      );
    }
  });
}

function matchingBlockedDomain(hostname) {
  for (const blockedDomain of blockSettings.domains) {
    if (matchesBlockDomain(hostname, blockedDomain)) {
      return blockedDomain;
    }
  }
  return "";
}

function evaluateBlockRequest(details) {
  if (details.tabId === -1) {
    return {};
  }

  const parsedUrl = parseUrl(details.url);
  const hostname = parsedUrl ? normalizeHostname(parsedUrl.hostname) : "";
  const matchedDomain = matchingBlockedDomain(hostname);
  if (!matchedDomain) {
    return {};
  }

  const documentUrl = details.documentUrl || details.originUrl || details.url;
  const state = getOrCreateTabState(details.tabId, documentUrl);
  const key = `${details.requestId}\n${matchedDomain}`;
  const blocked = blockSettings.enabled;

  if (!state.blockMatchIds.has(key)) {
    state.blockMatchIds.add(key);
    state.blockMatches.push({
      url: redactIdentifierParameters(details.url),
      hostname,
      matchedDomain,
      type: details.type || "other",
      requestId: String(details.requestId || ""),
      timestamp: Number.isFinite(details.timeStamp)
        ? details.timeStamp
        : Date.now(),
      detected: true,
      blocked,
    });
  }

  return blocked ? { cancel: true } : {};
}

function recordRequest(details) {
  if (details.tabId === -1) {
    return;
  }

  const navigationChain =
    details.type === "main_frame" ? recordMainFrameNavigation(details) : null;
  let state = tabStates.get(details.tabId);

  // Um requestId pode reaparecer em redirecionamentos. Nesse caso, ele não
  // representa uma nova navegação nem deve ser contado novamente.
  if (state && state.requestIds.has(details.requestId)) {
    return;
  }

  if (details.type === "main_frame") {
    const previousState = state;
    const currentBlockMatches = previousState
      ? previousState.blockMatches.filter(
          (match) => match.requestId === String(details.requestId || "")
        )
      : [];
    state = startTabState(details.tabId, details.url);
    state.navigationChain = navigationChain;
    currentBlockMatches.forEach((match) => {
      state.blockMatches.push(match);
      state.blockMatchIds.add(`${match.requestId}\n${match.matchedDomain}`);
    });
    preserveCurrentDocumentStorage(previousState, state, details);
  } else {
    const documentUrl = details.documentUrl || details.originUrl || details.url;
    state = getOrCreateTabState(details.tabId, documentUrl);
  }

  if (!state.cookieStoreId && details.cookieStoreId) {
    state.cookieStoreId = details.cookieStoreId;
  }

  if (state.requestIds.has(details.requestId)) {
    return;
  }

  const parsedUrl = parseUrl(details.url);
  const hostname = parsedUrl ? normalizeHostname(parsedUrl.hostname) : "";
  const classification = classifyDomain(
    state.hostname,
    hostname,
    browser.publicSuffix
  );
  const request = {
    url: redactIdentifierParameters(details.url),
    hostname,
    registrableDomain: classification.resourceDomain,
    type: details.type || "other",
    requestId: details.requestId,
    frameId: details.frameId,
    timestamp: Number.isFinite(details.timeStamp)
      ? details.timeStamp
      : Date.now(),
    isThirdParty:
      details.type === "main_frame" ? false : classification.isThirdParty,
  };

  state.requestIds.add(details.requestId);
  state.requests.push(request);
  state.countsByType[request.type] =
    (state.countsByType[request.type] || 0) + 1;

  if (request.registrableDomain) {
    state.observedDomains.add(request.registrableDomain);
  }
  snapshotCookiesForHostname(details.tabId, state, hostname);
  analyzeThirdPartyQuery(details.tabId, state, {
    ...request,
    url: details.url,
  });
}

function sanitizeStorageArea(area) {
  return {
    available: Boolean(area && area.available),
    keyCount:
      area && Number.isInteger(area.keyCount) && area.keyCount >= 0
        ? area.keyCount
        : null,
    error: area && typeof area.error === "string" ? area.error : "",
  };
}

function sanitizeIndexedDb(indexedDb) {
  const databases = Array.isArray(indexedDb && indexedDb.databases)
    ? indexedDb.databases
        .filter((database) => database && typeof database.name === "string")
        .map((database) => ({
          name: database.name,
          version: Number.isFinite(database.version) ? database.version : null,
        }))
    : [];

  return {
    supported: Boolean(indexedDb && indexedDb.supported),
    databases,
    error:
      indexedDb && typeof indexedDb.error === "string" ? indexedDb.error : "",
  };
}

function getSenderOrigin(sender, reportedOrigin) {
  const senderUrl = sender && typeof sender.url === "string" ? sender.url : "";
  const parsedSenderUrl = parseUrl(senderUrl);

  if (parsedSenderUrl && parsedSenderUrl.origin !== "null") {
    return parsedSenderUrl.origin;
  }

  return typeof reportedOrigin === "string" && reportedOrigin.length <= 2048
    ? reportedOrigin
    : "Origem indisponível";
}

function incorporateStorageReport(message, sender) {
  const tabId = sender && sender.tab ? sender.tab.id : -1;

  if (!Number.isInteger(tabId) || tabId === -1) {
    return { accepted: false };
  }

  const frameId = Number.isInteger(sender.frameId) ? sender.frameId : -1;
  const origin = getSenderOrigin(sender, message.origin);
  const state = getOrCreateTabState(tabId, sender.tab.url || sender.url || "");
  const report = {
    origin,
    frameId,
    documentId:
      sender && typeof sender.documentId === "string" ? sender.documentId : "",
    isMainFrame: frameId === 0,
    localStorage: sanitizeStorageArea(message.localStorage),
    sessionStorage: sanitizeStorageArea(message.sessionStorage),
    indexedDB: sanitizeIndexedDb(message.indexedDB),
    timestamp: Date.now(),
  };

  state.storageReports.set(`${origin}\n${frameId}`, report);
  return { accepted: true };
}

function incorporateCanvasRead(message, sender) {
  const tabId = sender && sender.tab ? sender.tab.id : -1;
  if (!Number.isInteger(tabId) || tabId === -1) {
    return { accepted: false };
  }

  const allowedMethods = new Set(["toDataURL", "toBlob", "getImageData"]);
  if (!allowedMethods.has(message.method)) {
    return { accepted: false };
  }

  const frameId = Number.isInteger(sender.frameId) ? sender.frameId : -1;
  const state = getOrCreateTabState(tabId, sender.tab.url || sender.url || "");
  state.canvasCalls.push({
    method: message.method,
    timestamp: Number.isFinite(message.timestamp)
      ? message.timestamp
      : Date.now(),
    origin: getSenderOrigin(sender, message.origin),
    frameId,
    frame: frameId === 0 ? "principal" : "secundário",
    documentId:
      sender && typeof sender.documentId === "string" ? sender.documentId : "",
    stack: Array.isArray(message.stack)
      ? message.stack
          .filter((line) => typeof line === "string")
          .slice(0, 6)
          .map((line) => line.slice(0, 300))
      : [],
    scriptUrl:
      typeof message.scriptUrl === "string"
        ? message.scriptUrl.slice(0, 500)
        : "",
  });

  return { accepted: true };
}

function pageObservationMetadata(message, sender) {
  const frameId = Number.isInteger(sender.frameId) ? sender.frameId : -1;
  return {
    timestamp: Number.isFinite(message.timestamp)
      ? message.timestamp
      : Date.now(),
    origin: getSenderOrigin(sender, message.origin),
    frameId,
    frame: frameId === 0 ? "principal" : "secundário",
    stack: Array.isArray(message.stack)
      ? message.stack
          .filter((line) => typeof line === "string")
          .slice(0, 6)
          .map((line) => line.slice(0, 300))
      : [],
    scriptUrl: redactIdentifierParameters(
      typeof message.scriptUrl === "string" ? message.scriptUrl.slice(0, 500) : ""
    ),
  };
}

function resolveObservedUrl(url, senderUrl) {
  try {
    return new URL(String(url || ""), senderUrl || undefined);
  } catch (_error) {
    return null;
  }
}

function incorporatePageObservation(message, sender) {
  const tabId = sender && sender.tab ? sender.tab.id : -1;
  if (!Number.isInteger(tabId) || tabId === -1) {
    return { accepted: false };
  }

  if (message.kind === "canvas_read") {
    return incorporateCanvasRead(message, sender);
  }

  const state = getOrCreateTabState(tabId, sender.tab.url || sender.url || "");
  const metadata = pageObservationMetadata(message, sender);

  if (message.kind === "hook_replaced") {
    const target = String(message.target || "").slice(0, 120);
    if (!target) {
      return { accepted: false };
    }
    state.hijacking.hookReplacements.push({ target, ...metadata });
    return { accepted: true };
  }

  if (message.kind === "websocket") {
    const parsedUrl = resolveObservedUrl(message.url, sender.url);
    if (!parsedUrl || !["ws:", "wss:"].includes(parsedUrl.protocol)) {
      return { accepted: false };
    }
    const classification = classifyDomain(
      state.hostname,
      parsedUrl.hostname,
      browser.publicSuffix
    );
    if (classification.isThirdParty) {
      state.hijacking.thirdPartyWebSockets.push({
        url: redactIdentifierParameters(parsedUrl.href),
        domain: classification.resourceDomain,
        justification: "WebSocket aberto para domínio registrável diferente",
        ...metadata,
      });
    }
    return { accepted: true };
  }

  if (message.kind === "network_api_call") {
    const parsedUrl = resolveObservedUrl(message.url, sender.url);
    const api = ["fetch", "XMLHttpRequest.open"].includes(message.api)
      ? message.api
      : "";
    if (!parsedUrl || !api || !["http:", "https:"].includes(parsedUrl.protocol)) {
      return { accepted: false };
    }
    state.hijacking.networkCalls.push({
      api,
      endpoint: `${parsedUrl.origin}${parsedUrl.pathname}`.slice(0, 2048),
      domain: registrableDomainFromUrl(parsedUrl.href),
      method: String(message.method || "GET").slice(0, 20),
      ...metadata,
    });
    return { accepted: true };
  }

  if (message.kind === "dynamic_script") {
    const parsedUrl = message.url
      ? resolveObservedUrl(message.url, sender.url)
      : null;
    const classification = parsedUrl
      ? classifyDomain(state.hostname, parsedUrl.hostname, browser.publicSuffix)
      : { resourceDomain: "", isThirdParty: false };
    state.hijacking.dynamicScripts.push({
      url: parsedUrl ? redactIdentifierParameters(parsedUrl.href) : "",
      domain: classification.resourceDomain,
      isThirdParty: classification.isThirdParty,
      inline: Boolean(message.inline),
      module: Boolean(message.module),
      async: Boolean(message.async),
      assessment:
        "script dinâmico observado; isoladamente não caracteriza ataque",
      ...metadata,
    });
    return { accepted: true };
  }

  return { accepted: false };
}

function createHijackingReport(state) {
  const callsByEndpoint = new Map();
  state.hijacking.networkCalls.forEach((call) => {
    const key = `${call.api}\n${call.method}\n${call.endpoint}`;
    const calls = callsByEndpoint.get(key) || [];
    calls.push(call);
    callsByEndpoint.set(key, calls);
  });
  const polling = [];
  callsByEndpoint.forEach((calls) => {
    const detection = detectPersistentPolling(calls);
    if (detection.detected) {
      polling.push({
        detected: true,
        api: calls[0].api,
        method: calls[0].method,
        endpoint: calls[0].endpoint,
        domain: calls[0].domain,
        callCount: detection.callCount,
        averageIntervalMs: detection.averageIntervalMs,
        justification: detection.justification,
      });
    }
  });

  return {
    detected:
      state.hijacking.thirdPartyWebSockets.length > 0 ||
      state.hijacking.hookReplacements.length > 0 ||
      polling.length > 0,
    thirdPartyWebSockets: state.hijacking.thirdPartyWebSockets.map((item) => ({
      ...item,
      stack: [...item.stack],
    })),
    polling,
    hookReplacements: state.hijacking.hookReplacements.map((item) => ({
      ...item,
      stack: [...item.stack],
    })),
    dynamicScripts: state.hijacking.dynamicScripts.map((item) => ({
      ...item,
      stack: [...item.stack],
    })),
  };
}

function createBounceReport(chain) {
  if (!chain) {
    return {
      detected: false,
      chain: [],
      redirects: [],
      detections: [],
    };
  }

  const detections = detectBounceTracking(
    chain.redirects,
    BOUNCE_INTERVAL_MS
  ).map((detection) => ({
    intermediateDomain: detection.intermediateDomain,
    intervalMs: detection.intervalMs,
    justification: detection.justification,
    chain: chain.entries.map((entry) => ({ ...entry })),
  }));

  return {
    detected: detections.length > 0,
    chain: chain.entries.map((entry) => ({ ...entry })),
    redirects: chain.redirects.map((redirect) => ({ ...redirect })),
    detections,
  };
}

function createIdentifierSharingReport(state) {
  const detections = findIdentifierSharing(state.identifierOccurrences).map(
    (detection) => ({
      rule: detection.rule,
      domains: [...detection.domains],
      parameterTypes: [...detection.parameterTypes],
      justification:
        detection.rule === "mesmo hash em cookie e parâmetro de URL"
          ? "um hash local idêntico apareceu em cookie e parâmetro de URL"
          : "um hash local idêntico apareceu em terceiros diferentes",
    })
  );

  return {
    detected: detections.length > 0,
    detections,
  };
}

function createPublicReport(state) {
  if (!state) {
    const emptyReport = {
      url: "",
      hostname: "",
      registrableDomain: "",
      totalRequests: 0,
      requests: [],
      thirdPartyDomains: [],
      countsByType: {},
      storage: [],
      cookies: {
        preexisting: [],
        changed: [],
        errors: [],
      },
      canvas: {
        detected: false,
        totalCalls: 0,
        methods: [],
        calls: [],
      },
      bounceTracking: createBounceReport(null),
      identifierSharing: {
        detected: false,
        detections: [],
      },
      hijacking: {
        detected: false,
        thirdPartyWebSockets: [],
        polling: [],
        hookReplacements: [],
        dynamicScripts: [],
      },
      blocking: {
        enabled: blockSettings.enabled,
        domains: [...blockSettings.domains].sort(),
        detected: [],
        blocked: [],
      },
    };
    emptyReport.score = calculatePrivacyScore(emptyReport);
    return emptyReport;
  }

  const thirdPartyDomains = [
    ...new Set(
      state.requests
        .filter((request) => request.isThirdParty)
        .map((request) => request.registrableDomain || request.hostname)
        .filter(Boolean)
    ),
  ].sort();

  const report = {
    url: state.url,
    hostname: state.hostname,
    registrableDomain: state.registrableDomain,
    totalRequests: state.requests.length,
    requests: state.requests.map((request) => ({ ...request })),
    thirdPartyDomains,
    countsByType: { ...state.countsByType },
    storage: [...state.storageReports.values()].map((report) => ({
      ...report,
      localStorage: { ...report.localStorage },
      sessionStorage: { ...report.sessionStorage },
      indexedDB: {
        ...report.indexedDB,
        databases: report.indexedDB.databases.map((database) => ({
          ...database,
        })),
      },
    })),
    cookies: {
      preexisting: [...state.cookies.preexisting.values()].map((cookie) => ({
        ...cookie,
      })),
      changed: [...state.cookies.changed.values()].map((cookie) => ({
        ...cookie,
      })),
      errors: [...state.cookies.errors],
    },
    canvas: {
      detected: state.canvasCalls.length > 0,
      totalCalls: state.canvasCalls.length,
      methods: [...new Set(state.canvasCalls.map((call) => call.method))].sort(),
      calls: state.canvasCalls.map((call) => ({
        ...call,
        stack: [...call.stack],
      })),
    },
    bounceTracking: createBounceReport(state.navigationChain),
    identifierSharing: createIdentifierSharingReport(state),
    hijacking: createHijackingReport(state),
    blocking: {
      enabled: blockSettings.enabled,
      domains: [...blockSettings.domains].sort(),
      detected: state.blockMatches.map((match) => ({ ...match })),
      blocked: state.blockMatches
        .filter((match) => match.blocked)
        .map((match) => ({ ...match })),
    },
  };
  report.score = calculatePrivacyScore(report);
  return report;
}

browser.webRequest.onBeforeRequest.addListener(
  evaluateBlockRequest,
  { urls: ["<all_urls>"] },
  ["blocking"]
);

browser.webRequest.onBeforeRequest.addListener(recordRequest, {
  urls: ["<all_urls>"],
});

browser.webRequest.onBeforeRedirect.addListener(recordMainFrameRedirect, {
  urls: ["<all_urls>"],
  types: ["main_frame"],
});

// Atualiza a URL final depois de redirecionamentos sem limpar as requisições
// que já pertencem à navegação corrente.
browser.webNavigation.onCommitted.addListener(recordCommittedMainFrameNavigation);

browser.cookies.onChanged.addListener(recordCookieChange);

browser.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
  navigationChains.delete(tabId);
});

function persistBlockSettings() {
  return browser.storage.local.set({
    blockingEnabled: blockSettings.enabled,
    blockedDomains: [...blockSettings.domains].sort(),
  });
}

function publicBlockSettings() {
  return {
    enabled: blockSettings.enabled,
    domains: [...blockSettings.domains].sort(),
  };
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message.type !== "string") {
    return undefined;
  }

  if (message.type === "GET_TAB_REPORT") {
    if (!Number.isInteger(message.tabId) || message.tabId === -1) {
      return blockSettingsReady.then(() => createPublicReport());
    }

    return blockSettingsReady.then(() =>
      createPublicReport(tabStates.get(message.tabId))
    );
  }

  if (message.type === "STORAGE_REPORT") {
    return Promise.resolve(incorporateStorageReport(message, sender));
  }

  if (message.type === "CANVAS_READ") {
    return Promise.resolve(incorporateCanvasRead(message, sender));
  }

  if (message.type === "PAGE_OBSERVATION") {
    return Promise.resolve(incorporatePageObservation(message, sender));
  }

  if (message.type === "CLEAR_TAB_DATA") {
    if (Number.isInteger(message.tabId) && message.tabId !== -1) {
      tabStates.delete(message.tabId);
      navigationChains.delete(message.tabId);
    }
    return Promise.resolve(createPublicReport());
  }

  if (message.type === "GET_BLOCK_SETTINGS") {
    return blockSettingsReady.then(publicBlockSettings);
  }

  if (message.type === "SET_BLOCKING_ENABLED") {
    return blockSettingsReady.then(() => {
      blockSettings.enabled = Boolean(message.enabled);
      return persistBlockSettings().then(publicBlockSettings);
    });
  }

  if (message.type === "ADD_BLOCK_DOMAIN") {
    const domain = normalizeBlockDomain(message.domain);
    if (!domain) {
      return blockSettingsReady.then(() => ({
        ...publicBlockSettings(),
        error: "Domínio inválido.",
      }));
    }
    return blockSettingsReady.then(() => {
      blockSettings.domains.add(domain);
      return persistBlockSettings().then(publicBlockSettings);
    });
  }

  if (message.type === "REMOVE_BLOCK_DOMAIN") {
    const domain = normalizeBlockDomain(message.domain);
    return blockSettingsReady.then(() => {
      if (domain) {
        blockSettings.domains.delete(domain);
      }
      return persistBlockSettings().then(publicBlockSettings);
    });
  }

  if (message.type === "UPDATE_BLOCK_DOMAIN") {
    const previousDomain = normalizeBlockDomain(message.previousDomain);
    const domain = normalizeBlockDomain(message.domain);
    if (!previousDomain || !domain) {
      return blockSettingsReady.then(() => ({
        ...publicBlockSettings(),
        error: "Domínio inválido.",
      }));
    }
    return blockSettingsReady.then(() => {
      blockSettings.domains.delete(previousDomain);
      blockSettings.domains.add(domain);
      return persistBlockSettings().then(publicBlockSettings);
    });
  }

  return undefined;
});
