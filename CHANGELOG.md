# Changelog

## 0.3.0

First release meant for use outside the project it was written for.

### Breaking

- **Claims use their standard names.** `phone` is now `phone_number` and
  `birthDate` is now `birthdate`, matching OIDC; `id` is filled from `sub` so
  the session looks like any other NextAuth provider's. Applications reading
  the old names must be updated, or pass their own `profile` mapping.
- **Endpoints are discovered from the issuer** rather than built from
  `baseUrl`. Pass `endpoints` where discovery cannot be reached.
- **`baseUrl` is optional** and defaults to `issuer`. It now only serves
  explicit endpoints and relative picture paths.

- **Not tied to Next.js.** The provider type comes from `@auth/core` rather
  than `next-auth`, and `@auth/core` is the peer dependency, so the package
  works with `@auth/express`, `@auth/sveltekit` and the rest. Next.js users
  need no change: `next-auth` depends on `@auth/core` already.

### Added

- `profile` option, to replace the claim mapping without forking.
- `endpoints` option, for deployments where discovery is unavailable.
- `normalizeSudapassGender` is exported.
- Settings are checked: a missing `clientId` or `issuer` throws at construction
  rather than failing mid sign-in.
- Tests, and an MIT licence.

### Changed

- The default scope stays `openid profile email phone`. Claims such as
  `national_id` are released only when their scope is requested, so
  applications needing them must say so in `scope`.
- An unrecognised gender is passed through instead of being dropped.

## 0.2.0

- SudaPass OIDC provider for NextAuth v5, as a public client using PKCE.
