# IMI handoff — 2026-11-21

## Repository and owner constraints

- Repository: `walid1239/Imi-android`
- Working branch: `feature/imi-web-foundation`
- Application-code baseline audited here: `d9f39b2fce619959a2a437984dd975b5d7192fae`
- PR #2 is open, not merged; base: `feature/server-authoritative-status`.
- This handoff refresh is documentation-only; it does not change application code.
- No Production deployment, PR merge, Firebase Console mutation, Firebase rules/index deployment, Blaze upgrade, payment card, paid service, or secret publication was performed.

Binding constraints: Firebase Spark only; do not invoke Cloud Functions; Next.js `/api/v1` is the intended trusted server layer; keep Storage-dependent uploads disabled until Spark availability is confirmed; do not switch Storage to Supabase without explicit owner approval; no WhatsApp OTP until the inbound flow is implemented and explicitly enabled; keep account deletion disabled until full verification.

## Work implemented and source evidence

| Review item | Current state at application baseline | Evidence and remaining limitation |
|---|---|---|
| 1. Android Functions calls | Migrated status and direct-conversation requests to the authenticated `ImiApiClient`; Android Functions dependency removed. | `IMIApp.kt`, `FirebaseChatRepository.kt`, `ImiApiClient.kt`, `app/build.gradle.kts`. Client uses HTTPS BuildConfig base URL, Firebase ID-token Bearer auth, JSON POST and Arabic error mapping. Unit tests in `ImiApiHttpTest.kt`; execution awaits Android CI. |
| 2. Reels upload | Android and Web Reels upload are disabled with Arabic explanations pending Storage eligibility confirmation. | Android Reels UI and `web/src/components/reels-panel.tsx`. Read-only viewing remains separate from upload. |
| 3. Calls | Web call controls are disabled and do not request microphone/camera permissions or send call requests. | `web/src/components/call-controls.tsx`. `respondToCall` handles terminal statuses idempotently through `terminalCallResponse`; unit tests exist in `functions/test/callLogic.test.cjs`. |
| 4. Web Firebase Functions SDK | No Firebase Functions import/initialization or callable references remain in `web/src`. | Audited Web source; Firebase client no longer exports a Functions instance. |
| 5. Handoff | Updated in this documentation-only commit to record the actual application baseline, evidence and unresolved work. | No application source changed in this handoff refresh. |
| 6. Storage rules | Teacher avatar read expression is explicitly grouped; Reels and teacher-verification paths bind Storage objects to Firestore metadata. | `storage.rules`; Storage/Firestore Emulator test workflow is pending at the latest baseline. No rules were deployed to the real Firebase project. |
| 7. CSP | CSP allows the required Firebase Auth and Google endpoints, uses nonce-based scripts/styles, and contains neither `unsafe-inline` nor `unsafe-eval`; no broad `*.vercel.app` source remains. | `web/src/middleware.ts`. Real Google OAuth and Email Auth on the configured production domain have not been verified in a real browser. |
| 8. Rate limits | Counter logic uses one hashed per-user/per-operation document with atomic window updates; limit, reset, rejection and concurrency tests exist. | `web/scripts/rate-limit.test.mjs`, `web/src/lib/server/rate-limit-core.mjs`, `docs/free-tier-rate-limits.md`. Firestore rules deny client access to `apiRateLimits`. The documented Spark daily write quota is 20,000; rate-limit writes are additional to domain writes. |
| 9. Account deletion | API route exists but is disabled unless `IMI_ACCOUNT_DELETION_ENABLED=true`; default response is 503. Cleanup covers conversations, calls/subcollections, friends/blocks, reports, teacher sessions/outbox, rate-limit docs and scoped Storage paths. | `functions/src/shared/accountDeletion.ts`, `web/src/lib/server/imi-api.ts`, `web/src/app/api/v1/account/delete/route.ts`, `scripts/test-account-deletion-emulator.cjs`. Emulator test includes Storage-delete failure propagation. Keep the flag false until the test passes and all partial-failure cases are reviewed. |
| 10. Android metadata/release | Audited Kotlin writes to `users/{uid}`; profile writes include `updatedAt`. Release minification/resource shrinking and environment-only signing configuration are present. | `app/build.gradle.kts`, `app/src/main/java/**`. WhatsApp package visibility is not added because WhatsApp login has not been implemented. No signed Release APK acceptance has been performed. |
| 11. Firebase setup | Login and Academy UI detect missing Firebase configuration and display setup guidance; build-only fallback is inert, not a real project connection. | `web/src/lib/firebase/client.ts`, `web/src/app/login/page.tsx`, `web/src/components/firebase-config-required.tsx`. Real-project auth still requires valid public environment variables. |
| 12. Academy | Learner-facing Web and Android-Web screens use the hierarchy: level → track → subject → unit. Empty subject displays “لا وحدات بعد” and “لا دروس بعد”; old course/lesson panel was removed from learner views. | `web/src/components/curriculum-browser.tsx`, `web/src/app/academy/page.tsx`, `web/src/app/app/page.tsx`, `web/e2e/academy.spec.ts`, isolated empty-subject fixture in `functions/scripts/seed-e2e.cjs`. Teacher publishing is not yet available through the new API; do not expose or enable the legacy callable actions. Existing trusted teacher logic requires `teacherVerified`, but it still needs migration to `/api/v1`. |
| 13. Hosting proof | Cloudflare Firebase Admin compatibility has not been proven with `verifyIdToken` plus Firestore write. | No Cloudflare deployment/test was performed. Vercel Hobby preview eligibility and commercial-use terms have not been confirmed; no Production deployment. |
| 14. WhatsApp login | No WhatsApp OTP flow is exposed; no inbound Meta webhook/challenge implementation has been completed. | Keep phone login disabled. Required signature validation, sender matching, six-digit single-use challenge, attempt limit and Custom Token flow remain outstanding. |
| 15. CI duplication/gates | Push workflows now run on `main/master`; feature branches are validated by PR workflows, avoiding simultaneous push+PR duplicate runs. | `.github/workflows/web-ci.yml`, `.github/workflows/android-build.yml`, `.github/workflows/firebase-deploy.yml`. Manual dispatch remains available. Do not declare release readiness until Web E2E and Android tests pass on the same HEAD. |

## CI evidence for application-code baseline `d9f39b2fce619959a2a437984dd975b5d7192fae`

- Web CI: [Run 44955486004](https://github.com/walid1239/Imi-android/actions/runs/44955486004). At last check: `web`, `functions`, `rules`, and Coturn jobs passed; Playwright emulator E2E was still running. Therefore Web CI was not yet fully green.
- Android CI: [Run 44955486002](https://github.com/walid1239/Imi-android/actions/runs/44955486002). Firebase security rules tests passed; Android unit tests/build were still running. Therefore Android CI was not yet fully green.
- Firebase rules/index workflow: [Run 44955486098](https://github.com/walid1239/Imi-android/actions/runs/44955486098) — success; protected deploy job was skipped. No Firestore rules/index deployment occurred.
- The Web and Android workflow runs above are the single PR-triggered runs after duplicate push/PR triggers were removed. Re-query them before asserting final completion.

## Remaining release blockers

1. Wait for Playwright E2E and Android unit/build/emulator jobs on the current baseline; fix failures and rerun.
2. Complete teacher application, verification review, profile, content submission and moderation endpoints under `/api/v1`; preserve verified-teacher-only publishing. Do not restore Firebase Functions client calls.
3. Finish Storage rules Emulator regression tests for all metadata-bound paths; Storage Spark eligibility remains unconfirmed.
4. Complete real-browser Google OAuth and Email Auth verification against the configured project/domain.
5. Complete account deletion failure/retry tests and keep `IMI_ACCOUNT_DELETION_ENABLED` false.
6. Prove Cloudflare Firebase Admin compatibility, or document a verified free preview host and its actual plan restrictions. No hosting claim is currently proven.
7. Implement WhatsApp inbound login only after owner approval; keep phone login disabled in the meantime.
8. Perform two-device/two-network call acceptance only after the call server API and media flow are implemented.
9. Build and verify a signed Release APK; no signing secrets may enter the repository or logs.
10. Recheck Firebase Spark quotas and Storage availability before enabling dependent features.

## Free-tier and deployment guardrails

- No Blaze, payment card, paid services, paid WhatsApp templates/outbound messages, or Cloud Functions invocations.
- No Production deployment, PR merge, Firebase Console mutation, or rules/index deployment without separate owner approval.
- Keep Reels and other unconfirmed Storage-dependent uploads disabled.
- Keep call controls disabled until the trusted API and WebRTC flow are ready.
- Keep account deletion disabled until full cleanup verification.
- A green subset of jobs is not a green workflow; require Playwright E2E and Android tests to finish successfully on the same final application SHA.
