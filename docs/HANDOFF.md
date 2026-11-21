# IMI handoff — 2026-11-21

## Repository and safety boundary

- Repository: `walid1239/Imi-android`
- Branch: `feature/imi-web-foundation`
- Verified HEAD at this handoff: `94b7d8acd4edeaf2ef8efea2851cb113e59899f2`
- Firebase project: `imi-indroid`
- PR #2 remains open and unmerged.
- No Production deployment, PR merge, Firebase Console mutation, rules/index deployment, Blaze upgrade, payment card, paid service, or secret publication was performed.

Owner constraints remain binding: Firebase Spark only; no Cloud Functions usage; Next.js `/api/v1` is the intended trusted server layer; do not switch Storage to Supabase without explicit approval; keep phone login disabled; keep account deletion disabled until its cleanup is fully verified.

## Work verified in the current source

| Area | Current source state | Evidence / limitation |
|---|---|---|
| Android Functions removal | Android source uses `ImiApiClient` for status and direct-conversation API calls; no Android Firebase Functions dependency remains in `app/build.gradle.kts`. | Inspected `IMIApp.kt`, `FirebaseChatRepository.kt`, `ImiApiClient.kt`, and Gradle dependencies at HEAD. |
| Android API transport | HTTPS-only base URL from `IMI_API_BASE_URL` BuildConfig; Firebase ID token Bearer header; JSON POST; Arabic error mapping. | `ImiApiHttpTest.kt` covers request construction, missing token/non-HTTPS rejection, successful envelope, 401/429 mapping, and Arabic server errors. Test execution is part of Android CI and is not yet confirmed green. |
| Android Reels | Video upload path is disabled with an Arabic message pending owner confirmation of Spark Storage availability. | Inspected Android Reels UI at HEAD. Do not re-enable based on assumption. |
| Web Firebase Functions removal | Web Firebase client no longer imports or initializes Firebase Functions; call controls are intentionally disabled with an Arabic explanation. | Source audit of `web/src` found no `httpsCallable`, `getFunctions(`, or Functions emulator binding. |
| Rate limiting | API rate limits are stored in one hashed per-user/per-operation document; multiple windows are in one transaction. | `web/scripts/rate-limit.test.mjs` covers configured threshold, rejection, window reset, concurrency, and no partial counter increment. `docs/free-tier-rate-limits.md` documents the 20,000/day Spark write budget and counter overhead. Firestore rules deny client access to `apiRateLimits`. |
| Account deletion | Next.js endpoint exists but is guarded by `IMI_ACCOUNT_DELETION_ENABLED !== "true"`; default response is 503. | Do not enable. Cleanup implementation has some target collections/paths, but comprehensive partial-failure and emulator proof remain outstanding. |
| Security rules | Current CI rules job and separate protected rules/index workflow have passed validation; deployment job was skipped. | No rules or indexes were deployed to the real Firebase project. Storage rule emulator coverage is not evidence of real-project deployment. |
| Calls | Web call controls display “المكالمات غير جاهزة حالياً”; no call request or media permission is issued. | Safe temporary disablement, not a completed call implementation. |
| Signing/minification | Release minification/resource shrinking and environment-only signing configuration exist in Gradle. | No signed release APK has been built or tested. |
| Firebase client fallback | Missing public Firebase env uses an inert build-only Firebase configuration for prerender/CI. | This is not a real Firebase configuration and must not be mistaken for a usable production client. User-facing missing-config behavior still needs full E2E verification. |

## CI evidence at HEAD

All run IDs below are tied to `94b7d8acd4edeaf2ef8efea2851cb113e59899f2`.

- Web CI: [Run 44954068846](https://github.com/walid1239/Imi-android/actions/runs/44954068846) — at last API observation the workflow was still `in_progress`. The `web`, `functions`, `rules`, and Coturn configuration jobs were `success`; the Playwright emulator E2E job was still `in_progress`. This is not a full Web CI pass.
- Android CI: [Run 44954068814](https://github.com/walid1239/Imi-android/actions/runs/44954068814) — at last API observation the workflow was still `in_progress`. Firebase security rules tests passed; Android unit tests/build and emulator verification had not yet completed. This is not a full Android CI pass.
- Firebase rules/index workflow: [Run 44954068797](https://github.com/walid1239/Imi-android/actions/runs/44954068797) — `success`; the protected deploy job was skipped. No deployment occurred.

CI status can change after this document is committed. Re-query the run IDs before asserting a final result.

## Remaining blockers — do not mark release-ready

1. Confirm the Web Playwright E2E and Android unit/build/emulator CI jobs finish green on the final HEAD; fix any failures, then re-run both.
2. Verify the Firebase-not-configured screen in a real browser and confirm Google/Email Auth with real project configuration; emulator-only E2E does not prove production provider configuration.
3. Complete empty Academy hierarchy (levels/tracks/subjects/units) and verified-teacher-only content publishing; ensure no lessons are fabricated and empty states are explicit.
4. Finish Storage rule grouping/metadata binding and Emulator tests for teacher-verification and teacher-content paths. Storage availability on Spark remains unconfirmed; keep dependent uploads disabled.
5. Complete account deletion: all nested/cross-user documents, blocked/friends records, Storage paths, partial-failure handling, and emulator tests. Keep `IMI_ACCOUNT_DELETION_ENABLED` false.
6. Audit every Android `users/{uid}` write for `updatedAt`; confirm WhatsApp package visibility only if that feature is actually implemented.
7. Cloudflare Firebase Admin `verifyIdToken` plus Firestore write proof has not been completed. Do not claim Cloudflare compatibility. Any Vercel preview must remain within actual Hobby plan eligibility and its terms.
8. WhatsApp inbound challenge, Meta signature verification, sender matching, six-digit single-use code, attempt limit, Custom Token, and provider adapter are not complete. Keep `PHONE_LOGIN_ENABLED=false`.
9. No two-device/two-network call acceptance, signed Release APK acceptance, production Auth/Firestore acceptance, or production rules deployment has been completed.
10. Review CSP against real Google and Email Auth in a browser; emulator E2E alone does not settle real OAuth iframe/connect-src behavior.
11. Review Firestore Spark write/read/storage quota consumption under realistic use before enabling higher-volume features.

## Free-tier and deployment controls

- No Blaze, billing card, paid service, Cloud Functions invocation, or paid WhatsApp template/outbound message.
- No production deployment, PR merge, Firebase Console mutation, or rules/index deployment without separate owner approval.
- Keep Storage-dependent features disabled until Spark availability and rules are confirmed.
- Keep calls disabled until the server API and media flow are implemented and tested.
- Keep account deletion disabled until all cleanup paths and failure cases are verified.
- Do not claim “ready” from partial CI jobs; require green Web E2E and Android tests on the same final SHA.
