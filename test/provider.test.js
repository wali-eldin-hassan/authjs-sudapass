import { test } from "node:test";
import assert from "node:assert/strict";
import SudapassProvider, { normalizeSudapassGender } from "../dist/index.js";

const base = { clientId: "client_x", issuer: "https://sudapass.example" };
const profileOf = (claims, config = {}) =>
  SudapassProvider({ ...base, ...config }).profile(claims);

test("discovers endpoints from the issuer by default", () => {
  const provider = SudapassProvider(base);
  assert.equal(provider.issuer, "https://sudapass.example");
  assert.equal(provider.authorization.url, undefined, "no explicit URL, so NextAuth discovers it");
  assert.equal(provider.authorization.params.scope, "openid profile email phone national_id");
});

test("uses explicit endpoints when discovery is unreachable", () => {
  const provider = SudapassProvider({ ...base, endpoints: { token: "https://alt/oauth/token" } });
  assert.equal(provider.token.url, "https://alt/oauth/token");
  assert.equal(provider.authorization.url, "https://sudapass.example/oauth/authorize", "the rest fall back");
});

test("is a public client protected by PKCE", () => {
  const provider = SudapassProvider(base);
  assert.equal(provider.client.token_endpoint_auth_method, "none");
  assert.deepEqual(provider.checks, ["pkce", "state"]);
});

test("maps claims to standard names", () => {
  const user = profileOf({
    sub: "abc",
    name: "محمد عثمان",
    email: "a@b.sd",
    birthdate: "1990-05-12",
    phone_number: "+249912345678",
    nationality: "SDN",
    national_id: "12345678901",
  });
  assert.equal(user.id, "abc");
  assert.equal(user.phone_number, "+249912345678", "OIDC spelling, not `phone`");
  assert.equal(user.birthdate, "1990-05-12");
  assert.equal(user.national_id, "12345678901");
  assert.equal(user.nationality, "SDN");
});

test("falls back to the older national_number spelling", () => {
  assert.equal(profileOf({ sub: "a", national_number: "99" }).national_id, "99");
});

test("resolves a relative picture against the host", () => {
  assert.equal(profileOf({ sub: "a", picture: "/media/p.jpg" }).image, "https://sudapass.example/media/p.jpg");
  assert.equal(profileOf({ sub: "a", picture: "https://cdn/p.jpg" }).image, "https://cdn/p.jpg");
  assert.equal(
    profileOf({ sub: "a", picture: "/p.jpg" }, { baseUrl: "https://files.sudapass.example/" }).image,
    "https://files.sudapass.example/p.jpg",
    "baseUrl may differ from the issuer",
  );
});

test("a custom mapping replaces the default", () => {
  const user = profileOf({ sub: "a", name: "x" }, { profile: (p) => ({ id: p.sub, who: p.name }) });
  assert.deepEqual(user, { id: "a", who: "x" });
});

test("reads gender in either language and keeps what it cannot place", () => {
  for (const male of ["M", "male", "Man", "ذكر", "رجل"]) assert.equal(normalizeSudapassGender(male), "male");
  for (const female of ["f", "FEMALE", "woman", "أنثى", "انثي", "امرأة"]) {
    assert.equal(normalizeSudapassGender(female), "female");
  }
  assert.equal(normalizeSudapassGender("x"), "x", "unknown values survive rather than vanish");
  assert.equal(normalizeSudapassGender(undefined), undefined);
  assert.equal(normalizeSudapassGender(""), undefined);
});

test("refuses to build without the required settings", () => {
  assert.throws(() => SudapassProvider({ issuer: "https://x" }), /clientId is required/);
  assert.throws(() => SudapassProvider({ clientId: "c" }), /issuer is required/);
});
