# Cloudflare Firestore compatibility findings

Status: diagnostic only; no production deployment and no Firebase changes.

## Evidence

Validated on 2026-11-22 in GitHub Actions run 45036439119 at commit
9347a18ec10ed6b9de4c251865e012863f2b1a59:

- `firebase-admin/app`: module import succeeds.
- `firebase-admin/auth`: module import succeeds.
- `node:crypto`: module import succeeds.
- `firebase-admin/firestore`: module import fails with
  `EvalError: Code generation from strings disallowed for this context`.
- Stack begins at `Function`, then `Codegen`, `Type.get`, `Field.resolve`,
  and `Namespace.resolveAll` in the bundled Worker. This is the protobuf
  dynamic-code-generation path loaded by the Firestore Admin dependency tree.
- Importing `web/src/lib/server/imi-api.ts` consequently fails; a GET to its
  POST-only route returns 500 rather than 405.
- Both health endpoints return 200. Next build and OpenNext Worker build pass.
- Android CI run 45036125197 completed successfully, including unit tests,
  debug APK assembly/upload, and connected Android emulator tests.

This proves the current Firestore Admin import path is incompatible with the
Cloudflare Workers runtime configuration used by this POC. It does not prove
that every Firebase Admin Auth runtime operation works in Workers: only module
loading was tested for Auth.

## Why a one-line import workaround is unsafe

`web/src/lib/server/imi-api.ts` directly depends on Firestore Admin in more
than the shared `StorePort` adapter. It also uses Firestore SDK document and
collection references, transactions, snapshots, server timestamps, numeric
increments, array unions, generated document IDs, and nested subcollections
through academy administration, enrollments, moderation, reports, and rate
limits. Removing only the Firestore import or replacing it with a stub would
break real operations and could weaken authorization or atomicity.

## Viable next implementation path

If continuing the Cloudflare POC, replace the Firestore Admin SDK boundary with
a small server-only Firestore REST adapter while retaining the existing
`StorePort` business logic where possible.

1. Obtain a short-lived Google OAuth access token at runtime by signing a
   service-account JWT assertion with Web Crypto. Read the service-account
   JSON only from a runtime secret; never commit it or log it.
2. Implement typed Firestore REST document encoding/decoding for strings,
   booleans, numbers, arrays, maps, timestamps, nulls, and the required
   server-side transforms (server timestamp, increment, array union).
3. Implement begin/commit transaction semantics and document get/create/set/
   update/delete. Preserve preconditions and transaction read-before-write
   ordering. Add query support for the active-calls lookup.
4. Migrate every direct Firestore SDK use in `imi-api.ts`, not just
   `makeStore` and rate limiting. Preserve the existing rate limits,
   authorization checks, moderation audit writes, and atomic updates.
5. Replace Admin Auth calls deliberately: verify ID tokens and evaluate
   teacher/admin claims; for the teacher-claim workflow, use the supported
   Identity Toolkit / Firebase Auth REST operation or keep that privileged
   operation on a trusted Node runtime. Do not assume successful module import
   proves runtime support.
6. Test the REST adapter against a disposable Firestore emulator or mocked
   REST transport, then rerun all existing Functions, rules, Playwright,
   Worker, and Android tests. No production database should be used in tests.

## Guardrails

- Keep this work on `feature/cloudflare-import-diagnostics` or a new isolated
  feature branch. Do not merge into the original PR branch automatically.
- Keep the import-diagnostics endpoint diagnostic-only; remove it before any
  production merge.
- No Firebase project/rules/data/auth changes, no Cloud Functions deployment,
  no Blaze upgrade, no paid host, no production deploy, and no PR merge without
  explicit owner approval.
- Do not claim Cloudflare support until the route returns the expected 405
  under local Worker preview and the complete test suite passes.

## Additional security constraint confirmed by source review

The existing Firestore rules deliberately deny client writes for server-owned workflows:
friend requests, statuses, friend relationships, course/lesson administration, learner
enrollments, reports, report-rate limits, and moderation logs. They also reserve
curriculum writes for users with the admin custom claim. Therefore, simply replacing
Admin SDK calls with Firestore REST requests authenticated by an ordinary Firebase
user ID token is not a compatible migration: most existing operations would be
rejected by Security Rules.

A Worker-side REST adapter that preserves the current server-authoritative behavior
would need privileged Google credentials at runtime (for example, a service-account
JWT exchange) and careful handling of Firebase Auth custom claims. Such credentials
must be configured as runtime secrets, never committed to Git or printed in logs.
No evidence in these CI runs establishes that the Cloudflare environment has those
credentials configured.

Consequently, the REST approach is conditional, not yet an approved or ready
implementation. If the owner will not configure a runtime secret, keep privileged
operations on an already trusted Node.js backend; do not weaken Firestore rules to
make the Worker pass. Do not create Cloud Functions or change the Firebase plan.

