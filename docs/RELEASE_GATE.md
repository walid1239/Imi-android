# IMI release gate — no-billing preparation

**Current status: NOT READY FOR PRODUCTION. Preview only. No production deployment is authorized.**

## Binding architecture and billing rules

- Firebase plan remains Spark. Do not link a payment card, enable Blaze, create paid resources, or accept a paid upgrade.
- Do not deploy or invoke Cloud Functions. All trusted application endpoints must be implemented under Next.js `/api/v1` and call shared, runtime-independent core logic.
- Hosting decision: Cloudflare first, but only after an actual deployment/runtime proof that Firebase Admin can verify an ID token (`verifyIdToken`) and perform a Firestore write from the Cloudflare runtime. Emulator tests or a successful build are not that proof. If this cannot be demonstrated, use Vercel Hobby for preview only and document plan eligibility, commercial-use restrictions, and usage limits before any public/commercial launch.
- Storage adapter default is `firebase`. Keep uploads and dependent features disabled if the selected Firebase plan does not provide eligible Storage access. Do not enable Supabase until the owner explicitly confirms Firebase Storage is unavailable and approves the switch. Disable a feature before a free quota is exceeded; never upgrade automatically.
- Phone login remains `PHONE_LOGIN_ENABLED=false`. WhatsApp inbound verification must use the reviewed six-digit, single-use challenge design. No paid message templates or paid outbound messages.
- Academy is a curriculum hierarchy only (levels, tracks, subjects, units). Do not seed lessons. Only verified teachers or administrators may create content; the initial public state must honestly say **لا دروس بعد**.

## Release blockers — all required before production

### Backend and data

- [ ] No Android or Web client imports or calls Firebase Cloud Functions.
- [ ] Android `createStatus`, `createOrGetDirectConversation`, and `submitReel` use HTTPS `/api/v1` with `Authorization: Bearer <Firebase ID token>`; every route has emulator/unit tests. Storage-dependent reel upload remains disabled until a permitted storage backend is confirmed.
- [ ] Web Firebase client no longer imports/exports Firebase Functions.
- [ ] Rate limiting persists in Firestore with transactionally enforced per-UID windows; tests prove threshold rejection, concurrency safety, and window reset.
- [ ] Reels query composite index (`status ASCENDING, createdAt DESCENDING`) exists and is validated.
- [ ] `respondToCall` is idempotent when the call is already ended/rejected.
- [ ] Firestore/Storage rules have explicit parentheses, metadata ownership/publish checks, valid public-profile photo paths, and regression tests for legacy-chat blocks.
- [ ] Account deletion is disabled behind a feature flag until complete cross-document, nested-collection, Storage, and cross-user cleanup is implemented and failure-tested. Storage errors must not be swallowed.
- [ ] App Check is documented as a currently accepted risk, with a concrete later enforcement plan and no false claim that it is enabled.
- [ ] Academy has no seeded lessons and no unverified-teacher publishing path.

### Web security and UX

- [ ] CSP, X-Frame-Options, Referrer-Policy, and X-Content-Type-Options are present and verified in browser tests.
- [ ] When Firebase public configuration is incomplete, the UI displays an explicit setup-required state; a localhost/build fallback must never masquerade as a configured app.
- [ ] Dead phone OTP form and stale “بدون OTP” text are removed while the guest-auth flow remains accurately described.
- [ ] Public Academy pages show the empty curriculum structure and **لا دروس بعد**; authoring is restricted to verified teachers/admins.

### Android

- [ ] Android camera/microphone permissions are requested at runtime only if a supported call flow exists. Otherwise remove those permissions and clearly label Android calls as not ready.
- [ ] Every Android write to `users/{uid}` includes server-compatible `updatedAt`; audit all call sites and test the contract.
- [ ] WhatsApp package visibility includes `com.whatsapp` and `com.whatsapp.w4b`; `isWhatsAppInstalled` is covered by tests when the WhatsApp login path is implemented.
- [ ] Cleartext HTTP is disabled; all production API endpoints require HTTPS.
- [ ] Release builds enable minification and ProGuard/R8. Signing configuration reads environment variables only; no signing key or password is committed or logged. A debug APK is not a Release acceptance test.

### WhatsApp inbound login

- [ ] Feature flag defaults to false and is checked server-side.
- [ ] Challenge nonce is stored only as a hash, expires after 10 minutes, and is single-use.
- [ ] Webhook validates Meta `X-Hub-Signature-256` with constant-time comparison and matches `messages[].from`, not `contacts[].wa_id`.
- [ ] The six-digit code is sent only as an inbound-window reply (no paid templates), expires in 24 hours, allows at most five attempts, and is never logged.
- [ ] Successful verification derives the stable UID from the normalized phone hash, mints a Firebase Custom Token server-side, and the client calls `signInWithCustomToken`.
- [ ] Provider adapter defaults to mock; WhatsApp Cloud adapter is disabled until credentials and webhook verification are configured. Telegram adapter is structure-only. Fixtures cover malformed, replayed, wrong-sender, invalid-signature, expired, and successful messages.

### CI and deployment controls

- [ ] Web CI and Android CI both complete green on the exact final SHA. Record Run IDs and job conclusions.
- [ ] actionlint validates all workflow YAML.
- [ ] Firebase CLI version is pinned to a current tested version; Node 20 is not used for any Functions runtime. No Functions deployment job exists.
- [ ] Preview deployment only, with secrets stored in the hosting provider's encrypted environment. Verify free-tier eligibility and quotas; stop before any paid threshold.
- [ ] Firestore rules/indexes deployment is manual only: workflow_dispatch, exact `DEPLOY` confirmation, protected `firebase-production` environment, pre-deploy Emulator tests, and owner approval. This workflow must never deploy Functions.
- [ ] No production deploy, Firebase rules/index deploy, or PR merge without separate explicit owner authorization.

### Final acceptance and operational checks

- [ ] Firestore/Storage Emulator rules suite passes, including all new regression tests.
- [ ] Playwright E2E covers sign-in, profile, chat, blocking, status, Academy empty state, teacher authorization, and all enabled flows.
- [ ] Two physical devices complete call tests on two independent networks (Wi-Fi and cellular), with verified audio/video and relay behavior. If not, calls remain disabled/not ready.
- [ ] Secret scanning finds no credentials, private keys, tokens, or signing files in Git history/artifacts/logs.
- [ ] Free-tier review records the current plan, quota ceilings, expected usage, and server-side feature flags that stop usage before charges can occur.
- [ ] Privacy, terms, account retention/deletion policy, moderation, child safety, and verified-teacher operations receive human review.
- [ ] A signed Release APK is built from the exact release SHA and installed/launched on supported physical Android devices.

## Test commands

Run on the exact candidate commit:

```bash
npm ci --no-audit --no-fund
npm run emulators:test
cd web
npm ci --no-audit --no-fund
npm run typecheck
npm run lint
npm run build
npm run test:health
npm run e2e
cd ..
cd app
./gradlew testDebugUnitTest assembleDebugAndroidTest
```

CI may run additional integration checks. Record actual command output or CI Run IDs; do not infer success from a queued, cancelled, skipped, or build-only job. Emulator evidence does not prove real Firebase connectivity.

## Current evidence and handoff

See [HANDOFF.md](./HANDOFF.md) for the exact working branch, commits, CI states, completed source edits, and remaining blockers. The current changes are preparation only. No production Firebase state has been changed.
