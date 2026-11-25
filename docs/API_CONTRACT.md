# IMI API Contract (Preview)

**Source of truth:** route handlers and shared server code on feature/imi-teacher-admin-preview. This document describes the contract as implemented; it does not promise that every feature is enabled in the deployed environment.

**Base URL:** https://imi-api-preview.vercel.app

## Authentication and request conventions

All write endpoints under /api/v1 require a Firebase Authentication ID token:

- Authorization: Bearer <Firebase ID token>
- Content-Type: application/json

Do not send a Firebase refresh token, UID, Google OAuth access token, or Vercel OIDC token as the bearer token. The server verifies the ID token with revocation checking enabled and derives the caller UID from the verified token. Never accept a caller UID in the JSON body as the authenticated identity.

GET /api/v1/health is public. GET /api/v1/health/admin has its own admin-only bearer check and is disabled by default unless IMI_ADMIN_HEALTH=true.

For browser requests, if an Origin header is present it must match the request origin. Native clients may omit Origin; bearer authentication is still mandatory.

Write requests must use POST, a JSON object body, and a body no larger than 8 KiB (account deletion has a 2 KiB limit). JSON arrays and primitive JSON values are rejected.

Successful write responses use { "ok": true, "data": { ... } }. Errors use { "error": "human-readable message" }.

## Endpoints

### Health

| Method and path | Auth | Request | Success |
|---|---|---|---|
| GET /api/v1/health | None | No body | 200: status=ok, service=imi-web, timestamp (ISO), firebase.configured, firebase.projectId, note |
| GET /api/v1/health/admin | Firebase ID token; custom claim admin === true | No body | 200: status=ok, service=imi-admin-api, firestoreRead=true |

The public health response checks the presence of public Firebase configuration variables only. It is not proof of a successful Firebase Auth or Firestore operation. The admin probe returns 404 when IMI_ADMIN_HEALTH is not exactly true; when enabled, it reads adminHealth/probe and requires its status field to equal "ok".

### Statuses

#### POST /api/v1/status

Creates a text-only status.

Request fields:
- text: required non-empty string after trimming; maximum 700 characters.
- mediaType: do not send. Media metadata is rejected in the Spark phase, even for otherwise allowed image MIME types.

Success data: statusId, expiresAtMillis, mediaPath=null. Expiry is set to 28 hours after server creation time.

### Friends and blocking

| Method and path | JSON body | Successful data |
|---|---|---|
| POST /api/v1/friends/requests | { "toUid": "<target uid>" } | { "requestId": "<fromUid>__<toUid>", "status": "pending" } |
| POST /api/v1/friends/requests/accept | { "requestId": "<request id>" } | { "status": "accepted" } |
| POST /api/v1/friends/requests/reject | { "requestId": "<request id>" } | { "status": "rejected" } |
| POST /api/v1/friends/remove | { "friendUid": "<friend uid>" } | { "status": "removed" } |
| POST /api/v1/users/block | { "targetUid": "<target uid>" } | { "status": "blocked" } |
| POST /api/v1/users/unblock | { "targetUid": "<target uid>" } | { "status": "unblocked" } |

UID fields must be non-empty strings, at most 128 characters, and must not contain /. A user cannot send a request to, remove, or block themselves. Friend requests and private conversations enforce teacher/student role restrictions and block relationships in server logic.

### Conversations

| Method and path | JSON body | Successful data |
|---|---|---|
| POST /api/v1/conversations/direct | { "otherUid": "<other user uid>" } | { "conversationId": "<id>" } |
| POST /api/v1/conversations/groups | { "name": "<2-80 chars>", "participantUids": ["<uid>", "<uid>"] } | { "conversationId": "<id>", "participantCount": 3 } |
| POST /api/v1/conversations/groups/members | { "conversationId": "<group id>", "participantUids": ["<uid>"] } | { "participantCount": "<current count>" } |

Rules:
- Direct conversation: otherUid is required and cannot equal the caller UID. Both users must have public profiles; blocks and the verified-teacher role boundary are enforced.
- Create group: name is 2–80 characters. participantUids contains 2–49 other member UIDs; the caller is added automatically. Final group size is 3–50. Every other participant must already be a confirmed friend of the caller; all participants must satisfy the same teacher/student role check.
- Add group members: caller must be a group admin. participantUids contains 1–20 UIDs. Added users must have public profiles and be confirmed friends of the caller. Maximum group size is 50. Duplicate/already-present UIDs are ignored.

### Teacher application and profile

#### POST /api/v1/teachers/applications

Request fields:
- fullName: required, 3–80 characters.
- proofUrl: required HTTPS URL, maximum 500 characters; embedded username/password are rejected.
- subjectIds: 1–12 unique IDs of published curriculum nodes of type subject.
- levelIds: 1–12 unique IDs of published curriculum nodes of type level.

A user already holding teacherVerified=true cannot apply; an existing pending application is rejected.

Success data: { "status": "pending" }.

#### POST /api/v1/teachers/profile

Request fields:
- bio: required, 30–1200 characters.
- photoPath: must be the empty string. Teacher photo upload is not available in this implementation.
- contentAgreement and childSafetyAgreement: both must be exactly true.
- subjectIds and levelIds: each 1–12 unique IDs of published curriculum nodes with the corresponding node type.

Caller must have teacherVerified=true and an approved application.

Success data: { "profileComplete": true, "photoPath": "" }.

### Teacher administration

#### POST /api/v1/admin/teachers/review

Requires the caller's Firebase Auth custom claim admin=true.

Request fields:
- uid: required target UID matching [A-Za-z0-9_-]{2,128}.
- approved: required boolean.
- note: optional string, trimmed and truncated to 500 characters.

Success data: { "status": "approved" | "rejected", "claimsSync": "applied" }. The server updates the application decision and synchronizes the target user's teacherVerified claim. Repeating the same decision is accepted to allow claim-sync retry.

### Curriculum administration

#### POST /api/v1/admin/curriculum/publish

Requires the caller's Firebase Auth custom claim admin=true.

Request fields:
- scopeId: required ID matching [a-z0-9][a-z0-9_-]{1,100}; it must identify an existing curriculum node of type level.
- dryRun: optional boolean; defaults to true. Only the literal value false performs publication.
- confirmation: when dryRun is false, must equal PUBLISH.

Success data: { "dryRun": true, "scopeId": "<id>", "count": 0, "byType": {} }. The operation considers eligible hidden/review-required curriculum descendants under the selected level, with a maximum of 5,000 targets, and writes an audit log when publication occurs.

### Reels

#### POST /api/v1/reels/prepare

Request fields:
- reelId: required; matches [A-Za-z0-9_-]{8,128}.
- caption: optional; defaults to empty and may not exceed 300 characters.
- contentType: required; video/mp4 or video/webm.

Success data: { "reelId": "<id>", "status": "uploading", "storagePath": "reels/<caller uid>/<id>/video.mp4" }. This endpoint creates the Firestore upload record; it does not upload video bytes.

#### POST /api/v1/reels/submit

Request fields:
- reelId, caption and contentType: same rules as prepare.
- storagePath: required; must exactly match the path derived from the verified caller UID, reel ID, and content type.

The server verifies that the Storage object exists, has the matching content type, is larger than zero and no larger than 100 MiB, and matches the Firestore upload record.

Success data: { "reelId": "<id>", "status": "pending" }.

#### POST /api/v1/reels/review

Requires admin=true.

Request fields:
- reelId: matches [A-Za-z0-9_-]{8,128}.
- decision: approved or rejected.
- note: optional; trimmed and truncated to 500 characters.

Only a reel currently in pending status can be reviewed.

Success data: { "reelId": "<id>", "status": "approved" | "rejected" }.

### Account deletion

#### POST /api/v1/account/delete

Requires a Firebase ID token and a recent authentication event (auth time no older than five minutes). The endpoint is disabled unless IMI_ACCOUNT_DELETION_ENABLED=true.

Request: { "confirmation": "DELETE" }. Body limit: 2 KiB. Confirmation must exactly equal DELETE.

Success response: { "ok": true, "data": { "deleted": true } }. The handler attempts Storage and Firestore cleanup before deleting the Firebase Auth user. It is deliberately disabled by default.

## Common HTTP errors

| HTTP | Meaning |
|---:|---|
| 400 | Invalid JSON/object body or invalid argument. |
| 401 | Missing, malformed, expired, revoked, or invalid Firebase ID token. |
| 403 | Origin rejected, admin claim missing, permission denied, or role/block restriction. |
| 404 | Resource not found; admin health is also 404 when disabled. |
| 405 | Method not allowed (write routes require POST). |
| 409 | Already exists or failed precondition (including stale workflow/state). |
| 412 | Account deletion requires a recent sign-in. |
| 413 | Request body exceeds endpoint limit. |
| 415 | Content-Type is not application/json. |
| 429 | Rate limit exceeded. |
| 500/503 | Internal/configuration/service failure. Most shared write-handler failures are returned as 503 with a generic Arabic message; account deletion has its own error mapping. |

Core error mapping: unauthenticated → 401; invalid-argument → 400; resource-exhausted → 429; permission-denied → 403; not-found → 404; already-exists → 409; failed-precondition → 409.

## Server-side rate limits

| Operation | Limit |
|---|---:|
| Submit teacher application | 3 per 24 hours |
| Review teacher application | 60 per minute |
| Save teacher profile | 5 per minute |
| Create status | 2 per minute (also a 30-second minimum interval) |
| Send friend request | 10 per hour and 30 per 24 hours |
| Create/get direct conversation | 20 per minute |
| Accept/reject friend request | 30 per minute each |
| Remove friend / block user | 10 per minute each |
| Unblock user | 20 per minute |
| Create group | 5 per minute |
| Add group participants | 10 per minute |
| Prepare/submit reel | 3 per hour each |
| Review reel | 60 per minute |
| Delete account | 1 per 24 hours |

## Implementation notes and non-guarantees

- This contract is derived from web/src/app/api/v1/**/route.ts, web/src/lib/server/imi-api.ts, functions/src/shared/serverCore.ts, and functions/src/shared/serverAuth.ts on the branch named above.
- Firestore listeners/queries for messages, friend lists, profiles, and feed reads are not REST endpoints in this contract; clients use the Firebase SDK and Firestore security rules for those reads.
- This contract does not imply that Firebase Admin credentials, Workload Identity Federation, Storage, or every Preview environment variable are correctly configured. Admin-backed requests can fail with a generic service error until the hosting identity configuration is valid.
- Firebase Spark restrictions are reflected in text-only status behavior and the teacher profile's empty photoPath requirement. Reels require a real Storage object and are not guaranteed available in a given environment.
- Do not treat the public health endpoint as a Firebase connectivity test.
