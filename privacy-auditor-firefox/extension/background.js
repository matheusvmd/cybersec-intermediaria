"use strict";

const tabStates = new Map();
const {
  classifyCookie,
  classifyDomain,
  cookieKey,
  getRegistrableDomain,
  normalizeHostname,
} = globalThis.PrivacyUtils;

console.info("[Privacy Auditor] background.js iniciado");

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
    url,
    hostname,
    registrableDomain: getRegistrableDomain(hostname, browser.publicSuffix),
    requests: [],
    requestIds: new Set(),
    countsByType: Object.create(null),
    storageReports: new Map(),
    observedDomains: new Set(),
    cookieStoreId: "",
    cookies: {
      preexisting: new Map(),
      changed: new Map(),
      scannedHosts: new Set(),
      errors: [],
    },
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
  state.url = url;
  state.hostname = parsedUrl ? normalizeHostname(parsedUrl.hostname) : "";
  state.registrableDomain = getRegistrableDomain(
    state.hostname,
    browser.publicSuffix
  );

  if (state.registrableDomain) {
    state.observedDomains.add(state.registrableDomain);
  }
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

  tabStates.forEach((state) => {
    if (state.cookieStoreId && cookie.storeId !== state.cookieStoreId) {
      return;
    }

    const record = createCookieRecord(cookie, state, changeInfo);

    if (
      record.registrableDomain &&
      state.observedDomains.has(record.registrableDomain)
    ) {
      state.cookies.changed.set(cookieKey(cookie), record);
    }
  });
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
    url: details.url,
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
      cookies: {
        preexisting: [],
        changed: [],
        errors: [],
      },
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
    cookies: {
      preexisting: [...state.cookies.preexisting.values()].map((cookie) => ({
        ...cookie,
      })),
      changed: [...state.cookies.changed.values()].map((cookie) => ({
        ...cookie,
      })),
      errors: [...state.cookies.errors],
    },
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
  snapshotCookiesForHostname(details.tabId, state, state.hostname);
});

browser.cookies.onChanged.addListener(recordCookieChange);

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
