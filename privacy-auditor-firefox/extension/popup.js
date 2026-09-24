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
const storageOriginsElement = document.querySelector("#storage-origins");
const noStorageElement = document.querySelector("#no-storage");

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
  renderStorage(report.storage);

  reportElement.hidden = false;
  contentElement.setAttribute("aria-busy", "false");

  const hasData = totalRequests > 0 || (report.storage || []).length > 0;
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

