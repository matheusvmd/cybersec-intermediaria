"use strict";

const tabStates = new Map();

console.info("[Privacy Auditor] background.js iniciado");

function parseUrl(url) {
  try {
    return new URL(url);
  } catch (_error) {
    return null;
  }
}

function normalizeHostname(hostname) {
  return String(hostname || "").toLowerCase().replace(/\.$/, "");
}

function isIpAddress(hostname) {
  const normalized = normalizeHostname(hostname).replace(/^\[|\]$/g, "");

  if (normalized.includes(":")) {
    return true;
  }

  const parts = normalized.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
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

function getRegistrableDomain(hostname) {
  const normalized = normalizeHostname(hostname);

  if (!normalized || normalized === "localhost" || isIpAddress(normalized)) {
    return normalized;
  }

  try {
    if (
      browser.publicSuffix &&
      typeof browser.publicSuffix.getDomain === "function"
    ) {
      const domain = browser.publicSuffix.getDomain(normalized);
      if (domain) {
        return normalizeHostname(domain);
      }
    }
  } catch (error) {
    console.warn(
      "[Privacy Auditor] publicSuffix.getDomain falhou; usando hostname",
      normalized,
      error
    );
  }

  return normalized;
}

function createTabState(url = "") {
  const parsedUrl = parseUrl(url);
  const hostname = parsedUrl ? normalizeHostname(parsedUrl.hostname) : "";
  const state = {
    url,
    hostname,
    registrableDomain: fallbackRegistrableDomain(hostname),
    requests: [],
    requestIds: new Set(),
    countsByType: Object.create(null),
    storageReports: new Map(),
  };

  state.registrableDomain = getRegistrableDomain(hostname);

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
  state.url = url;
  state.hostname = parsedUrl ? normalizeHostname(parsedUrl.hostname) : "";
  state.registrableDomain = getRegistrableDomain(state.hostname);
}

function recordRequest(details) {
  console.info("[Privacy Auditor] onBeforeRequest", {
    tabId: details.tabId,
    type: details.type,
    requestId: details.requestId,
    url: details.url,
  });

  if (details.tabId === -1) {
    return;
  }

  let state = tabStates.get(details.tabId);

  // Um requestId pode reaparecer em redirecionamentos. Nesse caso, ele não
  // representa uma nova navegação nem deve ser contado novamente.
  if (state && state.requestIds.has(details.requestId)) {
    return;
  }

  if (details.type === "main_frame") {
    const previousState = state;
    state = startTabState(details.tabId, details.url);
    preserveCurrentDocumentStorage(previousState, state, details);
  } else {
    const documentUrl = details.documentUrl || details.originUrl || details.url;
    state = getOrCreateTabState(details.tabId, documentUrl);
  }

  if (state.requestIds.has(details.requestId)) {
    return;
  }

  const parsedUrl = parseUrl(details.url);
  const hostname = parsedUrl ? normalizeHostname(parsedUrl.hostname) : "";
  const request = {
    url: details.url,
    hostname,
    registrableDomain: getRegistrableDomain(hostname),
    type: details.type || "other",
    requestId: details.requestId,
    frameId: details.frameId,
    timestamp: Number.isFinite(details.timeStamp)
      ? details.timeStamp
      : Date.now(),
    isThirdParty: false,
  };

  request.isThirdParty = Boolean(
    request.type !== "main_frame" &&
      state.registrableDomain &&
      request.registrableDomain &&
      state.registrableDomain !== request.registrableDomain
  );

  state.requestIds.add(details.requestId);
  state.requests.push(request);
  state.countsByType[request.type] =
    (state.countsByType[request.type] || 0) + 1;
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

  console.info("[Privacy Auditor] STORAGE_REPORT recebido", {
    senderTabId: tabId,
    messageTabId: message.tabId,
    frameId: sender && sender.frameId,
    origin: message.origin,
  });

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

function createPublicReport(state) {
  if (!state) {
    return {
      url: "",
      hostname: "",
      registrableDomain: "",
      totalRequests: 0,
      requests: [],
      thirdPartyDomains: [],
      countsByType: {},
      storage: [],
    };
  }

  const thirdPartyDomains = [
    ...new Set(
      state.requests
        .filter((request) => request.isThirdParty)
        .map((request) => request.registrableDomain || request.hostname)
        .filter(Boolean)
    ),
  ].sort();

  return {
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
  };
}

browser.webRequest.onBeforeRequest.addListener(recordRequest, {
  urls: ["<all_urls>"],
});

// Atualiza a URL final depois de redirecionamentos sem limpar as requisições
// que já pertencem à navegação corrente.
browser.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0 || details.tabId === -1) {
    return;
  }

  const state = getOrCreateTabState(details.tabId, details.url);
  updateMainDocument(state, details.url);
});

browser.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message.type !== "string") {
    return undefined;
  }

  if (message.type === "GET_TAB_REPORT") {
    console.info("[Privacy Auditor] GET_TAB_REPORT solicitado", {
      tabId: message.tabId,
      knownTabIds: [...tabStates.keys()],
    });

    if (!Number.isInteger(message.tabId) || message.tabId === -1) {
      return Promise.resolve(createPublicReport());
    }

    return Promise.resolve(createPublicReport(tabStates.get(message.tabId)));
  }

  if (message.type === "STORAGE_REPORT") {
    return Promise.resolve(incorporateStorageReport(message, sender));
  }

  return undefined;
});
