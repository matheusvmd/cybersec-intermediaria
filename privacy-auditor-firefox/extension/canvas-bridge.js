"use strict";

(() => {
  const EVENT_NAME = "privacy-auditor:canvas-read";
  const INSTALL_KEY = Symbol.for("privacy-auditor.canvas-bridge.installed");
  const ALLOWED_METHODS = new Set(["toDataURL", "toBlob", "getImageData"]);

  if (globalThis[INSTALL_KEY]) {
    return;
  }
  globalThis[INSTALL_KEY] = true;

  window.addEventListener(
    EVENT_NAME,
    (event) => {
      try {
        if (typeof event.detail !== "string" || event.detail.length > 5000) {
          return;
        }

        const detail = JSON.parse(event.detail);
        if (!detail || !ALLOWED_METHODS.has(detail.method)) {
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
            type: "CANVAS_READ",
            method: detail.method,
            timestamp: Number.isFinite(detail.timestamp)
              ? detail.timestamp
              : Date.now(),
            origin:
              typeof detail.origin === "string"
                ? detail.origin.slice(0, 2048)
                : "Origem indisponível",
            frame: detail.frame === "principal" ? "principal" : "secundário",
            stack,
            scriptUrl:
              typeof detail.scriptUrl === "string"
                ? detail.scriptUrl.slice(0, 500)
                : "",
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

