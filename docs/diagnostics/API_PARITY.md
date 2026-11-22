# IMI API parity inventory

Audit date: 2026-11-22
Audited ref: `feature/cloudflare-import-diagnostics`
Audited commit: `747950263022437985e439e7488a3a0bcc1f29e0`

This inventory compares the Next.js HTTP handlers backed by `web/src/lib/server/imi-api.ts`
with callable exports in `functions/src/index.ts` and shared operations in
`functions/src/shared/serverCore.ts`.

## Operation parity

| HTTP operation | Shared core implementation | Firebase callable export | Assessment |
|---|---|---|---|
| createStatus | yes | yes | Logic exists in Functions |
| createOrGetDirectConversation | yes | yes | Logic exists in Functions |
| sendFriendRequest | yes | yes | Logic exists in Functions |
| acceptFriendRequest | yes | yes | Logic exists in Functions |
| rejectFriendRequest | yes | yes | Logic exists in Functions |
| removeFriend | yes | yes | Logic exists in Functions |
| blockUser | yes | no | Callable wrapper missing |
| unblockUser | yes | no | Callable wrapper missing |
| createGroupConversation | yes | no | Callable wrapper missing |
| addGroupParticipants | yes | no | Callable wrapper missing |
| enrollInCourse | HTTP-local | yes | Similar operation exists in Functions |
| completeCourseLesson | HTTP-local | yes | Similar operation exists in Functions |
| reportAcademyLesson | HTTP-local | yes | Callable exists |
| academyAdmin.createCourse | HTTP-local | yes | Callable exists |
| academyAdmin.createCourseLesson | HTTP-local | yes | Callable exists; behavior differs for videoUrl |
| academyAdmin.publishCourse | HTTP-local | yes | Callable exists |
| academyAdmin.publishCourseLesson | HTTP-local | yes | Callable exists |
| academyAdmin.reviewContentReport | HTTP-local | yes | Callable exists |
| academyAdmin.reviewCurriculumNode | HTTP-local | yes | Callable exists |
| academyAdmin.reviewTeacherContent | HTTP-local | no | Missing callable |
| academyAdmin.createCurriculumNode | HTTP-local | no | Missing callable |
| academyAdmin.importCurriculumNodes | HTTP-local | no | Missing callable |
| academyAdmin.reorderCurriculumNode | HTTP-local | no | Missing callable |
| academyAdmin.mergeCurriculumNode | HTTP-local | no | Missing callable |
| academyAdmin.reviewTeacherApplication | HTTP-local | no | Missing callable; also mutates Firebase Auth custom claims |

## Important non-equivalences

The presence of a callable with a matching name does **not** make it a safe drop-in
replacement for the HTTP route:

1. The HTTP handler verifies bearer tokens with revocation checking, checks request
   origin, limits JSON body size, and applies per-operation Firestore transaction-based
   rate limits. The callable wrappers must be checked for equivalent abuse controls
   before the web client is switched.
2. HTTP and callable request/response envelopes differ. Client call sites and error
   mapping require deliberate adaptation and tests.
3. `createCourseLesson` differs: the HTTP implementation rejects every non-empty
   `videoUrl` in the free-first-stage path; the callable implementation accepts HTTPS
   URLs after validation. Do not silently change this policy.
4. `reviewTeacherApplication` updates Auth custom claims as well as Firestore state.
   A Firestore-only REST adapter cannot reproduce this operation.
5. The Cloudflare Worker smoke test currently fails while evaluating
   `firebase-admin/firestore` because protobufjs attempts dynamic code generation
   blocked by the Worker runtime. This is a module/runtime compatibility failure, not
   merely an endpoint response bug.
6. Replacing Admin SDK writes with ordinary Firebase client REST requests is not
   authorized by the current Firestore Rules for server-owned collections. Do not
   loosen those rules to make the adapter pass.

## Free-tier / deployment boundary

The repository can typecheck and emulator-test Functions code, but the current
owner constraint is Firebase Spark only, with no Blaze upgrade. Cloud Functions
deployment is therefore not an available release path under the stated constraints.
No runtime service-account secret has been authorized for Cloudflare. Do not add
credentials to the repository, CI logs, or chat.

## Safe implementation order

1. Keep this audit branch isolated; do not merge it wholesale into the web foundation PR.
2. Add tests for the four missing core callables (block, unblock, group create, group add)
   only if a Functions-based deployment path is approved.
3. For Academy, implement and test the five missing admin actions, including Auth claims
   outbox/idempotency for teacher-application review.
4. Align rate limits, token revocation semantics, request validation, and error mapping.
5. Only then migrate the web client to callable APIs. This still does not make the
   functions deployable on Spark.
6. Re-run emulator tests and Worker smoke tests after any source change. Never mark
   production approved based on local or emulator-only evidence.

## Scope

This is an inventory only. It makes no source-code, Firebase, deployment, PR, or
Firestore Rules changes.
