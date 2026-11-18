# IMI Firebase security baseline

This repository is a native Android app. These files define a **security baseline**, not proof that Firebase is connected or deployed.

## Data model

- `users/{uid}`: private account document; owner-only.
- `publicProfiles/{uid}`: minimal public profile projection; readable only by authenticated users.
- `users/{uid}/friends/{friendUid}`: accepted friendship records. Client writes are deliberately denied; create them only through a trusted, authenticated server workflow after validating both users.
- `users/{uid}/statuses/{statusId}`: owner writes; owner and accepted friends read while unexpired. Maximum lifetime is 28 hours.
- `conversations/{conversationId}`: member list and bounded last-message preview.
- `conversations/{conversationId}/messages/{messageId}`: members read; a signed-in member may create a message only as themselves. Message edits and deletes are denied in this initial baseline.
- Storage paths are scoped to account or conversation membership and enforce MIME and size limits. Status media paths include the status document ID so reads can check its 28-hour expiry.

## Authentication decision

**Product decision: WhatsApp OTP.** Firebase Anonymous Authentication is only a temporary development fallback in the current client; it is not the production registration flow and must not be presented as phone verification.

Before production, implement a trusted Cloud Run or Cloud Functions service that:
- sends OTP through the WhatsApp Business Cloud API using an approved Authentication template;
- stores Meta credentials and Firebase Admin credentials only in managed server secrets;
- enforces OTP expiry, one-time use, attempt limits, resend cooldowns, and per-phone/IP rate limits;
- verifies the code server-side and issues a Firebase Custom Token;
- links or migrates existing anonymous UID data safely before changing the session flow.

Do not ship a production release claiming WhatsApp OTP works until the server flow, account recovery, and multi-device tests pass.

Never trust a UID supplied by the client as proof of identity. Every protected write must use `request.auth.uid` and server-side security rules.

## Important deployment blockers

1. Add the Android Firebase app with package name `com.walid.chat` to Firebase project `cosmic-altar-m6shk`.
2. Download that app's `google-services.json`. Keep it out of public commits; supply it to local builds or a protected CI secret/file mechanism.
3. Enable Anonymous sign-in in Firebase Authentication.
4. Create the Firestore database and Storage bucket in the intended region.
5. Review the rules against the final client data model and run Firebase Emulator Suite rules tests, including unauthenticated access, cross-user reads, non-member conversation reads/writes, oversized uploads, and expired statuses.
6. Deploy only the reviewed rules to the intended Firebase project after emulator tests pass.

## Safety notes

- The rules intentionally deny friend-list writes. A trusted backend endpoint or Cloud Function must validate friend requests and mutual acceptance before creating accepted friendship records.
- The initial rules do not implement delivery/read receipts, group membership changes, blocking, reporting, moderation, or end-to-end encryption.
- Firestore rules cannot filter arbitrary query results. Client queries must include constraints compatible with the rules, especially participant membership and status expiry.
- Friendship records must use the exact `status: 'accepted'` schema in both Firestore and Storage. Status media must use `users/{uid}/statuses/{statusId}/{fileName}` so Storage can check the matching Firestore expiry timestamp.
- Do not add broad `allow read, write: if true` rules, service-account keys, private signing keys, or admin credentials to the repository.
- Firebase Admin credentials belong only in a managed server environment, never in the Android APK.
