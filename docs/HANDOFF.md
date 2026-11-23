# IMI handoff — latest verified state, 2026-11-23

This section supersedes older status statements below where they conflict.

## Source and CI

Latest source SHA: `182a64ec6f25a0ca9561f7f09c3c6985da0b9434`.

- Preview build check: [Run 45157792161](https://github.com/walid1239/Imi-android/actions/runs/45157792161) — `completed / success`.
- IMI Web CI: [Run 45157802609](https://github.com/walid1239/Imi-android/actions/runs/45157802609) — `completed / success`.
- IMI Android CI: [Run 45157802650](https://github.com/walid1239/Imi-android/actions/runs/45157802650) — `completed / success`.
- All eight commit checks on this SHA report `completed / success`: rules, functions, Coturn config validation, Playwright browser tests, Firebase security rules tests, web, Android build/test, and preview build.
- Web CI includes the Arabic login error tests for `auth/unauthorized-domain` and `CONFIGURATION_NOT_FOUND`. These are emulator/mock tests, not live Firebase Auth verification.

### Preview build check output

```text
/api/health -> 200
/login -> 200
/academy -> 200
IMI_ADMIN_HEALTH unset
{"error":"Not found."}
/api/v1/health/admin -> 404
```

### Vercel branch guard test output

```text
feature preview exit: 1
main preview exit: 1
other branch exit: 0
production exit: 0
```

### PR #4

[PR #4](https://github.com/walid1239/Imi-android/pull/4) is `open`, `draft=false` (Ready for review), `merged=false`, head SHA `182a64ec6f25a0ca9561f7f09c3c6985da0b9434`. It was not merged.

## Vercel — blocked before deployment

- Vercel project `imi-preview` exists with framework `nextjs` and Node `22.x`.
- The project's current metadata does not expose a linked Git repository or configured Root Directory. Existing project was not automatically connected to GitHub.
- Preview environment metadata lists six `NEXT_PUBLIC_FIREBASE_*` variables and `FIREBASE_PROJECT_ID`; `FIREBASE_SERVICE_ACCOUNT_JSON` is absent. Values were not decrypted for inspection.
- Latest Vercel deployment remains `dpl_HUNAdSugYnEetHNVTPhuWgtPi7sj`, source SHA `21cfddbe887a46c4658c2f13d17c87e3924edfb1`, state `ERROR`, URL `https://imi-preview-goovq2nyt-walid2.vercel.app`. Its first reported build error was `متغير مفقود: FIREBASE_SERVICE_ACCOUNT_JSON`.
- There is no deployment on Vercel for SHA `182a64ec6f25a0ca9561f7f09c3c6985da0b9434`. No hosted Preview URL exists to smoke-test. Do not describe this as deployed.
- `web/vercel.json` sets framework `nextjs` and `ignoreCommand` to `bash scripts/vercel-ignore.sh`. The script skips Production and non-allowlisted branches, and allows Preview for `feature/imi-teacher-admin-preview` and `main`.
- The Vercel setup instructions, including Root Directory `web` and **Include source files outside of the Root Directory**, are in `docs/OWNER_DEPLOY_MESSAGE.md` and `docs/DEPLOY_PREVIEW.md`.

## Explicitly not tested / not performed

- No live Firebase Authentication sign-in, real authorized-domain flow, real user/admin account, Firestore write, Storage upload, or real custom-claim change was tested.
- No Firebase rules or indexes were deployed to the real project.
- No Cloud Functions, Blaze upgrade, paid service, Production deployment, or PR merge occurred.
- CI green status is emulator/mock verification only; it does not prove live Firebase configuration or deployed runtime behavior.
- Project remains Preview-only and not approved for Production.

---


# IMI handoff — 2026-11-23

## Latest verification — 2026-11-23

This section supersedes older run/status references below where they conflict. Latest verified branch head before this documentation-only refresh: `4afe56f5626097d473609f42952611cd31f29a30`.

- Preview build check: [Run 45134977543](https://github.com/walid1239/Imi-android/actions/runs/45134977543) — **success**.
- Web CI: [Run 45134982085](https://github.com/walid1239/Imi-android/actions/runs/45134982085) — **success**; Playwright: `50 passed (1.3m)`. A Functions-emulator request logged `socket hang up`, but all 50 tests passed and the job exited successfully.
- Android CI: [Run 45134982098](https://github.com/walid1239/Imi-android/actions/runs/45134982098) — **success**; Firebase security-rules emulator tests, Android unit tests, debug APK assembly and artifact upload succeeded. `Run IMI on Android emulator` was **skipped**; the live-Firebase Android smoke test was skipped by design.

### Exact Preview smoke output

```text
/api/health -> 200
/login -> 200
/academy -> 200
IMI_ADMIN_HEALTH unset
{"error":"Not found."}
/api/v1/health/admin -> 404
```

The Vercel branch allowlist test passed with these exact exit codes:

```text
feature preview exit: 1
main preview exit: 1
other branch exit: 0
production exit: 0
```

The build compiled successfully (`Compiled successfully in 8.2s`). The 404 on `/api/v1/health/admin` is expected because `IMI_ADMIN_HEALTH` is unset.

### Vercel / owner setup status

- Vercel project `imi-preview` has the six public `NEXT_PUBLIC_FIREBASE_*` values and `FIREBASE_PROJECT_ID` in Preview, but no `FIREBASE_SERVICE_ACCOUNT_JSON`. No secret value was decrypted or printed.
- The last recorded Vercel deployment `dpl_HUNAdSugYnEetHNVTPhuWgtPi7sj` ended with `ERROR`. First build error: `متغير مفقود: FIREBASE_SERVICE_ACCOUNT_JSON`; then `Error: [BUILD_UTILS_SPAWN_1] Command "npm run build" exited with 1`.
- No Vercel deployment for the latest branch SHA appeared after pushes. GitHub auto-deploy integration, Root Directory `web`, Node `22.x`, and **Include source files outside of the Root Directory** are not verified as configured. Follow `docs/OWNER_DEPLOY_MESSAGE.md` once, then monitor the resulting Preview.
- The owner must connect the GitHub repository and add `FIREBASE_SERVICE_ACCOUNT_JSON` as a Sensitive Preview-only variable. No key or token was requested, copied, or committed.

### PR state

PR #4 is **Ready for review**, open, and unmerged: https://github.com/walid1239/Imi-android/pull/4. No merge is authorized.

### Not tested / not performed

- No live Firebase Authentication, Firestore, Storage, real user accounts, or real admin claim was changed or verified.
- No Firestore rules/indexes were deployed to the real Firebase project.
- No Cloud Functions deployment, Blaze upgrade, payment, Production deployment, or PR merge occurred.
- The Preview URL and its hosted smoke tests remain unavailable until the owner completes the one-time Vercel connection and Preview environment setup.

## Repository and owner constraints

- Repository: `walid1239/Imi-android`
- Baseline branch: `feature/imi-web-foundation`; isolated implementation branch: `feature/imi-teacher-admin-preview`.
- Base SHA: `106d656c044769828065b5bf5d76998820d27880`; latest verified application/workflow SHA: `4afe56f5626097d473609f42952611cd31f29a30` (CI-green; see latest verification below).
- PR #2 is open, not merged; base: `feature/server-authoritative-status`. PR #4 is Draft and targets `feature/imi-web-foundation`.
- This handoff records source changes on isolated Draft PR #4; it does not change Firebase/hosting runtime or perform deployment.
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
| 12. Academy and teacher workflow | Learner Web/Android-Web hierarchy remains level → track → subject → unit. Admins have a protected batch-publish endpoint with dry-run, explicit confirmation, parent validation, 400-write batches and an audit log. Teacher application submission and admin review now have authenticated `/api/v1` routes with validation, duplicate protection, claims-outbox synchronization and E2E coverage. | `web/src/app/api/v1/admin/curriculum/publish/route.ts`, `web/src/app/api/v1/teachers/applications/route.ts`, `web/src/app/api/v1/admin/teachers/review/route.ts`, `web/src/lib/server/imi-api.ts`, `web/e2e/server-api.spec.ts`. Public teacher application UI is reopened on the isolated Draft branch with published level/subject selectors and HTTPS proof URL; file upload is not offered. Admin teacher review uses the Node API and keeps content submission/moderation disabled until those operations are migrated and tested. |
| 13. Hosting proof | Cloudflare Firebase Admin compatibility with `verifyIdToken` plus Firestore write remains unproven; no Cloudflare deployment/test was performed. | `docs/DEPLOY_PREVIEW.md` documents Vercel Hobby only as a personal/non-commercial preview option under Vercel terms. No Vercel preview or Production deployment was created. Hobby is not an approved commercial hosting path. |
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
3. Teacher application submission and admin review routes are implemented and E2E-tested. The public form and admin review UI are reopened on the isolated work branch; profile save is migrated to `/api/v1/teachers/profile` without photo upload. Teacher content submission/moderation remains a blocker; keep those unimplemented actions disabled and do not restore Firebase Functions client calls.
4. Confirm Firebase Spark Storage eligibility before enabling Storage-dependent uploads.
5. Account-deletion failure/retry tests pass on the Emulator; live-project account deletion remains disabled and `IMI_ACCOUNT_DELETION_ENABLED` must remain unset.
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

## تحديث مراجعة 2026-11-22 — نتائج PR #4

- الفرع: `feature/imi-teacher-admin-preview`؛ SHA المختبر النهائي: `ecc6b5452258697784058e8bb15544b80aa91dd6`؛ PR [#4](https://github.com/walid1239/Imi-android/pull/4) Draft فقط، غير مدمج.
- لم نعدّل `feature/imi-web-foundation` أو PR #2. PR #3 بقي Draft وعلى قاعدته السابقة. لا دمج أو نشر.
- Web CI [Run 45059083847](https://github.com/walid1239/Imi-android/actions/runs/45059083847): `completed/success`. Web job: `npm run test:env` = `3 passed, 0 failed`; `npm run typecheck` success; `npm run test:rate-limit` success; `npm run build` success; `npm run test:health` success (`PASS /api/health: HTTP 200`, `PASS /api/v1/health: HTTP 200`).
- Functions job في Run `45059083847`: `npm test` = `50 passed, 0 failed, 1 skipped` من 51؛ teacher application/review/claims/agreements emulator integration = success؛ account-deletion cleanup/retry emulator test = success.
- Firestore rules job في Run `45059083847`: success. Playwright job: `46 passed`، بلا failed أو flaky. شمل اختبار واجهة طلب الأستاذ، عدم ظهور لوحة المشرف لغير المشرف، رابط الإثبات `target=_blank` و`rel=noopener noreferrer`، اعتماد طلب المشرف، وتدفق API للتقديم والرفض والclaims وحفظ الملف المهني بلا صورة.
- `saveTeacherProfile` API E2E تحقق من `photoPath: ""` ومن اتفاقيتي المحتوى وحماية القاصرين؛ رفض غياب الموافقة أعاد HTTP `409` كما هو معرف في `publicErrorMessage`. لا يوجد رفع صورة في هذا المسار.
- Environment tests log: `# tests 3`, `# pass 3`, `# fail 0`. الاختبارات الثلاثة غطت تخطي الفحص محلياً بصمت، فشل المتغيرات المطلوبة في الاستضافة، ورفض Emulator/feature flags المحظورة دون طباعة قيم الأسرار.
- Android CI [Run 45059083996](https://github.com/walid1239/Imi-android/actions/runs/45059083996) على SHA نفسه: `completed/success`؛ Unit tests و`assembleDebug` ورفع APK نجحت. Artifact `IMI-debug-apk-firebase-configured`، ID `14768567269`، SHA-256 `388249223563607932ad92a9e509e6e6a96d272b4eb37734c8801ea50ac7a81e`. خطوة live-Firebase smoke تخطّت، وAndroid Emulator runtime test `skipped` في هذا التشغيل.
- Android [Run 45056409860](https://github.com/walid1239/Imi-android/actions/runs/45056409860) على SHA أقدم `9dc895c4b710de7d22cfa4d7d951829f6b0e7beb`: `completed/success`؛ Emulator instrumentation `1/1 completed (0 skipped) (0 failed)` و`BUILD SUCCESSFUL`. هذا دليل على ذلك الـSHA فقط، وليس تشغيل جهاز فعلي.
- أول Playwright run على SHA `17463e506864c1c7bbabba0a1309c5ed9ff53aff` سجّل `45 passed` و`1 flaky` في مراجعة المشرف. أضفنا انتظار HTTP response والتحقق من status/body، ثم أعاد Run `45059083847` النتيجة النظيفة `46 passed` بلا flaky.
- Cloudflare ما زال غير مثبت: Run [45056409945](https://github.com/walid1239/Imi-android/actions/runs/45056409945) على SHA `9dc895c4...` فشل في Worker runtime smoke بالخطأ الحرفي `EvalError: Code generation from strings disallowed for this context` أثناء dynamic code generation في `protobufjs` عند تحميل `firebase-admin/firestore`. لا تدّع نجاح Cloudflare.
- Firebase safety gate [Run 45056409885](https://github.com/walid1239/Imi-android/actions/runs/45056409885): success للفحص غير الناشر؛ Validate/Test/Deploy Firebase backend كانت skipped. لم يحدث أي تعديل على Firebase الحقيقي أو نشر Cloud Functions أو قواعد/فهارس.

### مصفوفة البنود 1–7

| البند | SHA | الأمر / Run ID | النتيجة الفعلية | ما لم يُختبر |
|---|---|---|---|---|
| 1. لوحة مراجعة الأستاذ | `ecc6b5452258697784058e8bb15544b80aa91dd6` | Playwright ضمن Run `45059083847` | `46 passed`؛ اعتماد المشرف ورسالة النجاح ورابط الإثبات مع `rel=noopener noreferrer` | Firebase Auth/Firestore الحقيقي والنطاق الفعلي |
| 2. نموذج تقديم الأستاذ | `ecc6b5452258697784058e8bb15544b80aa91dd6` | Playwright ضمن Run `45059083847` | `46 passed`؛ الحقول والاختيارات المنشورة ورابط HTTPS؛ لا `input[type=file]` | تقديم فعلي على Firebase الحقيقي ورفع أي ملف |
| 3. تتبّع الملفات خارج `web` | `ecc6b5452258697784058e8bb15544b80aa91dd6` | `npm run build` ضمن Run `45059083847` | `success` بعد إضافة `outputFileTracingRoot` | إعداد Root Directory وخيار include خارج الجذر في مشروع Vercel فعلي |
| 4. فحص البيئة | `ecc6b5452258697784058e8bb15544b80aa91dd6` | `npm run test:env` ضمن Run `45059083847` | `3 passed, 0 failed`؛ و`npm run build` success | اختبار متغيرات Vercel الحقيقية/سر Admin في بيئة Preview |
| 5. دليل المعاينة | `ecc6b5452258697784058e8bb15544b80aa91dd6` | `docs/DEPLOY_PREVIEW.md` | 11 خطوة موثقة؛ لم ينفّذ أي نشر | تنفيذ المالك للخطوات، النطاق، OAuth وFirestore الحقيقي |
| 6. نقل `saveTeacherProfile` | `ecc6b5452258697784058e8bb15544b80aa91dd6` | Playwright ضمن Run `45059083847` | `46 passed`؛ `POST /api/v1/teachers/profile`، `photoPath=""`، الموافقات والتحقق من claim | حفظ الملف على Firebase الحقيقي؛ لا رفع صورة |
| 7. توثيق الحالة | `ecc6b5452258697784058e8bb15544b80aa91dd6` | `docs/HANDOFF.md` | SHA وRuns والنتائج والحدود موثقة هنا | لا يحل محل تحقق المالك من Firebase/Vercel الحقيقيين |

### عناصر Functions القديمة التي لم تُنقل بعد

تبقى هذه العمليات معطلة برسالة عربية في الواجهة، ولا تستدعِ Cloud Functions من العميل. نُقل `saveTeacherProfile` وحده في هذه الدفعة؛ ينقل كل عنصر تالٍ في دفعة منفصلة مع اختبار Emulator قبل تفعيل زرّه:

| Callable قديم | الحالة |
|---|---|
| `saveTeacherProfile` | نُقل إلى `POST /api/v1/teachers/profile`؛ بلا رفع صورة و`photoPath: ""`؛ E2E ناجح |
| `createTeacherContent` | معطّل؛ لم يُنقل |
| `reviewTeacherContent` | معطّل؛ لم يُنقل |
| `scheduleTeacherLiveSession` | معطّل؛ لم يُنقل |
| `reviewContentReport` | معطّل؛ لم يُنقل |
| `publishCourse` | معطّل؛ لم يُنقل |
| بقية استدعاءات `call()` في `academy-admin-panel.tsx` مثل إنشاء الدورات والدروس ونشرها | معطّلة؛ لم تُنقل |

### الحدود الثابتة

- لا اختبار على Firebase الحقيقي: Google OAuth/Email Auth، Authorized Domains، admin service account في الاستضافة، أو عمليات Firestore الفعلية.
- لا Vercel Preview أو Production deployment. `docs/DEPLOY_PREVIEW.md` دليل للمالك فقط.
- لا Blaze، لا بطاقة، لا خدمة مدفوعة، لا Cloud Functions deploy، لا تعديل قواعد Firebase، لا أسرار في المستودع أو السجلات.
- لا تُعتبر `46 passed` دليلاً على تشغيل Cloudflare أو جاهزية إنتاجية؛ `RELEASE_GATE.md` ما زال يحظر اعتماد Production حتى إغلاق البوابات المتبقية.
