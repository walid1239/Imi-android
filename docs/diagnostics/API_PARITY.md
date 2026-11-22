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


## Additional source-level risks in the four missing curriculum actions

A second read of the HTTP implementation found validation and consistency gaps that must be
covered before porting these operations into Functions:

- `createCurriculumNode` validates that a supplied parent exists, but does not validate
  that the parent type is the immediate allowed predecessor of the new node. It also does
  not reject a parent that is hidden or still needs review.
- `importCurriculumNodes` detects duplicate IDs within the batch, checks external parents
  exist, and detects cycles formed by parent links within the batch. It does not validate
  the parent/child type hierarchy, nor does it check that external parents are published
  and approved.
- `reorderCurriculumNode` increments or decrements one node's integer `order` in a
  transaction, but does not swap/resequence sibling nodes. It can therefore produce
  duplicate order values among siblings. Concurrent calls also need an explicit invariant
  and emulator race tests.
- `mergeCurriculumNode` checks source/target existence and matching types, requires the
  target to be published and approved, guards against moving into a descendant, moves
  direct children, and hides the source. It does not check the source's review/publication
  state or whether the target's parent/type placement remains valid after children move.
  Query phantoms and concurrent tree edits need emulator tests; transaction atomicity alone
  does not prove the tree invariants.

These are findings about the current HTTP code, not claims that a particular production
corruption has occurred. A safe implementation should define the curriculum type hierarchy
and sibling-order policy centrally, then validate both in transactions and test concurrent
create/import/reorder/merge scenarios against the Firestore Emulator.

## Scope

This is an inventory only. It makes no source-code, Firebase, deployment, PR, or
Firestore Rules changes.
