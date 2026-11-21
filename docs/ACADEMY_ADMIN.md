# IMI Academy administration

Academy authoring and publishing is restricted to Firebase Authentication users whose **server-issued custom claim** is exactly `admin: true`. A client cannot grant itself this claim. Firestore client writes to `courses` and `lessons` remain denied; learners can only read published content.

## Provision the first administrator (trusted operator only)

1. Use a trusted workstation with Firebase Admin SDK Application Default Credentials for the intended project. Do not put service-account JSON in the repository, browser, or chat.
2. From `functions/`, install dependencies if needed, then set:
   - `GCLOUD_PROJECT=imi-indroid`
   - `IMI_ADMIN_UID=<the exact Firebase Auth UID of the administrator>`
   - `CONFIRM_GRANT_IMI_ADMIN=GRANT_ADMIN_TO_<the exact same UID>`
3. Run `node scripts/grant-admin.cjs`.
4. Confirm the script reports that the claim was granted and verified. The administrator must sign out/in or refresh the Firebase ID token before using admin callables.
5. To revoke, use a trusted Admin SDK session and remove only the `admin` key while preserving other custom claims.

This script changes Firebase Authentication custom claims only when deliberately run by an operator with Admin SDK credentials. It is not part of deployment and has not been run against `imi-indroid`.

## Callable workflow

All functions below reject unauthenticated users and users without `admin: true`:

- `createCourse({title, description, category})` creates a draft course and returns `courseId`.
- `createCourseLesson({courseId, title, content, videoUrl, order})` adds a draft lesson while its course is still unpublished.
- `publishCourse({courseId, published: true|false})` publishes or unpublishes a course. Publishing requires at least one lesson.
- `publishCourseLesson({courseId, lessonId, published: true|false})` publishes/unpublishes a lesson. Publishing a lesson requires its parent course to be published.

Course and lesson documents carry server timestamps and creator UID. Learner enrollment and lesson completion remain separate server-validated callables.

## Operational note

Deploy the Functions and Firestore rules/indexes through the reviewed deployment workflow before calling these functions in production. No Firebase deployment has been performed by this change.


## Teacher verification status

Teacher-specific authorization is **not implemented yet**. The current backend recognizes only the server-issued `admin: true` claim for Academy authoring and publishing. There is no teacher claim, teacher-scoped callable policy, or teacher verification workflow in this branch. Do not set a `teacher: true` claim or present an account as a verified teacher until the role model, permitted actions, review evidence, and revocation path are implemented and tested. The existing local script provisions only the first administrator and must not be repurposed for teacher accounts.
