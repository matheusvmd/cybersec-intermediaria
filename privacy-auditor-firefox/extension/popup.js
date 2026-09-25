"use strict";

const contentElement = document.querySelector("#content");
const reportElement = document.querySelector("#report");
const statusElement = document.querySelector("#status");
const pageUrlElement = document.querySelector("#page-url");
const mainDomainElement = document.querySelector("#main-domain");
const totalRequestsElement = document.querySelector("#total-requests");
const thirdPartyCountElement = document.querySelector("#third-party-count");
const thirdPartyDomainsElement = document.querySelector("#third-party-domains");
const noThirdPartiesElement = document.querySelector("#no-third-parties");
const resourceTypesElement = document.querySelector("#resource-types");
const noResourceTypesElement = document.querySelector("#no-resource-types");
const requestDetailsElement = document.querySelector("#request-details");
const noRequestsElement = document.querySelector("#no-requests");
const storageOriginsElement = document.querySelector("#storage-origins");
const noStorageElement = document.querySelector("#no-storage");
const cookieErrorsElement = document.querySelector("#cookie-errors");
const preexistingCookieCountElement = document.querySelector(
  "#preexisting-cookie-count"
);
const preexistingCookiesElement = document.querySelector(
  "#preexisting-cookies"
);
const noPreexistingCookiesElement = document.querySelector(
  "#no-preexisting-cookies"
);
const changedCookieCountElement = document.querySelector(
  "#changed-cookie-count"
);
const changedCookiesElement = document.querySelector("#changed-cookies");
const noChangedCookiesElement = document.querySelector(
  "#no-changed-cookies"
);
const canvasStatusElement = document.querySelector("#canvas-status");
const canvasSummaryElement = document.querySelector("#canvas-summary");
const canvasCallsElement = document.querySelector("#canvas-calls");
const bounceStatusElement = document.querySelector("#bounce-status");
const bounceSummaryElement = document.querySelector("#bounce-summary");
const bounceChainElement = document.querySelector("#bounce-chain");
const bounceDetectionsElement = document.querySelector("#bounce-detections");
const identifierStatusElement = document.querySelector("#identifier-status");
const identifierSummaryElement = document.querySelector("#identifier-summary");
const identifierDetectionsElement = document.querySelector(
  "#identifier-detections"
);

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (_error) {
    return "";
  }
}

function clearChildren(element) {
  while (element.firstChild) {
    element.firstChild.remove();
  }
}

function appendListItem(list, text) {
  const item = document.createElement("li");
  item.textContent = text;
  list.append(item);
}

function setStatus(message, kind = "info") {
  statusElement.textContent = message;
  statusElement.className = `status status--${kind}`;
  statusElement.hidden = !message;
}

function renderThirdParties(domains) {
  const uniqueDomains = Array.isArray(domains) ? domains : [];
  clearChildren(thirdPartyDomainsElement);
  thirdPartyCountElement.textContent = String(uniqueDomains.length);
  noThirdPartiesElement.hidden = uniqueDomains.length > 0;

  uniqueDomains.forEach((domain) => {
    appendListItem(thirdPartyDomainsElement, domain);
  });
}

function renderResourceTypes(countsByType) {
  const entries = Object.entries(countsByType || {}).sort((left, right) =>
    left[0].localeCompare(right[0])
  );
  clearChildren(resourceTypesElement);
  noResourceTypesElement.hidden = entries.length > 0;

  entries.forEach(([type, count]) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const countElement = document.createElement("span");
    name.textContent = `${type}: `;
    countElement.textContent = String(count);
    countElement.className = "type-count";
    item.append(name, countElement);
    resourceTypesElement.append(item);
  });
}

function formatTimestamp(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return "horário indisponível";
  }

  return new Date(timestamp).toLocaleTimeString("pt-BR");
}

function createRecord(titleText, lines) {
  const record = document.createElement("article");
  const title = document.createElement("p");
  record.className = "record";
  title.className = "record-title";
  title.textContent = titleText;
  record.append(title);

  lines.forEach((line) => {
    const metadata = document.createElement("p");
    metadata.className = "record-meta";
    metadata.textContent = line;
    record.append(metadata);
  });

  return record;
}

function renderRequests(requests) {
  const requestList = Array.isArray(requests) ? requests : [];
  clearChildren(requestDetailsElement);
  noRequestsElement.hidden = requestList.length > 0;

  requestList.forEach((request) => {
    const party = request.isThirdParty ? "terceira parte" : "primeira parte";
    requestDetailsElement.append(
      createRecord(request.url || "URL indisponível", [
        `${request.type || "other"} · ${party}`,
        `Domínio: ${request.registrableDomain || request.hostname || "—"}`,
        `Frame ${request.frameId} · ${formatTimestamp(request.timestamp)}`,
        `requestId: ${request.requestId || "—"}`,
      ])
    );
  });
}

function storageAreaText(label, area) {
  if (!area || !area.available) {
    return `${label}: ${area && area.error ? area.error : "indisponível"}`;
  }

  return `${label}: ${area.keyCount} chave(s)`;
}

function indexedDbText(indexedDb) {
  if (!indexedDb || !indexedDb.supported) {
    return `IndexedDB: ${
      indexedDb && indexedDb.error ? indexedDb.error : "não suportado"
    }`;
  }

  if (indexedDb.error) {
    return `IndexedDB: ${indexedDb.error}`;
  }

  if (!indexedDb.databases.length) {
    return "IndexedDB: nenhum banco encontrado";
  }

  const databases = indexedDb.databases.map((database) => {
    const version = database.version === null ? "?" : database.version;
    return `${database.name} (v${version})`;
  });
  return `IndexedDB: ${databases.join(", ")}`;
}

function createFrameReport(report) {
  const frameElement = document.createElement("div");
  const title = document.createElement("p");
  const localStorage = document.createElement("p");
  const sessionStorage = document.createElement("p");
  const indexedDb = document.createElement("p");

  frameElement.className = "frame-report";
  title.className = "frame-title";
  title.textContent = report.isMainFrame
    ? "Frame principal"
    : `Frame secundário ${report.frameId}`;
  localStorage.className = "storage-row";
  sessionStorage.className = "storage-row";
  indexedDb.className = "storage-row database-list";
  localStorage.textContent = storageAreaText(
    "localStorage",
    report.localStorage
  );
  sessionStorage.textContent = storageAreaText(
    "sessionStorage",
    report.sessionStorage
  );
  indexedDb.textContent = indexedDbText(report.indexedDB);
  frameElement.append(title, localStorage, sessionStorage, indexedDb);
  return frameElement;
}

function renderStorage(reports) {
  const reportsByOrigin = new Map();
  clearChildren(storageOriginsElement);

  (Array.isArray(reports) ? reports : []).forEach((report) => {
    const origin = report.origin || "Origem indisponível";
    const originReports = reportsByOrigin.get(origin) || [];
    originReports.push(report);
    reportsByOrigin.set(origin, originReports);
  });

  noStorageElement.hidden = reportsByOrigin.size > 0;

  [...reportsByOrigin.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .forEach(([origin, originReports]) => {
      const originElement = document.createElement("article");
      const title = document.createElement("h3");
      originElement.className = "storage-origin";
      title.className = "origin-title";
      title.textContent = origin;
      originElement.append(title);

      originReports
        .sort((left, right) => left.frameId - right.frameId)
        .forEach((report) => {
          originElement.append(createFrameReport(report));
        });

      storageOriginsElement.append(originElement);
    });
}

function cookieDuration(cookie) {
  if (cookie.isSession) {
    return "sessão";
  }

  if (Number.isFinite(cookie.expirationDate)) {
    return `persistente até ${new Date(
      cookie.expirationDate * 1000
    ).toLocaleString("pt-BR")}`;
  }

  return "persistente";
}

function renderCookieList(cookies, container, emptyElement, countElement) {
  const cookieList = Array.isArray(cookies) ? cookies : [];
  clearChildren(container);
  countElement.textContent = String(cookieList.length);
  emptyElement.hidden = cookieList.length > 0;

  cookieList
    .slice()
    .sort((left, right) => {
      const leftKey = `${left.domain}\n${left.name}\n${left.path}`;
      const rightKey = `${right.domain}\n${right.name}\n${right.path}`;
      return leftKey.localeCompare(rightKey);
    })
    .forEach((cookie) => {
      const party = cookie.isThirdParty ? "terceira parte" : "primeira parte";
      const attributes = [
        cookie.secure ? "Secure" : "sem Secure",
        cookie.httpOnly ? "HttpOnly" : "acessível a scripts",
        `SameSite=${cookie.sameSite || "unspecified"}`,
      ];

      if (cookie.partitioned) {
        attributes.push("particionado");
      }

      const lines = [
        `${cookie.domain || "domínio indisponível"}${cookie.path || "/"}`,
        `${party} · ${cookieDuration(cookie)}`,
        attributes.join(" · "),
      ];

      if (cookie.cause && cookie.cause !== "snapshot") {
        const action = cookie.removed ? "removido" : "criado ou alterado";
        lines.push(`${action} · causa: ${cookie.cause}`);
      }

      container.append(createRecord(cookie.name || "(cookie sem nome)", lines));
    });
}

function renderCookies(cookies) {
  const report = cookies || {};
  renderCookieList(
    report.preexisting,
    preexistingCookiesElement,
    noPreexistingCookiesElement,
    preexistingCookieCountElement
  );
  renderCookieList(
    report.changed,
    changedCookiesElement,
    noChangedCookiesElement,
    changedCookieCountElement
  );

  const errors = Array.isArray(report.errors) ? report.errors : [];
  cookieErrorsElement.textContent = errors.join(" ");
  cookieErrorsElement.hidden = errors.length === 0;
}

function setDetectionStatus(element, detected) {
  element.textContent = detected ? "Possível detecção" : "Não detectado";
  element.className = detected
    ? "detection-status detection-status--possible"
    : "detection-status";
}

function renderCanvas(canvas) {
  const report = canvas || {};
  const calls = Array.isArray(report.calls) ? report.calls : [];
  setDetectionStatus(canvasStatusElement, Boolean(report.detected));
  clearChildren(canvasCallsElement);
  canvasSummaryElement.textContent = report.detected
    ? `${report.totalCalls || calls.length} leitura(s); método(s): ${(
        report.methods || []
      ).join(", ")}.`
    : "Nenhuma leitura de canvas observada.";

  calls.forEach((call) => {
    const lines = [
      `${call.origin || "Origem indisponível"} · frame ${
        call.frame || call.frameId
      }`,
      formatTimestamp(call.timestamp),
    ];

    if (call.scriptUrl) {
      lines.push(`Script possível: ${call.scriptUrl}`);
    }
    if (Array.isArray(call.stack) && call.stack.length > 0) {
      lines.push(`Stack resumido: ${call.stack.join(" ← ")}`);
    }

    canvasCallsElement.append(createRecord(call.method || "canvas", lines));
  });
}

function renderBounceTracking(bounceTracking) {
  const report = bounceTracking || {};
  const chain = Array.isArray(report.chain) ? report.chain : [];
  const detections = Array.isArray(report.detections)
    ? report.detections
    : [];
  setDetectionStatus(bounceStatusElement, Boolean(report.detected));
  clearChildren(bounceChainElement);
  clearChildren(bounceDetectionsElement);
  bounceSummaryElement.textContent = report.detected
    ? "Heurística: passagem rápida por domínio intermediário com redirects automáticos."
    : "Nenhuma cadeia suspeita observada.";

  chain.forEach((entry) => {
    appendListItem(
      bounceChainElement,
      `${entry.registrableDomain || "domínio indisponível"} — ${entry.url}`
    );
  });

  detections.forEach((detection) => {
    bounceDetectionsElement.append(
      createRecord(
        detection.intermediateDomain || "Intermediário indisponível",
        [
          detection.justification || "Heurística de redirecionamento rápido",
          `Intervalo: ${detection.intervalMs} ms`,
          `Cadeia: ${(detection.chain || [])
            .map((entry) => entry.registrableDomain)
            .filter(Boolean)
            .join(" → ")}`,
        ]
      )
    );
  });
}

function renderIdentifierSharing(identifierSharing) {
  const report = identifierSharing || {};
  const detections = Array.isArray(report.detections)
    ? report.detections
    : [];
  setDetectionStatus(identifierStatusElement, Boolean(report.detected));
  clearChildren(identifierDetectionsElement);
  identifierSummaryElement.textContent = report.detected
    ? "Possível compartilhamento de identificador; os valores originais não são armazenados."
    : "Nenhum possível compartilhamento de identificador observado.";

  detections.forEach((detection) => {
    identifierDetectionsElement.append(
      createRecord(detection.rule || "Possível compartilhamento", [
        `Domínios: ${(detection.domains || []).join(", ") || "indisponíveis"}`,
        `Tipo de parâmetro: ${
          (detection.parameterTypes || []).join(", ") || "valor de cookie"
        }`,
        detection.justification || "Correspondência de hash local",
      ])
    );
  });
}

function renderReport(report, fallbackUrl) {
  const url = report.url || fallbackUrl || "";
  const mainDomain =
    report.registrableDomain || report.hostname || getHostname(url);
  const totalRequests = Number.isInteger(report.totalRequests)
    ? report.totalRequests
    : 0;

  pageUrlElement.textContent = url || "Indisponível nesta aba";
  mainDomainElement.textContent =
    mainDomain || "Página interna ou indisponível";
  totalRequestsElement.textContent = String(totalRequests);
  renderThirdParties(report.thirdPartyDomains);
  renderResourceTypes(report.countsByType);
  renderRequests(report.requests);
  renderStorage(report.storage);
  renderCookies(report.cookies);
  renderCanvas(report.canvas);
  renderBounceTracking(report.bounceTracking);
  renderIdentifierSharing(report.identifierSharing);

  reportElement.hidden = false;
  contentElement.setAttribute("aria-busy", "false");

  const cookieCount =
    ((report.cookies && report.cookies.preexisting) || []).length +
    ((report.cookies && report.cookies.changed) || []).length;
  const hasData =
    totalRequests > 0 || (report.storage || []).length > 0 || cookieCount > 0;
  if (!hasData) {
    setStatus(
      getHostname(url)
        ? "Ainda não há dados. Recarregue a página e abra o popup novamente."
        : "Esta página interna não pode ser inspecionada pela extensão.",
      "empty"
    );
  } else {
    setStatus("");
  }
}

async function loadActiveTabReport() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab || !Number.isInteger(activeTab.id)) {
      throw new Error("A aba ativa não pôde ser identificada.");
    }

    const report = await browser.runtime.sendMessage({
      type: "GET_TAB_REPORT",
      tabId: activeTab.id,
    });
    renderReport(report || {}, activeTab.url || "");
  } catch (_error) {
    contentElement.setAttribute("aria-busy", "false");
    reportElement.hidden = true;
    setStatus("Não foi possível carregar os dados desta aba.", "error");
  }
}

loadActiveTabReport();
