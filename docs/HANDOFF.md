# IMI handoff — 2026-11-21

## Scope and safety decisions

- Repository: `walid1239/Imi-android`
- Working branch: `feature/imi-web-foundation`
- Review baseline: `b7394dc15ac99e5274e3729c649b0bab6a0c2f5d`
- Current handoff baseline before this document: `18a9dc4a962c0291ccab8290774b7ee0a5802a6e`
- Firebase project: `imi-indroid`
- No production deployment, PR merge, Firebase Console mutation, billing-plan change, secret disclosure, or paid-service provisioning is authorized by this work.

The governing architecture is Firebase Spark for Auth/Firestore, no Cloud Functions, and Next.js `/api/v1` routes for trusted server logic. Cloudflare is the preferred host only after a real compatibility proof for Firebase Admin `verifyIdToken` and a Firestore write. If that proof fails, Vercel Hobby is a preview-only fallback subject to its plan eligibility and commercial-use restrictions. Firebase Storage remains the default adapter, but Storage-dependent features must remain disabled until availability and free-tier eligibility are confirmed. Supabase must not be enabled without the owner's explicit confirmation. Phone login remains disabled by default.

## Changes made after the review baseline

| Change | Commit SHA | Validation evidence |
|---|---|---|
| Added the Reels composite Firestore index (`status ASCENDING, createdAt DESCENDING`). | `5113260fc26736b83788e3f3cbf9a58622beb4f5` | JSON parse validation is configured in the manual Firebase workflow; no completed result is recorded yet. |
| Replaced automatic Firebase deployment triggers with manual `workflow_dispatch`, an exact `DEPLOY` gate, protected `firebase-production` environment, Emulator rules tests, actionlint, and a Firestore-rules/indexes-only deployment command. Cloud Functions are not deployed by this workflow. | `40f543eeef8337f2080b6948f32402f677a99d00` | Workflow has not been manually dispatched; actionlint and deployment have not been executed. |
| Added baseline CSP, X-Frame-Options, Referrer-Policy, and X-Content-Type-Options headers. | `98313f9d2161f8418cd0dc483103e2e350cc4710` | Web CI must pass; browser CSP compatibility has not been manually verified. |
| Removed Android CAMERA and RECORD_AUDIO permissions and set `usesCleartextTraffic=false`. | `18a9dc4a962c0291ccab8290774b7ee0a5802a6e` | Android CI must pass; physical-device behavior has not been verified. |

## CI runs observed

- Web CI run `44930274719`: in progress at handoff; no pass/fail conclusion recorded.
- Android CI run `44930274714`: queued at handoff; no pass/fail conclusion recorded.
- Earlier CI runs for intermediate commits were cancelled by later pushes. Do not treat cancelled runs as passing evidence.
- Firebase deploy workflow run `44930154114` on an earlier commit ran only its non-deploying safety gate; its deploy job was skipped. No Firebase deployment occurred.

## Known unresolved release blockers

1. Android still calls Cloud Functions for `createStatus` and `submitReel` in `app/src/main/java/com/walid/chat/ui/IMIApp.kt`. `FirebaseChatRepository.kt` still calls `createOrGetDirectConversation`. The Android Firebase Functions dependency is still present.
2. The Web Firebase client still imports/exports Firebase Functions and initializes an inert localhost fallback when Firebase configuration is missing. A complete migration must preserve buildability without making the fallback appear as a real app configuration.
3. `imi-api.ts` stores rate-limit counters in Firestore collection `apiRateLimits` using transactions. A dedicated test proving threshold rejection and window reset is still required.
4. The Reels API route and server-side moderation/metadata flow are not yet implemented. Reels media upload is Storage-dependent and must stay disabled while the Spark/free-storage constraint remains unresolved.
5. `respondToCall` idempotency, Storage-rule expression grouping and Firestore metadata binding, public profile `photoPath` validation, legacy-chat block regression, and complete account deletion are not yet verified/fixed.
6. Account deletion must remain disabled until all owned and cross-user references, Storage objects, nested call collections, and partial-failure behavior are covered by tests.
7. The Android profile-write audit for `updatedAt`, WhatsApp package visibility/installed detection, and Release minification/ProGuard/environment-only signing are not complete.
8. The web Firebase-not-configured screen, removal of the dead phone OTP component/legacy text, and the empty Academy hierarchy/verified-teacher publishing constraints are not complete.
9. WhatsApp inbound challenge, Meta webhook signature verification, sender matching, one-time six-digit code validation, UID derivation, and provider adapters are not implemented. Keep `PHONE_LOGIN_ENABLED=false`.
10. Cloudflare Firebase Admin compatibility has not been proven. Vercel preview is not evidence of Cloudflare compatibility and does not establish eligibility for commercial production use.
11. No latest-head CI green result has yet been observed. No physical-device, two-network call, real Firebase Auth/Firestore, production rules, or signed Release APK acceptance test has been completed.

## Free-tier and deployment controls

- Do not enable Blaze, link a payment card, or provision paid services.
- Do not deploy Cloud Functions.
- Do not deploy Firestore rules/indexes until the owner separately approves the protected manual workflow.
- Do not deploy Production or merge the PR.
- Disable any feature that approaches or exceeds a free quota rather than upgrading or silently switching providers.
- Keep WhatsApp phone login disabled until the complete inbound flow is reviewed and tested; no paid templates or outbound messaging are allowed.
- Keep Storage-dependent uploads disabled if Firebase Storage is not usable under the approved Spark-only plan. Do not switch to Supabase without explicit owner confirmation.

## Next required work

Complete the remaining items in the owner's 1–28 checklist in small, independently tested commits. For every item, record the exact commit SHA, exact test command or CI Run ID, observed result, and outstanding limitation. Do not mark the branch release-ready until every required gate has direct evidence.
