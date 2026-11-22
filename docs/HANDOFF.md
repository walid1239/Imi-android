# IMI handoff — 2026-11-22

## Latest audit follow-up — 2026-11-22

### Exact source and CI evidence

- Audited source SHA: `d685d28c64545e7bb32446b624a3c3fdf0767846` on `work/imi-web-foundation-audit-fixes`.
- PR #5: [Draft, open, unmerged](https://github.com/walid1239/Imi-android/pull/5), based on `feature/imi-web-foundation` at `106d656c044769828065b5bf5d76998820d27880`. PR #2 also remains open and unmerged. Neither PR was merged.
- Web CI for the exact audited SHA: [Run 45066815146](https://github.com/walid1239/Imi-android/actions/runs/45066815146) — **success**. Jobs `functions`, `rules`, `web`, Coturn validation, and Playwright all succeeded. Playwright reported **46 passed**. The Web job ran typecheck, rate-limit tests, `npm run test:env` (**7 passed, 0 failed**), production build, and health smoke.
- Android CI for the same exact SHA: [Run 45066815157](https://github.com/walid1239/Imi-android/actions/runs/45066815157) — **success**. Firebase security rules tests, Android unit tests, and debug APK assembly passed. Live-Firebase smoke was explicitly skipped; Android emulator launch was skipped.
- Debug artifact: `IMI-debug-apk-firebase-configured`, [artifact 14772135794](https://github.com/walid1239/Imi-android/actions/runs/45066815157) — 23,571,479 bytes; archive digest `sha256:2e3f39427871f266fa2b5b171aff149114f739958f9cc16808c5aff8fcb988a3`; expires 2026-12-06 20:34 UTC. This is a Debug artifact, not a signed Release APK or physical-device acceptance.
- Next.js config includes `import path from 'node:path'` and `outputFileTracingRoot: path.join(process.cwd(), '..')`. The production Next.js build succeeded in Web CI on the audited SHA. **A separate local `npm run build` was not executed** because this environment did not have a local checkout and repository cloning was blocked by network/DNS failure. Do not describe local build validation as completed.
- Imported shared server modules under `functions/src/shared` are consumed by the Next.js server API; their runtime dependencies are covered by the Web CI install/typecheck/build. This is not a proof of deployment on an external hosting runtime.
- `web/scripts/check-env.mjs` runs only when `VERCEL=1` or `CHECK_PRODUCTION_ENV=true`; local unconfigured builds remain silent. Production checks require the six public Firebase Web variables, `FIREBASE_PROJECT_ID=imi-indroid`, valid service-account JSON for the same project, and reject enabled Firebase Emulator variables. The seven automated tests cover local no-env success, explicit missing-env failure, valid synthetic Vercel configuration, wrong project, enabled Emulator rejection, malformed service-account JSON without leaking its content, and a service account for the wrong project. No real credential was used or printed.
- The teacher application UI is available at `/teacher/apply`. It collects full name, HTTPS proof URL, published curriculum level and subject selections, obtains a Firebase ID token, and posts to `/api/v1/teachers/applications`; it does not upload files. Playwright E2E covers invalid HTTP proof rejection, successful application creation, authenticated admin API approval, Firestore application status, moderation audit, and Auth Emulator claims `teacher: true` and `teacherVerified: true`. Separate browser tests cover the admin UI's approve/reject controls, learner visibility, and unauthorized API rejection.
- Legacy callable operations still not migrated are listed below; do not enable or deploy them as a workaround.
- The Arabic owner runbook is `docs/DEPLOY_PREVIEW.md`. It describes Vercel Hobby only for personal/non-commercial preview and does not perform a deployment.
- No Production deployment, Firebase Console mutation, Firestore/Storage rules or index deployment, Cloud Functions deployment or real-project invocation, billing upgrade, paid service, PR merge, or secret change was performed. `docs/RELEASE_GATE.md` remains **NOT READY FOR PRODUCTION**. Emulator and CI evidence is not equivalent to live-Firebase or physical-device acceptance.

### Legacy callable inventory — not migrated

The following legacy callable operations remain in the Functions source but are not exposed as Web client callables and do not have replacement routes in the current `/api/v1` operation allowlist:

| Legacy callable | Current disposition |
|---|---|
| `saveTeacherProfile` | Not migrated; teacher profile editing remains disabled. |
| `createTeacherContent` | Not migrated; teacher content submission remains disabled. |
| `reviewTeacherContent` | Not migrated; teacher content moderation remains disabled. |
| `scheduleTeacherLiveSession` | Not migrated; real teacher live-session scheduling remains disabled. |
| `reviewContentReport` | Not migrated; content-report review remains disabled. |
| `publishCourse` | Not migrated; legacy course publishing is not the current curriculum-hierarchy publish workflow. |
| `publishCourseLesson` | Not migrated; legacy course/lesson publishing remains disabled. |
| `createCourse` / `createCourseLesson` | Not migrated; no replacement course/lesson authoring workflow is approved. |

Teacher application submission and review are implemented through authenticated Next.js `/api/v1` routes and shared server logic. The Web Firebase client does not import or initialize Firebase Functions. Do not call or deploy legacy Functions as a shortcut.

### Preview and owner-operated setup boundary

- The Arabic owner runbook is `docs/DEPLOY_PREVIEW.md`. Vercel Hobby is documented only for personal/non-commercial evaluation; it is not an approved commercial hosting path.
- Firestore rules/index deployment, admin-claim provisioning, and any production curriculum seed remain owner-operated actions requiring separate explicit approval. Do not run production mode of `scripts/seed-curriculum.cjs` during this audit.
- Curriculum imports through the admin UI are additive and create nodes hidden with `needsReview: true`; preview publishing is a dry-run. Do not publish a level or approve nodes until the owner has checked the source data and explicitly approved that action.

## Repository and owner constraints

- Repository: `walid1239/Imi-android`
- Current audit working branch: `work/imi-web-foundation-audit-fixes` (PR #5 Draft, open and unmerged).
- PR #5 base branch: `feature/imi-web-foundation` at `106d656c044769828065b5bf5d76998820d27880`.
- PR #2 (`feature/imi-web-foundation` → `feature/server-authoritative-status`) remains open and unmerged.
- Latest PR #5 head: `68fc6154d53860c73541c7afbe5b3453365fc775` (documentation-only handoff refresh on top of the source SHA `d685d28c64545e7bb32446b624a3c3fdf0767846`, which is the exact SHA tested by the recorded Web and Android CI runs).
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
| 12. Academy and teacher workflow | Learner Web/Android-Web hierarchy remains level → track → subject → unit. Admins have a protected batch-publish endpoint with dry-run, explicit confirmation, parent validation, 400-write batches and an audit log. Teacher application submission and admin review now have authenticated `/api/v1` routes with validation, duplicate protection, claims-outbox synchronization and E2E coverage. | `web/src/app/api/v1/admin/curriculum/publish/route.ts`, `web/src/app/api/v1/teachers/applications/route.ts`, `web/src/app/api/v1/admin/teachers/review/route.ts`, `web/src/lib/server/imi-api.ts`, `web/e2e/server-api.spec.ts`. The authenticated teacher application UI is enabled on this audit branch: it requires sign-in, accepts a full name plus an HTTPS proof URL (no file upload), and offers only published curriculum levels/subjects. Submission uses the authenticated `/api/v1/teachers/applications` route; Playwright covers submit → admin review API → `teacherVerified` claim. Teacher profile editing, content creation/moderation, live scheduling, and child-safety operations remain incomplete; this branch has not been deployed. Teacher content submission/moderation remains a separate blocker. |
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
3. Authenticated teacher application UI, submission API, admin review UI/API, moderation audit and Auth claims synchronization are covered by Emulator E2E. Still incomplete: teacher profile editing, teacher content submission/review, content-report review and live-session scheduling. Keep these actions disabled until their `/api/v1` routes and tests exist; do not restore Firebase Functions client calls.
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


## Latest verified CI baseline — 2026-11-22 09:40 UTC

- Exact application-code head: `24f6ef494c9777a73743e5b9860469dbbcd70354`.
- Web CI Run [45008354038](https://github.com/walid1239/Imi-android/actions/runs/45008354038): **success**. Web typecheck/build/health checks, Functions integration tests, Firestore/Storage Emulator tests, Coturn Compose validation, and Playwright browser E2E all completed successfully.
- Android CI Run [45008354067](https://github.com/walid1239/Imi-android/actions/runs/45008354067): **success**. JDK 17/Android SDK setup, Gradle verification, unit tests, and debug APK assembly/upload completed successfully. The live-Firebase smoke test was deliberately skipped; Android emulator launch was skipped to avoid creating an anonymous Auth user against the real Firebase project.
- APK artifact: `IMI-debug-apk-firebase-configured`, 23,571,478 bytes, SHA-256 `2aebf6a8d81ed47d0ae204d7c156adb663deeebee0d5be78c4759292fe7be37c`. Artifact ID `14748324562`; attached to Android Run 45008354067; expires 2026-12-06 09:40 UTC.
- Firebase workflow Run [45008353988](https://github.com/walid1239/Imi-android/actions/runs/45008353988): validation succeeded; protected Firestore rules/index deployment job was **skipped**. No real Firebase deployment occurred.
- PR #2 remains open and unmerged. No production deployment, Firebase mutation, paid-plan upgrade, or secret change was performed.
- This is a green CI/debug-artifact baseline, **not production acceptance**. Physical-device installation, signed Release APK acceptance, live Firebase Auth/domain verification, approved hosting/runtime proof, and the documented feature/security/legal gates remain outstanding.


## Latest verified CI baseline — 2026-11-22 11:02 UTC

- Exact head SHA: `1035350f53a582c35c3c47b64a3cc8ed110392f2`.
- Web CI Run [45014982868](https://github.com/walid1239/Imi-android/actions/runs/45014982868): **success**. Playwright browser tests, TypeScript/build/health checks, Functions tests, Firestore/Storage Emulator rules tests, and Coturn configuration validation completed successfully.
- Android CI Run [45014982819](https://github.com/walid1239/Imi-android/actions/runs/45014982819): **success**. Android unit tests and Debug APK assembly/upload completed successfully. The live-Firebase smoke test was skipped; the Android emulator launch was also skipped by the workflow guard to avoid anonymous Auth writes to the real Firebase project.
- APK artifact: `IMI-debug-apk-firebase-configured`, artifact ID `14750684003`, 23,571,477 bytes, expires 2026-12-06 11:01 UTC. Downloaded and extracted locally; APK SHA-256 verified as `624ce6167e42ee165cde58a0173c6464bcc806121c3c736943da80b779c5d0ca`. This is a **Debug** APK, not a signed Release acceptance build.
- Firebase rules/index workflow Run [45014982817](https://github.com/walid1239/Imi-android/actions/runs/45014982817): **success** for validation; protected deployment was skipped. No real Firebase rules/index deployment occurred.
- Teacher workflow updates are present at this head: authenticated server routes for teacher application submission and admin review, with the existing claims outbox path covered by E2E tests. The public teacher application UI is deliberately closed and displays `التقديم متوقف مؤقتاً`; it does not collect personal data while child-safety/verification operations remain unready.
- PR #2 remains open and unmerged. No production deployment, Firebase Console mutation, paid-plan upgrade, secret change, or Cloud Functions invocation occurred.
- This CI baseline is not production acceptance. Physical-device installation/runtime testing, signed Release APK acceptance, live Firebase Auth/domain verification, approved hosting/runtime proof, and the remaining security/legal gates are outstanding.
