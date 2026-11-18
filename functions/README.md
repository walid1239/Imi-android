# IMI trusted Firebase backend

This package contains Firebase Cloud Functions. It uses the Admin SDK only on the server; never copy Admin credentials into the Android app or repository.

## Deploy prerequisites

- Select the intended Firebase project explicitly with `firebase use` (project ID must be verified before deployment).
- Ensure the project has the Blaze plan and Cloud Functions prerequisites.
- Install dependencies with `npm ci`, then run `npm run build`.
- Deploy only after reviewing the target project and rules: `firebase deploy --only functions`.

## Implemented callable

`createStatus` requires an authenticated Firebase user. It validates text and optional image MIME type, applies a per-user 30-second cooldown, and creates the status document with server-controlled creation and expiry timestamps. Expiry is exactly 28 hours after the function's server-side timestamp. It returns the status ID, expiry milliseconds, and a storage path when an image was requested.

The Android client must call this function before uploading the optional image. If upload fails, it should delete the newly-created status document. Firestore client writes to status documents are denied; Admin SDK writes bypass client rules.

## Not implemented here

WhatsApp OTP, friend discovery/acceptance, presence, notifications, delivery/read receipts, calls, moderation, and account migration are not implemented by this function. WhatsApp OTP requires Meta WhatsApp Business Cloud API credentials and an approved Authentication template; do not claim it is active until configured and tested end-to-end.
