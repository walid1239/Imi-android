# IMI handoff — 2026-11-21

## Scope and safety

- Repository: `walid1239/Imi-android`
- Working branch: `feature/imi-web-foundation`
- Review baseline: `b7394dc15ac99e5274e3729c649b0bab6a0c2f5d`
- Latest application/workflow code SHA: `d43a68259215cd5546d34288980af85fe8fd0b06`
- Firebase project: `imi-indroid`
- PR #2 remains open and unmerged. No Production deployment, Firebase Console mutation, Firebase rules/index deployment, billing-plan change, secret disclosure, or paid-service provisioning was performed.

Binding decisions: Firebase Spark only; no Cloud Functions; trusted server logic under Next.js `/api/v1`; Cloudflare first only after real Firebase Admin `verifyIdToken` plus Firestore-write proof; otherwise Vercel Hobby preview only subject to plan eligibility/commercial-use restrictions. Firebase is the default Storage adapter, but dependent features remain disabled until Spark eligibility is confirmed. Do not switch to Supabase without explicit owner confirmation. Phone login remains disabled by default.

## Changes after review baseline

| Change | Commit SHA | Actual validation/evidence |
|---|---|---|
| Added Reels composite index (`status ASCENDING, createdAt DESCENDING`). | `5113260fc26736b83788e3f3cbf9a58622beb4f5` | Local Node JSON parse + index-shape assertion passed against a local copy of the authored index structure. Emulator/index deployment not run. |
| Replaced deployment workflow with push/PR validation and a separate manual protected deploy concurrency group; deploy job requires `workflow_dispatch` and exact `DEPLOY`, protected `firebase-production`, and deploys Firestore rules/indexes only. | `d43a68259215cd5546d34288980af85fe8fd0b06` | Local PyYAML syntax parse passed on a local copy. actionlint and Emulator steps are running in CI; no deployment run/command occurred. Earlier intermediate workflow commits had invalid YAML and their runs failed before jobs; the current workflow revision corrects those syntax errors. |
| Added CSP, X-Frame-Options, Referrer-Policy, X-Content-Type-Options. | `98313f9d2161f8418cd0dc483103e2e350cc4710` | Browser CSP compatibility not manually tested; Web CI pending on the current branch head. |
| Removed Android CAMERA and RECORD_AUDIO permissions and disabled cleartext traffic. | `18a9dc4a962c0291ccab8290774b7ee0a5802a6e` | Local XML parse and assertions passed against a local copy: camera/microphone permissions absent, `usesCleartextTraffic=false`. Android CI pending. |
| Added explicit Arabic UI statement that Android calls are not ready. | `10393490d0e3860e644f974c29ea55247eb36e0e` | Source edit only; Android CI pending. |
| Removed stale guest-login “(بدون OTP)” wording. | `246984fecee2fadf242572d41a27071d11efc6cc` | Web CI pending. |
| Deleted unused Firebase SMS OTP form. | `f1db535ebd59b06adffcb9bb9b50d018b6383d66` | Web CI pending. |
| Rewrote release gate for Spark-only/no-Functions architecture and full acceptance checklist. | `e1f296196c0c77d020816c01cd07e40efa09787d` | Documentation-only. |
| Documented interim App Check risk and later monitor-then-enforce plan. | `53a90b114dbce858889fd2e866689bda3916f0f8` | Documentation-only; App Check is not enabled. |
| Corrected stale teacherContent visibility comment. | `27ed62d95da4735ee07757e473f835d7ca78eb6c` | Comment-only source change; rules Emulator test still pending. |

## CI state on latest code SHA

Latest code/workflow SHA: `d43a68259215cd5546d34288980af85fe8fd0b06`.

- Firebase workflow validation: [Run 44930952528](https://github.com/walid1239/Imi-android/actions/runs/44930952528) — in progress; actionlint, JSON validation, and Emulator steps not yet concluded.
- Web CI: [Run 44930952535](https://github.com/walid1239/Imi-android/actions/runs/44930952535) — pending at last check.
- Android CI: [Run 44930952587](https://github.com/walid1239/Imi-android/actions/runs/44930952587) — pending at last check.
- Previous intermediate runs were cancelled or failed before jobs. They are not passing evidence.
- No Firebase deploy job was executed; no rules/index deployment occurred.

## Unresolved release blockers

1. Android still calls Cloud Functions for `createStatus` and `submitReel` in `app/src/main/java/com/walid/chat/ui/IMIApp.kt`. `FirebaseChatRepository.kt` still calls `createOrGetDirectConversation`. The Android Firebase Functions dependency is still present.
2. The Web Firebase client still imports/exports Firebase Functions and initializes an inert localhost fallback when Firebase configuration is missing.
3. `imi-api.ts` persists rate-limit counters in Firestore collection `apiRateLimits` using transactions, but no dedicated threshold/concurrency/window-reset test has been verified.
4. Reels API route and server-side moderation/metadata flow are not implemented. Reels media upload is Storage-dependent and must remain disabled until the Spark/free-storage question is resolved.
5. `respondToCall` idempotency is not fixed. Storage rule grouping, Firestore metadata binding for Reels/teacher verification, public-profile `photoPath` validation, and legacy-chat block regression remain unverified.
6. Account deletion is incomplete and must remain disabled until all nested/cross-user documents, Storage paths, partial-failure handling, and tests are complete.
7. Android `users/{uid}` `updatedAt` write audit, WhatsApp package visibility/detection, and Release minification/ProGuard/environment-only signing remain incomplete.
8. Firebase-not-configured screen and complete empty Academy hierarchy/verified-teacher publishing restrictions remain incomplete.
9. WhatsApp inbound challenge, Meta signature verification, sender matching, single-use six-digit code, UID derivation, Custom Token, and provider adapters are not implemented. Keep `PHONE_LOGIN_ENABLED=false`.
10. Cloudflare Firebase Admin compatibility has not been proven. No Cloudflare preview has been deployed. Existing Vercel previews are not evidence of Cloudflare compatibility or commercial plan eligibility.
11. Latest-head CI is not green yet. No real Firebase Auth/Firestore test, two-device/two-network call acceptance, production rules deployment, or signed Release APK test has been completed.

## Free-tier and deployment controls

- No Blaze, payment card, paid services, Cloud Functions, or paid WhatsApp templates/outbound messages.
- Do not deploy Firestore rules/indexes until the owner separately approves the protected manual workflow.
- Do not deploy Production or merge PR #2.
- Stop/disable features before free quotas are reached. No automatic plan upgrade or provider switch.
- Keep Storage-dependent uploads disabled if Firebase Storage is not usable on the approved Spark-only plan. Do not switch to Supabase without explicit owner confirmation.
- App Check is not enabled; the interim risk and later rollout plan are documented in `docs/RELEASE_GATE.md`.

## Next steps

Finish the remaining checklist items in small commits. For each, record the exact commit SHA, exact test command or CI Run ID, observed result, and remaining limitations. The branch is not release-ready until every required gate has direct passing evidence.
