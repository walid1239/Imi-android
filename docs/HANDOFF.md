# IMI handoff — 2026-11-21

## Scope and safety decisions

- Repository: `walid1239/Imi-android`
- Working branch: `feature/imi-web-foundation`
- Review baseline: `b7394dc15ac99e5274e3729c649b0bab6a0c2f5d`
- Latest code SHA before this handoff refresh: `f1db535ebd59b06adffcb9bb9b50d018b6383d66`
- Firebase project: `imi-indroid`
- No production deployment, PR merge, Firebase Console mutation, billing-plan change, secret disclosure, or paid-service provisioning was authorized or performed.

The governing architecture is Firebase Spark for Auth/Firestore, no Cloud Functions, and Next.js `/api/v1` routes for trusted server logic. Cloudflare is the preferred host only after a real compatibility proof for Firebase Admin `verifyIdToken` and a Firestore write. If that proof fails, Vercel Hobby is a preview-only fallback subject to plan eligibility and commercial-use restrictions. Firebase Storage remains the default adapter, but Storage-dependent features must remain disabled until availability and free-tier eligibility are confirmed. Supabase must not be enabled without the owner's explicit confirmation. Phone login remains disabled by default.

## Changes made after review baseline

| Change | Commit SHA | Validation evidence |
|---|---|---|
| Added Reels composite Firestore index (`status ASCENDING, createdAt DESCENDING`). | `5113260fc26736b83788e3f3cbf9a58622beb4f5` | JSON parse validation is configured in the manual workflow; no completed validation run yet. |
| Replaced automatic Firebase deployment triggers with manual `workflow_dispatch`, exact `DEPLOY` gate, protected `firebase-production` environment, Emulator rules tests, actionlint, and a Firestore-rules/indexes-only deployment command. | `40f543eeef8337f2080b6948f32402f677a99d00` | Not manually dispatched. A later push-associated workflow record `44930409707` ended `failure` with no jobs and no deployment attempt; reason not yet diagnosed. |
| Added CSP, X-Frame-Options, Referrer-Policy, and X-Content-Type-Options. | `98313f9d2161f8418cd0dc483103e2e350cc4710` | Web CI has not completed green on this head; browser CSP compatibility not manually tested. |
| Removed Android CAMERA and RECORD_AUDIO permissions and set `usesCleartextTraffic=false`. | `18a9dc4a962c0291ccab8290774b7ee0a5802a6e` | Android CI has not completed green on this head; no physical-device test. |
| Removed stale “(بدون OTP)” wording from guest login. | `246984fecee2fadf242572d41a27071d11efc6cc` | Web CI pending/in progress; no completed result yet. |
| Deleted the unused Firebase SMS `phone-otp-form.tsx`. | `f1db535ebd59b06adffcb9bb9b50d018b6383d66` | Web CI pending/in progress; no completed result yet. |
| Rewrote the release gate to reflect Spark-only/no-Functions architecture and release acceptance criteria. | `e1f296196c0c77d020816c01cd07e40efa09787d` | Documentation-only; not runtime tested. |

## CI runs observed on latest code SHA

Latest code SHA: `f1db535ebd59b06adffcb9bb9b50d018b6383d66`.

- Web PR CI: [44930416750](https://github.com/walid1239/Imi-android/actions/runs/44930416750) — in progress at last check.
- Android PR CI: [44930416763](https://github.com/walid1239/Imi-android/actions/runs/44930416763) — in progress at last check.
- Duplicate push-triggered Web CI: [44930411271](https://github.com/walid1239/Imi-android/actions/runs/44930411271) — in progress at last check.
- Duplicate push-triggered Android CI: [44930411182](https://github.com/walid1239/Imi-android/actions/runs/44930411182) — in progress at last check.
- Firebase workflow run [44930409707](https://github.com/walid1239/Imi-android/actions/runs/44930409707) — failure before any job was created; no deploy command ran.
- Earlier intermediate CI runs were cancelled by newer commits. Cancelled runs are not passing evidence.

## Known unresolved release blockers

1. Android still calls Cloud Functions for `createStatus` and `submitReel` in `app/src/main/java/com/walid/chat/ui/IMIApp.kt`. `FirebaseChatRepository.kt` still calls `createOrGetDirectConversation`. The Android Firebase Functions dependency is still present.
2. The Web Firebase client still imports/exports Firebase Functions and initializes an inert localhost fallback when Firebase configuration is missing. A complete migration must preserve buildability without making the fallback appear as a configured app.
3. `imi-api.ts` stores rate-limit counters in Firestore collection `apiRateLimits` using transactions. A dedicated test proving threshold rejection, concurrency safety, and window reset is still required.
4. The Reels API route and server-side moderation/metadata flow are not implemented. Reels media upload is Storage-dependent and must stay disabled while Spark/free-storage eligibility remains unresolved.
5. `respondToCall` idempotency, Storage-rule expression grouping and Firestore metadata binding, public profile `photoPath` validation, legacy-chat block regression, and complete account deletion are not yet verified/fixed.
6. Account deletion must remain disabled until all owned and cross-user references, Storage objects, nested call collections, and partial-failure behavior are covered by tests.
7. The Android profile-write audit for `updatedAt`, WhatsApp package visibility/installed detection, and Release minification/ProGuard/environment-only signing are incomplete.
8. The Firebase-not-configured screen and empty Academy hierarchy/verified-teacher publishing constraints are incomplete.
9. WhatsApp inbound challenge, Meta webhook signature verification, sender matching, one-time six-digit code validation, UID derivation, and provider adapters are not implemented. Keep `PHONE_LOGIN_ENABLED=false`.
10. Cloudflare Firebase Admin compatibility has not been proven. Vercel preview is not evidence of Cloudflare compatibility or commercial plan eligibility.
11. Latest-head CI has not yet been observed green. No physical-device, two-network call, real Firebase Auth/Firestore, production rules, or signed Release APK acceptance test has been completed.

## Free-tier and deployment controls

- Do not enable Blaze, link a payment card, or provision paid services.
- Do not deploy Cloud Functions.
- Do not deploy Firestore rules/indexes until the owner separately approves the protected manual workflow.
- Do not deploy Production or merge the PR.
- Disable any feature before it approaches or exceeds a free quota rather than upgrading or silently switching providers.
- Keep WhatsApp phone login disabled until the complete inbound flow is reviewed and tested; no paid templates or outbound messaging.
- Keep Storage-dependent uploads disabled if Firebase Storage is not usable under the approved Spark-only plan. Do not switch to Supabase without explicit owner confirmation.

## Next required work

Complete the remaining items in the owner's 1–28 checklist in small, independently tested commits. For every item, record the exact commit SHA, exact test command or CI Run ID, observed result, and outstanding limitation. Do not mark the branch release-ready until every required gate has direct evidence.
