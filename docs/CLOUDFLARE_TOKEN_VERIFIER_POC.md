# Cloudflare Firebase token-verifier proof of concept

Status: isolated branch-only experiment; not wired into production routes.

## What this change provides

- Verifies Firebase ID-token RS256 signatures with the Web Crypto API.
- Obtains Google's published Secure Token JWK set over HTTPS.
- Checks the Firebase project audience and issuer, subject, expiry, issue time, and authentication time.
- Returns only the verified Firebase UID.
- Does not import Firebase Admin SDK, gRPC, Node.js crypto, or any service-account secret.

## Important security boundary

This verifier does **not** check token revocation, disabled-user state, or custom claims. It must not be used as the sole authorization check for admin, teacher, account deletion, or other sensitive actions. Those routes remain on the existing trusted Node.js/Admin SDK path until a separate, reviewed design proves equivalent controls.

The JWK lookup is deliberately uncached in this first isolated proof. Before production use, add a bounded cache honoring Google's key rotation/cache headers and test rotation and outage behavior. Do not cache user authorization decisions.

## Verification

Run from `web/`:

```sh
npm run test:cloudflare-token
```

The test uses a locally generated RSA keypair and a mocked JWK endpoint. It does not contact Firebase, use production credentials, or modify Firebase data.

This proof does not establish that Firebase Admin SDK or Firestore transactions work in Cloudflare Workers. It is only the first independent building block for a future REST/Web-Crypto adapter.
