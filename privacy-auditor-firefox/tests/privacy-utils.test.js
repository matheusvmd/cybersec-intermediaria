"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyCookie,
  classifyDomain,
  cookieKey,
  getRegistrableDomain,
} = require("../extension/privacy-utils.js");

const publicSuffixApi = {
  getDomain(hostname) {
    if (hostname.endsWith("example.co.uk")) {
      return "example.co.uk";
    }

    if (hostname.endsWith("github.io")) {
      return hostname.split(".").slice(-3).join(".");
    }

    return hostname.split(".").slice(-2).join(".");
  },
};

test("subdomínios do mesmo domínio registrável são primeira parte", () => {
  const result = classifyDomain(
    "app.example.co.uk",
    "cdn.example.co.uk",
    publicSuffixApi
  );

  assert.equal(result.pageDomain, "example.co.uk");
  assert.equal(result.resourceDomain, "example.co.uk");
  assert.equal(result.isThirdParty, false);
});

test("domínios registráveis diferentes são terceira parte", () => {
  const result = classifyDomain(
    "www.example.co.uk",
    "tracker.test",
    publicSuffixApi
  );

  assert.equal(result.isThirdParty, true);
  assert.equal(result.resourceDomain, "tracker.test");
});

test("sufixo privado mantém tenants diferentes como terceira parte", () => {
  const result = classifyDomain(
    "alice.github.io",
    "assets.bob.github.io",
    publicSuffixApi
  );

  assert.equal(result.pageDomain, "alice.github.io");
  assert.equal(result.resourceDomain, "bob.github.io");
  assert.equal(result.isThirdParty, true);
});

test("localhost, IPv4 e falha da publicSuffix usam fallback seguro", () => {
  const throwingApi = {
    getDomain() {
      throw new Error("indisponível");
    },
  };

  assert.equal(getRegistrableDomain("localhost", throwingApi), "localhost");
  assert.equal(getRegistrableDomain("127.0.0.1", throwingApi), "127.0.0.1");
  assert.equal(
    getRegistrableDomain("cdn.example.com", throwingApi),
    "example.com"
  );
});

test("cookie é classificado por parte e duração", () => {
  const firstParty = classifyCookie(
    { domain: ".cdn.example.co.uk", session: true },
    "shop.example.co.uk",
    publicSuffixApi
  );
  const thirdParty = classifyCookie(
    { domain: ".tracker.test", session: false },
    "shop.example.co.uk",
    publicSuffixApi
  );

  assert.deepEqual(firstParty, {
    domain: "cdn.example.co.uk",
    registrableDomain: "example.co.uk",
    isThirdParty: false,
    isSession: true,
  });
  assert.equal(thirdParty.isThirdParty, true);
  assert.equal(thirdParty.isSession, false);
});

test("chave de cookie distingue store, domínio, caminho e partição", () => {
  const base = {
    storeId: "firefox-default",
    domain: ".example.com",
    path: "/",
    name: "session",
  };

  assert.notEqual(cookieKey(base), cookieKey({ ...base, path: "/account" }));
  assert.notEqual(
    cookieKey(base),
    cookieKey({ ...base, partitionKey: { topLevelSite: "https://site.test" } })
  );
});
