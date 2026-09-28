"use strict";

(() => {
  const EVENT_NAME = "privacy-auditor:page-observation";
  const INSTALL_KEY = Symbol.for("privacy-auditor.page-bridge.installed");
  const ALLOWED_KINDS = new Set([
    "canvas_read",
    "network_api_call",
    "websocket",
    "dynamic_script",
    "hook_replaced",
  ]);

  if (globalThis[INSTALL_KEY]) {
    return;
  }
  globalThis[INSTALL_KEY] = true;

  function shortString(value, maximumLength) {
    return typeof value === "string" ? value.slice(0, maximumLength) : "";
  }

  window.addEventListener(
    EVENT_NAME,
    (event) => {
      try {
        if (typeof event.detail !== "string" || event.detail.length > 10000) {
          return;
        }

        const detail = JSON.parse(event.detail);
        if (!detail || !ALLOWED_KINDS.has(detail.kind)) {
          return;
        }

        const stack = Array.isArray(detail.stack)
          ? detail.stack
              .filter((line) => typeof line === "string")
              .slice(0, 6)
              .map((line) => line.slice(0, 300))
          : [];

        browser.runtime
          .sendMessage({
            type: "PAGE_OBSERVATION",
            kind: detail.kind,
            timestamp: Number.isFinite(detail.timestamp)
              ? detail.timestamp
              : Date.now(),
            origin: shortString(detail.origin, 2048),
            method: shortString(detail.method, 40),
            api: shortString(detail.api, 40),
            url: shortString(detail.url, 2048),
            target: shortString(detail.target, 120),
            scriptUrl: shortString(detail.scriptUrl, 500),
            inline: Boolean(detail.inline),
            module: Boolean(detail.module),
            async: Boolean(detail.async),
            stack,
          })
          .catch(() => {
            // A extensão pode ter sido recarregada durante a navegação.
          });
      } catch (_error) {
        // Eventos inválidos ou forjados pela página são descartados.
      }
    },
    true
  );
})();
