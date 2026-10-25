# next-auth-sudapass

[SudaPass](https://sudapass.gov.sd) — Sudan's national identity provider — as a
[NextAuth v5](https://authjs.dev) provider.

SudaPass registers applications as **public clients**: there is no client secret
to keep, and the code exchange is protected by PKCE instead.

```bash
npm install next-auth-sudapass
```

## Usage

```ts
// auth.ts
import NextAuth from "next-auth";
import SudapassProvider from "next-auth-sudapass";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    SudapassProvider({
      clientId: process.env.SUDAPASS_CLIENT_ID!,
      issuer: process.env.SUDAPASS_ISSUER!,
    }),
  ],
});
```

```tsx
"use client";
import { signIn } from "next-auth/react";

<button onClick={() => signIn("sudapass", { callbackUrl: "/" })}>
  Sign in with SUDAPASS
</button>;
```

Register your callback with SudaPass as
`https://<your-domain>/api/auth/callback/sudapass`. Behind a reverse proxy, set
`AUTH_URL` to the public URL, or NextAuth will build that address from the
container's hostname and SudaPass will reject it.

## Options

| Option | Required | Description |
|---|---|---|
| `clientId` | yes | Issued by SudaPass when you register the application |
| `issuer` | yes | Endpoints are discovered from `{issuer}/.well-known/openid-configuration` |
| `baseUrl` | no | Host serving the OAuth endpoints and relative picture paths. Defaults to `issuer` |
| `scope` | no | Defaults to `"openid profile email phone"` |
| `endpoints` | no | Explicit endpoint URLs, for deployments where discovery is unreachable |
| `profile` | no | Replace the claim mapping with your own |
| `debug` | no | Warn when an expected claim is missing |

### Scopes decide which claims you get

SudaPass releases a claim only when its scope was requested. The default asks
for `openid profile email phone`; an application that needs the national id has
to ask for it:

```ts
SudapassProvider({
  clientId: process.env.SUDAPASS_CLIENT_ID!,
  issuer: process.env.SUDAPASS_ISSUER!,
  scope: "openid profile email phone national_id",
});
```

Other scopes seen in the wild: `address`, `passport`, `security_status`. Check
your client's discovery document for the list it supports, and ask only for
what you use.

## The user object

NextAuth's own fields are filled, and the rest keep their OIDC claim names:

| Field | From |
|---|---|
| `id` | `sub` |
| `name`, `email` | as returned |
| `image` | `picture`, resolved to an absolute URL |
| `national_id` | `national_id`, or `national_number` on older deployments |
| `birthdate`, `phone_number`, `nationality` | as returned |
| `gender` | normalised to `"male"` / `"female"` |

`gender` arrives in Arabic or English and in either case (`ذكر`, `M`, `Male`,
`امرأة`, …). A value this does not recognise is passed through unchanged rather
than dropped.

To shape the user differently, pass your own `profile`:

```ts
SudapassProvider({
  clientId,
  issuer,
  profile: (claims) => ({ id: claims.sub, fullName: claims.name }),
});
```

### Typing the session

NextAuth's `User` and `Session` types are yours to extend:

```ts
// types/next-auth.d.ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    national_id?: string;
    birthdate?: string;
    gender?: string;
    phone_number?: string;
    nationality?: string;
  }

  interface Session {
    user: User & DefaultSession["user"];
  }
}
```

## When discovery is unreachable

Some deployments cannot reach the discovery document. Give the endpoints
instead — anything omitted falls back to `{baseUrl}/oauth/...`:

```ts
SudapassProvider({
  clientId,
  issuer: "https://sudapass.gov.sd",
  endpoints: {
    authorization: "https://sudapass.gov.sd/oauth/authorize",
    token: "https://sudapass.gov.sd/oauth/token",
    userinfo: "https://sudapass.gov.sd/oauth/me",
    jwks: "https://sudapass.gov.sd/oauth/jwks",
  },
});
```

## Signing out

SudaPass publishes a revocation endpoint. To end the session there as well as
locally:

```ts
events: {
  async signOut(message) {
    if ("token" in message && message.token?.refresh_token) {
      await fetch(`${process.env.SUDAPASS_BASE_URL}/oauth/token/revocation`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: message.token.refresh_token as string,
          client_id: process.env.SUDAPASS_CLIENT_ID!,
          token_type_hint: "refresh_token",
        }),
      });
    }
  },
}
```

## Requirements

- `next-auth@5` (beta) as a peer dependency
- Node 18 or newer

## Licence

MIT
