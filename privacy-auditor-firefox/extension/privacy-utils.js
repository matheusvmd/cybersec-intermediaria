"use strict";

(function exposePrivacyUtils(root, factory) {
  const privacyUtils = factory();

  root.PrivacyUtils = privacyUtils;

  if (typeof module === "object" && module.exports) {
    module.exports = privacyUtils;
  }
})(typeof globalThis === "object" ? globalThis : this, () => {
  function normalizeHostname(hostname) {
    return String(hostname || "")
      .trim()
      .toLowerCase()
      .replace(/^\./, "")
      .replace(/\.$/, "");
  }

  function isIpAddress(hostname) {
    const normalized = normalizeHostname(hostname).replace(/^\[|\]$/g, "");

    if (normalized.includes(":")) {
      return true;
    }

    const parts = normalized.split(".");
    return (
      parts.length === 4 &&
      parts.every(
        (part) => /^\d{1,3}$/.test(part) && Number(part) <= 255
      )
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

  function getRegistrableDomain(hostname, publicSuffixApi) {
    const normalized = normalizeHostname(hostname);

    if (!normalized || normalized === "localhost" || isIpAddress(normalized)) {
      return normalized;
    }

    try {
      if (publicSuffixApi && typeof publicSuffixApi.getDomain === "function") {
        const domain = publicSuffixApi.getDomain(normalized);
        if (domain) {
          return normalizeHostname(domain);
        }
      }
    } catch (_error) {
      // O fallback mantém a classificação disponível sem a API do Firefox.
    }

    return fallbackRegistrableDomain(normalized);
  }

  function classifyDomain(pageHostname, resourceHostname, publicSuffixApi) {
    const pageDomain = getRegistrableDomain(pageHostname, publicSuffixApi);
    const resourceDomain = getRegistrableDomain(
      resourceHostname,
      publicSuffixApi
    );

    return {
      pageDomain,
      resourceDomain,
      isThirdParty: Boolean(
        pageDomain && resourceDomain && pageDomain !== resourceDomain
      ),
    };
  }

  function classifyCookie(cookie, pageHostname, publicSuffixApi) {
    const cookieHostname = normalizeHostname(cookie && cookie.domain);
    const classification = classifyDomain(
      pageHostname,
      cookieHostname,
      publicSuffixApi
    );

    return {
      domain: cookieHostname,
      registrableDomain: classification.resourceDomain,
      isThirdParty: classification.isThirdParty,
      isSession: Boolean(cookie && cookie.session),
    };
  }

  function cookieKey(cookie) {
    const partitionKey = cookie && cookie.partitionKey;
    const partition = partitionKey
      ? JSON.stringify(partitionKey)
      : String((cookie && cookie.firstPartyDomain) || "");

    return [
      String((cookie && cookie.storeId) || ""),
      normalizeHostname(cookie && cookie.domain),
      String((cookie && cookie.path) || "/"),
      String((cookie && cookie.name) || ""),
      partition,
    ].join("\n");
  }

  return {
    classifyCookie,
    classifyDomain,
    cookieKey,
    fallbackRegistrableDomain,
    getRegistrableDomain,
    isIpAddress,
    normalizeHostname,
  };
});

