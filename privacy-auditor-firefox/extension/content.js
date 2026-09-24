"use strict";

function inspectStorageArea(storageName) {
  try {
    const storage = window[storageName];
    return {
      available: true,
      keyCount: storage.length,
      error: "",
    };
  } catch (_error) {
    return {
      available: false,
      keyCount: null,
      error: "Acesso bloqueado",
    };
  }
}

async function inspectIndexedDb() {
  try {
    if (
      !globalThis.indexedDB ||
      typeof globalThis.indexedDB.databases !== "function"
    ) {
      return {
        supported: false,
        databases: [],
        error: "API não suportada",
      };
    }

    const databases = await globalThis.indexedDB.databases();
    return {
      supported: true,
      databases: databases.map((database) => ({
        name: database.name || "Banco sem nome",
        version: Number.isFinite(database.version) ? database.version : null,
      })),
      error: "",
    };
  } catch (_error) {
    return {
      supported: true,
      databases: [],
      error: "Acesso bloqueado",
    };
  }
}

async function sendStorageReport() {
  const report = {
    type: "STORAGE_REPORT",
    origin: location.origin || "Origem indisponível",
    isMainFrame: window.top === window,
    localStorage: inspectStorageArea("localStorage"),
    sessionStorage: inspectStorageArea("sessionStorage"),
    indexedDB: await inspectIndexedDb(),
  };

  try {
    await browser.runtime.sendMessage(report);
  } catch (_error) {
    // A extensão pode ter sido recarregada enquanto a página permanecia aberta.
  }
}

sendStorageReport();

