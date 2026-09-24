"use strict";

const tabStates = new Map();

function getMainDomain(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname || "";
  } catch (_error) {
    return "";
  }
}

function createTabState(url = "") {
  return {
    url,
    mainDomain: getMainDomain(url),
    totalRequests: 0,
  };
}

function getOrCreateTabState(tabId, url = "") {
  if (!tabStates.has(tabId)) {
    tabStates.set(tabId, createTabState(url));
  }

  return tabStates.get(tabId);
}

// onBeforeNavigate acontece antes das requisições da nova página, portanto o
// documento principal também entra na contagem que começa após esta limpeza.
browser.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0 || details.tabId < 0) {
    return;
  }

  tabStates.set(details.tabId, createTabState(details.url));
});

browser.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0 || details.tabId < 0) {
    return;
  }

  const state = getOrCreateTabState(details.tabId, details.url);
  state.url = details.url;
  state.mainDomain = getMainDomain(details.url);
});

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) {
      return;
    }

    const state = getOrCreateTabState(details.tabId, details.url);
    state.totalRequests += 1;

    if (details.type === "main_frame") {
      state.url = details.url;
      state.mainDomain = getMainDomain(details.url);
    }
  },
  { urls: ["<all_urls>"] }
);

browser.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

browser.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "GET_TAB_STATE") {
    return undefined;
  }

  if (!Number.isInteger(message.tabId) || message.tabId < 0) {
    return createTabState();
  }

  const state = tabStates.get(message.tabId);
  return state ? { ...state } : createTabState();
});

