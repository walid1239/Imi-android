# IMI — Free architecture decision (phase 1)

**Scope:** low-volume MVP, no Firebase Blaze, no payment card, no production deploy, no Firebase rules changes. This document describes a branch-only proof of concept.

## Verified platform facts (checked 2026-11-21)

| Service | Spark / free facts | Decision |
|---|---|---|
| Firebase Auth | Email/password, Google and Anonymous are no-cost Auth providers. Phone/SMS is not treated as free. Admin token verification requires a service account and a signed Firebase ID token. Firebase does not publish a separate per-call price for `verifyIdToken` or `setCustomUserClaims`; quotas/API availability apply and exact Spark-specific Admin API limits are **unconfirmed**. | Keep Auth on Spark. Never accept a UID supplied in the request as identity. |
| Firestore | One free database per project: 1 GiB stored data, 50,000 document reads/day, 20,000 writes/day, 20,000 deletes/day, 10 GiB outbound transfer/month. Quotas reset daily around midnight Pacific. TTL deletes, PITR, backup/restore/clone require billing. Admin SDK reads/writes use the same project/database quota pool. | Keep the existing Firestore database; monitor quota usage and avoid unbounded feeds/listeners. |
| Firebase Storage | As of 2026-02-03, Cloud Storage for Firebase requires Blaze for bucket access. Spark projects lose read/write access even to existing buckets; requests can return 402/403. | **Not available** under this owner's no-Blaze decision. Do not keep UI promises that Firebase Storage uploads work. External storage provider needs separate owner approval and free-tier verification. |
| Firebase Admin SDK | Admin SDK requires a server app and service-account credentials. Official docs support ID-token verification, privileged Firestore/Auth access and FCM. FCM is listed as no-cost. The docs do not state that all Admin operations are unmetered or guarantee Spark availability/quotas for every Auth admin method: mark that part **unconfirmed** until a sandbox integration test succeeds. | Server-only dependency; credentials only in host environment. Firestore operations still consume Spark quotas. |
| Vercel Hobby | $0 plan, but official terms restrict Hobby to personal/non-commercial use. Current docs list 1M function invocations/month and 100 GB-hours function duration; default function duration is 10 seconds (configurable up to 60s in docs). Quota enforcement/feature limits can change. | Suitable only for a personal/non-commercial prototype if the account/project qualifies. A public social network's eligibility is **not guaranteed**; any commercial purpose requires a different plan/provider. |
| Cloudflare Pages / Workers Free | Exact current request, CPU, storage and commercial-use limits for this app's intended deployment were not fully established from the official sources reviewed: **unconfirmed**. Firebase Admin SDK compatibility is also not assumed because Workers' runtime is not a conventional Node server. | Do not select as a drop-in host until a minimal compatibility and quota test passes. |

### Official sources

- [Firebase pricing](https://firebase.google.com/pricing)
- [Firestore pricing and free quota](https://firebase.google.com/docs/firestore/pricing)
- [Firebase Storage billing change FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)
- [Firebase Admin SDK setup](https://firebase.google.com/docs/admin/setup)
- [Verify Firebase ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Custom claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase Cloud Messaging pricing](https://firebase.google.com/pricing)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Vercel Terms of Service](https://vercel.com/legal/terms)

## Server architecture

- Domain rules live in a host-independent module under `functions/src/shared` (no imports from Next.js, Firebase Admin, or `firebase-functions`). Host adapters translate Firestore snapshots, timestamps and errors.
- Next.js Route Handlers and the existing callable Functions are transport adapters only. Cloud Functions remain in place during this phase; no functions or triggers are deleted.
- The web and Android clients obtain a Firebase ID token from their signed-in Firebase Auth session and send `Authorization: Bearer <ID_TOKEN>` over HTTPS. The server verifies signature, issuer, audience/project, expiry and subject with Admin SDK `verifyIdToken`; it derives UID only from the verified token. Never accept client-provided UID or role as authority.
- Verify token revocation for sensitive/admin actions; normal MVP calls may use standard verification with a documented short token lifetime. Never set roles/teacher/admin claims from a user-facing route.
- The Admin service-account JSON is a host secret (for example `FIREBASE_SERVICE_ACCOUNT_JSON`) only. Parse it at runtime, validate `project_id === imi-indroid`, initialize one Admin app per process, and never commit it, print it, return it, or put it in `NEXT_PUBLIC_*`. Prefer workload identity over long-lived keys when supported. Rotate after suspected exposure: disable/delete compromised key in Google Cloud IAM, issue a replacement, update host secret, redeploy only after owner approval, inspect audit logs, and invalidate affected sessions/tokens if compromise warrants it.
- Apply a strict JSON body-size limit, schema validation, per-UID and per-IP rate limits, idempotency for writes, generic auth errors, security headers, and structured logs that contain request ID + operation + outcome only (no tokens, credentials, message bodies, or personal data). Configure exact allowed origins; reject unexpected browser Origin values. CORS is not authentication.
- Require POST, `application/json`, HTTPS, and bearer auth. Do not enable wildcard credentialed CORS. Add App Check later only after a tested web+Android integration; it is not a substitute for ID-token verification.

## Function-by-function migration map

| Existing export | Phase-1 mapping | Security / behavior changes |
|---|---|---|
| `createStatus` | `POST /api/v1/status` | Preserve server timestamp, 28-hour expiry and cooldown. Media upload is disabled on Spark; text-only status is MVP. |
| `sendFriendRequest` | `POST /api/v1/friends/requests` | Preserve mutual-block, profile, existing-friend and pending-request checks in a transaction. |
| `createOrGetDirectConversation` | `POST /api/v1/conversations/direct` | Preserve deterministic ID, profile existence, mutual-block and teacher/student restrictions. |
| `acceptFriendRequest`, `rejectFriendRequest`, `removeFriend` | Later authenticated route handlers | Keep all relationship writes server-only; do not replace with direct client writes. |
| `createGroupConversation`, `addGroupParticipants` | Later route handlers | Preserve role checks, membership caps and block checks. |
| `blockUser`, `unblockUser` | Later route handlers | Keep server-authoritative cleanup of friendships, requests and calls. |
| `enrollInCourse`, `completeCourseLesson`, `reportAcademyLesson` | Later route handlers | Preserve published-content and enrollment checks. |
| `createCourse`, `createCourseLesson`, `publishCourse`, `publishCourseLesson`, `reviewCurriculumNode`, `reviewContentReport` | Admin-only routes or deferred | Require verified server-side admin claim; no client-controlled role assignment. |
| `submitReel`, `reviewReel` | Defer; submit route only after external media storage approved | Spark Storage unavailable; do not accept public media metadata without a verified object and moderation state. |
| `submitTeacherApplication`, `reviewTeacherApplication`, `saveTeacherProfile`, `scheduleTeacherLiveSession`, `createTeacherContent`, `reviewTeacherContent` | Later route handlers | Teacher/admin permissions remain server-owned. Teacher content upload waits for storage provider. |
| `applyTeacherClaimsOutbox` | Explicit admin workflow / later route | Custom claims must only be set by privileged server code after reviewing the outbox and verifying authorization. |
| `reconcileTeacherClaims` | Manual admin maintenance initially; scheduled GitHub Action only if safe/idempotent | GitHub schedule is not guaranteed exact timing; repository secrets must never contain service-account JSON unless owner separately approves that risk. |
| `notifyConversationMessage`, `notifyIncomingCall` | Later outbox + route/worker | Firestore triggers are not available in Next.js; client-side push would be forgeable. FCM itself is no-cost, but reliable event processing needs a trusted worker. |
| `expireRingingCalls` | Cleanup-on-read in call endpoints for MVP; scheduled action later | Missed-call state may remain stale until next read; scheduled GitHub Actions are delayed/best-effort, not real-time. |
| `createCall`, `respondToCall`, `restartCallIce`, `endCall`, `getIceServers` | Later route handlers | Preserve transaction state machine and rate limits. STUN-only initially; no TURN credentials or cross-network guarantee. |
| `deleteMyAccount` | Defer until deletion/retention policy and complete cascade tests pass | Do not expose partial deletion as successful account deletion. |

## MVP boundaries

- Keep Firebase Auth and Firestore on Spark.
- Initial proof of concept covers only text status creation, friend-request creation and direct-conversation creation.
- No media uploads or reels until a separate provider is selected and its free quota, no-card requirement, privacy and abuse controls are verified.
- STUN only. No TURN server, no promise of reliable calls across NAT/mobile networks.
- Teacher live sessions use an official YouTube embed; this is not an IMI-originated live broadcast.
- Defer push-trigger automation, automated expiry scheduler, teacher/admin workflows and account deletion until separately migrated and tested.

## Hosting and rate limits

Vercel Hobby is not a general-purpose free commercial hosting commitment. If the project is non-commercial and eligible, a personal prototype may use it within documented limits. Before public launch, confirm current Vercel terms or choose a provider whose free terms explicitly fit the intended use. Cloudflare is not approved until Admin SDK compatibility is proven.

Initial per-UID limits (implemented in the Next.js adapter, tunable after load tests): status create 1/30 seconds; friend request 10/hour and 30/day; direct conversation creation 20/minute. Per-IP ceilings and abuse monitoring remain a follow-up because a trustworthy client IP header depends on the selected host; never trust arbitrary X-Forwarded-For values. Store counters transactionally in Firestore with TTL-free manual cleanup; avoid billing-dependent TTL. These are application safety limits, not Firebase or host quotas.

## Exit / phase-2 indicators

Start phase-2 capacity planning before sustained use reaches 70% of any Spark daily quota, 70% of Firestore's 1 GiB storage, 70% of monthly egress, repeated rate-limit hits from legitimate users, or host CPU/duration/request caps. Also migrate immediately if media, reliable push processing, real TURN, strict deletion SLAs, or commercial use becomes a requirement.

Phase 2: obtain explicit owner approval for a budget and billing account; move trusted business logic behind a stable service interface to Cloud Run/Functions or another managed backend, provision media storage with lifecycle policies, add TURN, queues/outbox processing, observability, backups and a tested migration plan. No automatic upgrade or billing activation is permitted.

## Current status

Branch-only proof of concept validated on 2026-11-21: shared core unit tests, Auth Emulator missing/forged-token tests, Next.js route tests against Auth + Firestore Emulators, Web build/typecheck/health check, Functions build/tests, Firestore Rules Emulator tests, and Playwright browser E2E all passed in GitHub Actions. The emulator project ID is explicitly allowed only when both Auth and Firestore emulator hosts are present; production remains pinned to `imi-indroid`. No Firebase Console settings, real rules, production data, secrets, deployment, or merge were changed. The route tests use only disposable `demo-imi-playwright` emulator data and no service-account key.
