"use strict";

const pageUrlElement = document.querySelector("#page-url");
const mainDomainElement = document.querySelector("#main-domain");
const totalRequestsElement = document.querySelector("#total-requests");
const statusElement = document.querySelector("#status");

function getMainDomain(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname || "";
  } catch (_error) {
    return "";
  }
}

function render(state, fallbackUrl = "") {
  const url = state.url || fallbackUrl;
  const domain = state.mainDomain || getMainDomain(url);
  const totalRequests = Number.isFinite(state.totalRequests)
    ? state.totalRequests
    : 0;

  pageUrlElement.textContent = url || "Indisponível nesta aba";
  mainDomainElement.textContent = domain || "Página interna ou indisponível";
  totalRequestsElement.textContent = String(totalRequests);
}

function showStatus(message) {
  statusElement.textContent = message;
  statusElement.hidden = false;
}

async function loadActiveTabState() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab || !Number.isInteger(activeTab.id)) {
      render({ totalRequests: 0 });
      showStatus("Não foi possível identificar a aba ativa.");
      return;
    }

    let state;
    try {
      state = await browser.runtime.sendMessage({
        type: "GET_TAB_STATE",
        tabId: activeTab.id,
      });
    } catch (_error) {
      state = { totalRequests: 0 };
    }

    render(state || { totalRequests: 0 }, activeTab.url || "");

    if (!getMainDomain((state && state.url) || activeTab.url || "")) {
      showStatus("Esta aba usa uma URL interna ou não acessível à extensão.");
    }
  } catch (_error) {
    render({ totalRequests: 0 });
    showStatus("Os dados desta aba não estão disponíveis.");
  }
}

loadActiveTabState();

