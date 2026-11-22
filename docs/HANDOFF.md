# IMI handoff — 2026-11-22

## Repository and owner constraints

- Repository: `walid1239/Imi-android`
- Working branch: `feature/imi-web-foundation`
- Application-code baseline validated here: `97b654e96665d1d947a8a6e2e97c9202765769bc`
- PR #2 is open, not merged; base: `feature/server-authoritative-status`.
- This handoff refresh is documentation-only; it does not change application source or runtime configuration.
- No Production deployment, PR merge, Firebase Console mutation, Firebase rules/index deployment, Blaze upgrade, payment card, paid service, or secret publication was performed.

Binding constraints: Firebase Spark only; do not invoke Cloud Functions; Next.js `/api/v1` is the trusted server layer; keep Storage-dependent uploads disabled until Spark eligibility is confirmed; do not switch Storage to Supabase without explicit owner approval; no WhatsApp OTP until the inbound flow is implemented and explicitly enabled; keep account deletion disabled until full verification.

## Work implemented and source evidence

| Review item | Current state at application baseline | Evidence and remaining limitation |
|---|---|---|
| 1. Android Functions calls and API URL | Android status/direct-conversation requests use the authenticated `ImiApiClient`; the Android build accepts an explicit HTTPS API origin through `IMI_API_BASE_URL`. | `IMIApp.kt`, `FirebaseChatRepository.kt`, `ImiApiClient.kt`, `app/build.gradle.kts`, `docs/FIRST_DEPLOY.md`. Build command documented as `./gradlew assembleDebug -PIMI_API_BASE_URL=https://<النطاق-الفعلي>`; no production host is hardcoded. No live server URL has been selected or tested. |
| 2. Reels upload | Android and Web Reels upload remain disabled with Arabic explanations pending Storage eligibility confirmation. | Android Reels UI and `web/src/components/reels-panel.tsx`. Read-only viewing remains separate from upload. |
| 3. Calls | Web call controls remain disabled and do not request microphone/camera permissions or send call requests. | `web/src/components/call-controls.tsx`. `respondToCall` handles terminal statuses idempotently through `terminalCallResponse`; two-device/two-network acceptance remains outstanding. |
| 4. Web Firebase Functions SDK | No Firebase Functions import/initialization or callable references remain in `web/src`. | Audited Web source; Firebase client no longer exports a Functions instance. Functions tests in CI use disposable emulators only; no Cloud Functions were deployed or invoked in the real project. |
| 5. Handoff | This file records the current validated code baseline, CI run IDs, security guardrails and remaining blockers. | Documentation-only refresh; application source is unchanged by this handoff update. |
| 6. Storage rules | Teacher-avatar read expression is explicitly grouped; Reels and teacher-verification paths bind Storage objects to Firestore metadata. | Firestore/Storage Emulator rules tests passed in Run 814. No rules were deployed to the real Firebase project; Storage Spark eligibility is still unconfirmed. |
| 7. CSP | Root layout uses dynamic rendering so Next.js can inject request nonces. CSP retains nonce-based scripts/styles and contains neither `unsafe-inline` nor `unsafe-eval`. | Playwright checks the actual `HTMLScriptElement.nonce` and stylesheet nonce against the CSP header. The trusted external Google SDK is allowed by its explicit `https://apis.google.com` origin. Web E2E: 38/38 passed. Real Google OAuth and Email Auth on the production domain remain unverified. |
| 8. Rate limits | Counter logic uses one hashed per-user/per-operation document with atomic window updates; limit, reset, rejection and concurrency tests exist. | `web/scripts/rate-limit.test.mjs`, `web/src/lib/server/rate-limit-core.mjs`, `docs/free-tier-rate-limits.md`. Firestore rules deny client access to `apiRateLimits`. |
| 9. Account deletion | API route exists but is disabled unless `IMI_ACCOUNT_DELETION_ENABLED=true`; default response is 503. | `functions/src/shared/accountDeletion.ts`, `web/src/lib/server/imi-api.ts`, `web/src/app/api/v1/account/delete/route.ts`, `scripts/test-account-deletion-emulator.cjs`. Keep the flag unset until full cleanup/failure verification and owner approval. |
| 10. Android metadata/release | Android profile writes include `updatedAt`; the Emulator rules test now covers the exact `users/{uid}/avatars/...` path used by Android and rejects a foreign user's path. Debug and Release builds pass. | `app/build.gradle.kts`, `app/src/main/java/**`, `tests/firestore.rules.test.mjs`. APK artifact is Firebase-configured and uploaded. The device smoke test is deliberately skipped for Firebase-configured APKs because `MainActivity` creates an anonymous Auth user on launch; do not run it against the real project in CI. No signed Release acceptance or physical-device test has been performed. |
| 11. Firebase setup | Login and Academy UI detect missing Firebase configuration and display setup guidance; build-only fallback is inert. | `web/src/lib/firebase/client.ts`, `web/src/app/login/page.tsx`, `web/src/components/firebase-config-required.tsx`. Real-project authentication has not been tested. |
| 12. Academy | Learner Web/Android-Web hierarchy remains level → track → subject → unit. Admins now have a protected batch-publish endpoint with dry-run, explicit confirmation, parent validation, 400-write batches and an audit log. Nameless nodes and lessons are not published/created. | `web/src/app/api/v1/admin/curriculum/publish/route.ts`, `web/src/lib/server/imi-api.ts`, `web/src/components/curriculum-admin-panel.tsx`, `web/e2e/server-api.spec.ts`. Playwright covers non-admin denial, hidden parent, dry-run, 404-node batch, nameless node and unchanged lesson count. Legacy teacher-application/content moderation actions are visibly disabled until their trusted IMI API routes exist; teacher drafts remain hidden from learners. |
| 13. Hosting proof | Cloudflare Firebase Admin compatibility with `verifyIdToken` plus Firestore write remains unproven; no Cloudflare deployment/test was performed. | `docs/FIRST_DEPLOY.md` documents Vercel Hobby only as a personal/non-commercial preview option under Vercel terms. No Vercel preview or Production deployment was created. Hobby is not an approved commercial hosting path. |
| 14. WhatsApp login | No WhatsApp OTP flow is exposed; no inbound Meta webhook/challenge implementation has been completed. | Keep phone login disabled. Signature validation, sender matching, single-use challenge, attempt limits and Custom Token flow remain outstanding. |
| 15. CI and deployment gates | Web CI and Firebase rules/deployment validation are green on the same code baseline. Android build/unit tests are green; Firebase-configured emulator launch is skipped to prevent real Auth writes. | `.github/workflows/web-ci.yml`, `.github/workflows/android-build.yml`, `.github/workflows/firebase-deploy.yml`. Google OIDC deployment credentials are optional; local Firebase CLI rules/index command is documented. All real deploy steps were skipped. |

## CI evidence for application-code baseline `97b654e96665d1d947a8a6e2e97c9202765769bc`

- Web CI: [Run 45006164052](https://github.com/walid1239/Imi-android/actions/runs/45006164052) — success. Web build, TypeScript, Functions tests, Firestore rules tests, Coturn validation and Playwright E2E all passed; Playwright reported **38 passed**.
- Android CI: [Run 45006164060](https://github.com/walid1239/Imi-android/actions/runs/45006164060) — success. Unit tests, Debug/Release builds and APK upload passed. The `Skip live-Firebase Android smoke test` step passed; `Run IMI on Android emulator` was intentionally skipped because this APK contains real Firebase configuration and MainActivity creates an anonymous Auth user on launch.
- APK artifact: `IMI-debug-apk-firebase-configured`, 23,571,480 bytes, SHA-256 `1e849792f86011123c193cc73a20f41e6399f0de3543cdd032b3d50e2aabbe13`. Artifact is attached to Android Run 45006164060 and expires 2026-12-06.
- Firebase rules/index workflow: [Run 45006164058](https://github.com/walid1239/Imi-android/actions/runs/45006164058) — success; protected deployment was skipped. No Firestore/Storage rules or indexes were deployed.
- A previous Android emulator attempt was cancelled during emulator startup: logs show ADB `device offline` and cancellation before `connectedDebugAndroidTest` ran. No app launch is recorded. The workflow guard was then added so Firebase-configured APKs are never launched against the real project in CI.
- These three successful workflow runs validate the same application-code baseline. PR #2 remains open and unmerged.

## Remaining release blockers

1. No Production deployment or real Firebase mutation has been performed. Do not deploy rules/indexes until the owner separately approves.
2. Real-project Google OAuth/Email Auth and admin claims have not been verified on the actual domain.
3. Complete teacher application, verification review, profile, content submission and moderation endpoints under `/api/v1`; keep the legacy buttons disabled and do not restore Firebase Functions client calls.
4. Confirm Firebase Spark Storage eligibility before enabling Storage-dependent uploads.
5. Complete account-deletion failure/retry tests and keep `IMI_ACCOUNT_DELETION_ENABLED` unset.
6. Prove Cloudflare Firebase Admin compatibility, or use Vercel Hobby only for personal/non-commercial preview. No host deployment has been performed.
7. Implement WhatsApp inbound login only after owner approval; keep phone login disabled.
8. Perform two-device/two-network call acceptance only after the call server API and media flow are implemented.
9. Complete signed Release APK acceptance; signing secrets must never enter the repository or logs.
10. Recheck Firebase Spark quotas before enabling dependent features.

## Free-tier and deployment guardrails

- Firebase Spark only: no Blaze, payment card, paid services, paid WhatsApp templates/outbound messages, or Cloud Functions deployment/invocations.
- No Production deployment, PR merge, Firebase Console mutation, or rules/index deployment without separate owner approval.
- Keep Reels and other unconfirmed Storage-dependent uploads disabled.
- Keep call controls disabled until the trusted API and WebRTC flow are ready.
- Keep account deletion disabled until full cleanup verification.
- Never run a Firebase-configured Android APK in CI against the real Auth project; the app currently creates anonymous Auth users at launch.
- A green subset of jobs is not a green workflow; require Web E2E and Android build/unit tests on the same application-code SHA. Physical-device runtime verification remains separate.
