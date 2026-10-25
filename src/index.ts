// The type lives in @auth/core, which every Auth.js framework package builds
// on -- next-auth for Next.js, @auth/express, @auth/sveltekit and the rest --
// so importing it here rather than from next-auth keeps this usable by all of
// them.
import type { OAuthConfig } from "@auth/core/providers";

/**
 * The claims SudaPass returns from `/oauth/me`.
 *
 * Which of these actually arrive depends on the scopes the client requests and
 * on what the person consented to: ask for `openid profile` alone and the
 * national id, address and passport claims will be absent.
 */
export interface SudapassProfile {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  /** Present only when the `national_id` scope was requested and granted. */
  national_id?: string;
  /** Older deployments spell it this way. */
  national_number?: string;
  birthdate?: string;
  gender?: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  phone_number_verified?: boolean;
  /** Absolute, or a path relative to the SudaPass host. */
  picture?: string;
  nationality?: string;
  [claim: string]: unknown;
}

/**
 * The user object this provider hands to NextAuth.
 *
 * NextAuth's own fields (`id`, `name`, `email`, `image`) are filled so the
 * session looks like any other provider's, and the rest keep their OIDC claim
 * names so there is nothing to memorise.
 */
export interface SudapassUser {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  national_id?: string;
  birthdate?: string;
  gender?: string;
  phone_number?: string;
  nationality?: string;
}

export interface SudapassConfig {
  /** Client id issued by SudaPass when the application is registered. */
  clientId: string;
  /**
   * OIDC issuer. Endpoints are discovered from
   * `{issuer}/.well-known/openid-configuration` unless `endpoints` is given.
   */
  issuer: string;
  /**
   * Host that serves the OAuth endpoints and relative picture paths. Defaults
   * to `issuer`; set it where SudaPass serves the two from different hosts.
   */
  baseUrl?: string;
  /**
   * Scopes to request. SudaPass releases a claim only when its scope is asked
   * for. The default covers sign-in and the national id, which is what most
   * applications integrate with SudaPass for; narrow it where the client was
   * not granted `national_id`, e.g. `"openid profile email"`.
   *
   * @default "openid profile email phone national_id"
   */
  scope?: string;
  /**
   * Endpoints, for deployments where discovery is unreachable. Any left out
   * fall back to `{baseUrl}/oauth/...`.
   */
  endpoints?: {
    authorization?: string;
    token?: string;
    userinfo?: string;
    jwks?: string;
  };
  /** Replace the default claim mapping with your own. */
  profile?: (profile: SudapassProfile) => Record<string, unknown>;
  /** Warn on claims an application commonly expects but did not receive. */
  debug?: boolean;
}

/**
 * Reads SudaPass's gender claim, which arrives in Arabic or English and in
 * either case. An unrecognised value is passed through rather than dropped:
 * losing the answer is worse than returning one the caller can inspect.
 */
export function normalizeSudapassGender(gender: unknown): string | undefined {
  if (typeof gender !== "string" || !gender.trim()) return undefined;

  const normalized = gender.trim().toLowerCase();
  if (["m", "male", "man", "ذكر", "رجل"].includes(normalized)) return "male";
  if (
    ["f", "female", "woman", "أنثى", "أنثي", "انثى", "انثي", "امرأة", "امراة"].includes(normalized)
  ) {
    return "female";
  }

  return gender;
}

/** A relative picture path resolved against the SudaPass host. */
function absolutePicture(picture: string | undefined, baseUrl: string): string | undefined {
  if (!picture) return undefined;
  if (/^https?:\/\//i.test(picture)) return picture;

  return `${baseUrl.replace(/\/+$/, "")}/${picture.replace(/^\/+/, "")}`;
}

/**
 * SudaPass as an Auth.js provider.
 *
 * Works anywhere Auth.js runs: Next.js (next-auth v5), Express
 * (\@auth/express), SvelteKit (\@auth/sveltekit), and the rest.
 *
 * SudaPass registers applications as public clients, so there is no secret to
 * keep: the exchange is protected by PKCE instead.
 *
 * @example
 * SudapassProvider({
 *   clientId: process.env.SUDAPASS_CLIENT_ID!,
 *   issuer: process.env.SUDAPASS_ISSUER!,
 * })
 */
export default function SudapassProvider(
  config: SudapassConfig,
): OAuthConfig<SudapassProfile> {
  const {
    clientId,
    issuer,
    baseUrl = issuer,
    scope = "openid profile email phone national_id",
    endpoints,
    profile: mapProfile,
    debug = false,
  } = config;

  if (!clientId) throw new Error("[sudapass] clientId is required");
  if (!issuer) throw new Error("[sudapass] issuer is required");

  const host = baseUrl.replace(/\/+$/, "");

  // Given explicitly only when asked for: otherwise NextAuth discovers them
  // from the issuer, which keeps working if SudaPass moves an endpoint.
  const explicit = endpoints
    ? {
        authorization: { url: endpoints.authorization ?? `${host}/oauth/authorize`, params: { scope } },
        token: { url: endpoints.token ?? `${host}/oauth/token` },
        userinfo: { url: endpoints.userinfo ?? `${host}/oauth/me` },
        jwks_endpoint: endpoints.jwks ?? `${host}/oauth/jwks`,
      }
    : { authorization: { params: { scope } } };

  return {
    id: "sudapass",
    name: "SUDAPASS",
    type: "oidc",
    issuer,
    clientId,
    idToken: true,
    checks: ["pkce", "state"],
    // A public client: SudaPass issues no secret.
    client: { token_endpoint_auth_method: "none" },
    ...explicit,

    profile(profile) {
      if (mapProfile) return mapProfile(profile) as never;

      const nationalId = profile.national_id || profile.national_number;
      if (debug && !nationalId) {
        console.warn(
          "[sudapass] no national id claim -- is the national_id scope requested?",
          { claims: Object.keys(profile).sort() },
        );
      }

      const user: SudapassUser = {
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        image: absolutePicture(profile.picture, host),
        national_id: nationalId,
        birthdate: profile.birthdate,
        gender: normalizeSudapassGender(profile.gender),
        phone_number: profile.phone_number,
        nationality: profile.nationality,
      };

      return user as never;
    },
  } as OAuthConfig<SudapassProfile>;
}
