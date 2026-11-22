# IMI API parity inventory

Audit date: 2026-11-22
Audited ref: `feature/cloudflare-import-diagnostics`
Audited source commit: `747950263022437985e439e7488a3a0bcc1f29e0`

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
| blockUser | yes | yes (socialSafety.ts) | Callable exists; implementation differs from shared core |
| unblockUser | yes | yes (socialSafety.ts) | Callable exists; implementation differs from shared core |
| createGroupConversation | yes | yes (socialSafety.ts) | Callable exists; implementation differs from shared core |
| addGroupParticipants | yes | yes (socialSafety.ts) | Callable exists; implementation differs from shared core |
| enrollInCourse | HTTP-local | yes | Similar operation exists in Functions |
| completeCourseLesson | HTTP-local | yes | Similar operation exists in Functions |
| reportAcademyLesson | HTTP-local | yes | Callable exists |
| academyAdmin.createCourse | HTTP-local | yes | Callable exists |
| academyAdmin.createCourseLesson | HTTP-local | yes | Callable exists; behavior differs for videoUrl |
| academyAdmin.publishCourse | HTTP-local | yes | Callable exists |
| academyAdmin.publishCourseLesson | HTTP-local | yes | Callable exists |
| academyAdmin.reviewContentReport | HTTP-local | yes | Callable exists |
| academyAdmin.reviewCurriculumNode | HTTP-local | yes | Callable exists |
| academyAdmin.reviewTeacherContent | HTTP-local | yes (teacher.ts) | Callable exists; compare review/audit semantics |
| academyAdmin.createCurriculumNode | HTTP-local | no | Missing callable |
| academyAdmin.importCurriculumNodes | HTTP-local | no | Missing callable |
| academyAdmin.reorderCurriculumNode | HTTP-local | no | Missing callable |
| academyAdmin.mergeCurriculumNode | HTTP-local | no | Missing callable |
| academyAdmin.reviewTeacherApplication | HTTP-local | yes (teacher.ts) | Callable exists; uses claims outbox; compare HTTP semantics |

**Missing callable gap count: 4 operations total** — the four missing Academy curriculum
admin actions listed below. The four social-safety callables and both teacher-review callables
are exported from separate modules and re-exported by `functions/src/index.ts`.

## Important non-equivalences

The presence of a callable with a matching name does **not** make it a safe drop-in
replacement for the HTTP route. In particular, the HTTP route and callable implementations
for social safety are separate code paths and require behavioral parity tests:

1. The HTTP handler verifies bearer tokens with revocation checking, checks request
   origin, limits JSON body size, and applies per-operation Firestore transaction-based
   rate limits. The callable wrappers must be checked for equivalent abuse controls
   before the web client is switched.
2. The social-safety callable implementations are in `functions/src/socialSafety.ts`
   (re-exported by `functions/src/index.ts`), not wrappers around `serverCore.ts`. They
   differ in transaction boundaries and concurrency protections; for example, the shared
   core blocks calls after committing the block and then re-queries active calls, while the
   callable queries active calls inside the initial transaction. Group creation and adding
   members also perform some relationship/profile checks outside the final write transaction.
   These paths need emulator tests for races and invariants before considering them equivalent.
3. HTTP and callable request/response envelopes differ. Client call sites and error
   mapping require deliberate adaptation and tests.
4. `createCourseLesson` differs: the HTTP implementation rejects every non-empty
   `videoUrl` in the free-first-stage path; the callable implementation accepts HTTPS
   URLs after validation. Do not silently change this policy.
5. Both teacher-review callables are exported from `functions/src/teacher.ts`.
   `reviewTeacherApplication` queues custom-claim synchronization through the claims outbox;
   a Firestore-only REST adapter cannot reproduce this operation.
6. The Cloudflare Worker smoke test currently fails while evaluating
   `firebase-admin/firestore` because protobufjs attempts dynamic code generation
   blocked by the Worker runtime. This is a module/runtime compatibility failure, not
   merely an endpoint response bug.
7. Replacing Admin SDK writes with ordinary Firebase client REST requests is not
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
2. Implement and test the **four** missing Academy curriculum actions
   (`createCurriculumNode`, `importCurriculumNodes`, `reorderCurriculumNode`, and
   `mergeCurriculumNode`) only if a Functions-based deployment path is approved.
3. Add emulator tests proving social-safety callable concurrency and transaction invariants;
   compare the teacher-review callables against the HTTP outbox/audit semantics.
4. Align rate limits, token revocation semantics, request validation, and error mapping.
5. Only then migrate the web client to callable APIs. This still does not make the
   functions deployable on Spark.
6. Re-run emulator tests and Worker smoke tests after any source change. Never mark
   production approved based on local or emulator-only evidence.


## Isolated callable implementation prototype

Branch: `feature/curriculum-admin-callables`
Latest implementation commit at this audit: `b4d87d1c381cadff293b32d86f492c1f1faa30ba`

A new callable, `academyCurriculumAdminAction`, was added in
`functions/src/curriculumAdmin.ts` and exported from `functions/src/index.ts`.
It accepts the existing HTTP action names for the four missing operations:
`createCurriculumNode`, `importCurriculumNodes`, `reorderCurriculumNode`,
and `mergeCurriculumNode`.

Additional guards in this prototype:
- Admin custom claim is required for all four actions.
- A Firestore transaction rate limit mirrors the HTTP Academy admin policy: 20 requests per actor per minute.
- Node parent types must follow level → track → subject → unit; a level is a root.
- Import batches reject duplicate IDs, cycles, invalid parent type chains, and missing external parents.
- Merge rejects incompatible child types and stops if more than 450 children would be written in one transaction.

A unit-test file was added at `functions/test/curriculumAdmin.test.cjs` for pure
hierarchy and input-validation helpers. **These tests have not yet been executed.**
The GitHub commit has no associated workflow runs or commit statuses at the time of
this check. No successful TypeScript build, test run, or emulator execution is claimed.

Known behavior still matching the HTTP route rather than improving it:
- `reorderCurriculumNode` applies a +1/-1 numeric delta; it does not swap sibling order values.
  Duplicate order values remain possible and require a separate product/behavior decision.
- This callable is a new Functions endpoint; the web client still calls the HTTP route.
  No client migration, deployment, Firebase mutation, or production release occurred.
- The implementation is on an isolated branch and has not been merged into the diagnostic
  branch or the web foundation PR.

Before considering this prototype usable, run `npm ci && npm test` in `functions/`,
then Firebase Emulator integration tests covering authorization, parent validation,
batch imports, merge limits, and concurrent mutations. A successful local/emulator test
would still not make Cloud Functions deployable under the Spark-only constraint.

## Scope

The original parity inventory records the HTTP/callable comparison. The isolated prototype
adds source code and unit-test scaffolding on `feature/curriculum-admin-callables` only.
It has not changed Firebase project configuration, Firestore data/rules, deployment state,
or the web foundation PR. Draft PR #3 targets only the diagnostic branch and must not be
merged until builds, tests, and emulator verification pass.
