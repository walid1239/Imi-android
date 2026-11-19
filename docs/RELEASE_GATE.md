# IMI final release gate (preparation only)

**Status on 2026-11-19: NOT APPROVED FOR PRODUCTION DEPLOYMENT.**
This document is a release runbook. No command in this document has been executed against the production Firebase project.

## 1. Preflight — all must pass

- [ ] Confirm the exact production Firebase project is `imi-indroid`.
- [ ] Resolve `CONFIGURATION_NOT_FOUND` in Firebase Console. Enable only the authentication providers actually implemented and tested. Phone OTP is not yet implemented in this branch; do not promise or enable it as an IMI feature yet.
- [ ] Set all six `NEXT_PUBLIC_FIREBASE_*` web values in the chosen Hosting build environment. Add the public VAPID key only after FCM web configuration is complete. Never place service-account JSON or private keys in `NEXT_PUBLIC_*`.
- [ ] Confirm the Firebase Storage bucket is provisioned and the intended region is selected.
- [ ] Review Firestore and Storage rules with the Emulator security tests. Never deploy the current rules without reviewing the exact diff against production.
- [ ] Provision the TURN host and secret only after a separate owner decision. Coturn is not running and cross-network calling has not been accepted on physical devices.
- [ ] Run the full Web and Functions CI, Android CI, Emulator suite, accessibility checks, and physical-device acceptance matrix on the exact release commit.
- [ ] Complete legal review of `/privacy` and `/terms`; both pages are drafts and explicitly disclose incomplete account deletion/retention policy.
- [ ] Configure App Check and production rate limits. These are not confirmed as enabled in production by this repository audit.
- [ ] Confirm that no admin or teacher role is granted until the owner verifies the UID and authorization.

## 2. Local verification commands

Run from the repository root:

```powershell
npm install
npm run emulators:test
```

Run Functions tests:

```powershell
cd functions
npm install
npm test
cd ..
```

Run Web checks:

```powershell
cd web
npm install
npm run typecheck
npm run lint
npm run build
npm run test:health
cd ..
```

Run Android checks using the repository's Android CI workflow or Android Studio with the configured JDK/SDK. A CI APK is a debug artifact, not a signed release APK.

## 3. Production deployment order — requires the explicit owner phrase "نفّذ النشر"

Do not run any of these commands before the owner gives that exact approval and the preflight is green.

1. **Firestore and Storage rules**
   ```powershell
   firebase deploy --only firestore:rules,storage --project imi-indroid
   ```

2. **Cloud Functions**
   ```powershell
   firebase deploy --only functions --project imi-indroid
   ```

3. **Hosting**
   ```powershell
   firebase deploy --only hosting --project imi-indroid
   ```

4. **Domain and TLS**
   - Add the chosen domain in Firebase Hosting Console.
   - Copy the exact DNS records shown by Firebase into the domain registrar; do not guess A/AAAA/TXT records.
   - Wait for Firebase's domain verification and managed SSL certificate status to become active.
   - Recheck both apex and `www` hostnames if both are configured.
   - Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS origin in the build environment, then rebuild and deploy Hosting only after approval.

5. **Secrets**
   If the owner chooses and provisions Coturn, create the secret interactively (the secret value must be entered locally at the prompt and never pasted into Git, chat, logs, or this document):
   ```powershell
   firebase functions:secrets:set TURN_SECRET --project imi-indroid
   ```
   This command is deliberately not executed. Do not create a TURN secret until the TURN host and network have been tested.

## 4. Rollback plan

- Keep the last known-good release commit and the exact deployed Hosting release ID before deployment.
- If Firestore/Storage rules cause access regressions, redeploy the previously reviewed rules from the previous known-good commit:
  ```powershell
  git checkout <previous-known-good-commit> -- firestore.rules storage.rules
  firebase deploy --only firestore:rules,storage --project imi-indroid
  ```
  Restore the working tree to the intended feature branch after the operator confirms the rollback. Do not force-push or rewrite history.
- If a Function release regresses, check out the previous known-good Functions source and redeploy:
  ```powershell
  git checkout <previous-known-good-commit> -- functions
  firebase deploy --only functions --project imi-indroid
  ```
- If Hosting regresses, use Firebase Hosting Console → Hosting → Release history → select the previous known-good release → Roll back. Verify the restored release URL before changing DNS.
- Do not roll back Firestore data by deleting documents. Data migrations require a separately reviewed, non-destructive recovery plan.
- Re-run the smoke tests after rollback and record the exact release/commit.

## 5. Post-deployment smoke tests

- [ ] `GET /api/health` returns 200 and reports configuration/liveness only.
- [ ] `GET /api/v1/health` returns 200.
- [ ] The public landing page, `/privacy`, `/terms`, and `/academy` load over HTTPS.
- [ ] Published Academy content is readable while signed out; drafts remain inaccessible.
- [ ] Authentication providers work with real test accounts. Guest-to-permanent linking and phone OTP must not be claimed until separately implemented and tested.
- [ ] Two independent accounts can find each other, send/accept a friend request, and exchange text/media messages.
- [ ] Unauthorized users cannot read another conversation, forge sender identity, alter receipts, access another user's FCM tokens, or write their own admin claim.
- [ ] Storage rejects wrong MIME declarations, oversized files, non-member reads, and unauthorized writes. Metadata checks are not equivalent to malware or file-signature scanning.
- [ ] Reels upload/playback, likes/comments/follows/views/shares, reporting, and moderation are tested before enabling those controls publicly; several of these features remain unimplemented.
- [ ] Calls pass the two-physical-device matrix across Wi-Fi and cellular, with relay candidate verification and audio/video checks.
- [ ] Teacher verification, live rooms, recording, moderated chat, child-safety controls, and account deletion pass dedicated tests before enabling.
- [ ] Android signed release APK installs and launches on supported physical devices.

## 6. Deferred provider comparison — no provider selected

### LiveKit (live audio/video rooms)
- LiveKit Server and its media components are open source under Apache 2.0; self-hosting has no vendor licence charge, but compute, public bandwidth, TLS, monitoring and operations are still paid/owner responsibilities.
- LiveKit Cloud has a free Build plan for some services; the published pricing page shows paid plans starting at $50/month for Ship and $500/month for Scale. The exact WebRTC quotas and media egress should be recalculated for the expected audience before any adoption.
- Official references: https://docs.livekit.io/transport/self-hosting/ and https://livekit.com/pricing

### Cloudflare Stream (broadcast/video delivery)
- Current published pricing: $5/month per 1,000 minutes of stored video capacity; delivery is $1 per 1,000 minutes delivered. Ingress and encoding are free. WebRTC delivery became billable on 15 October 2026.
- Good managed delivery option, but not free for a live audience at scale.
- Official reference: https://developers.cloudflare.com/stream/pricing/

### Agora Interactive Live Streaming
- Published free tier: 10,000 standard participant minutes/month. Paid bundles currently list Starter at $45.99/month for 50,000 minutes, Pro $133.99 for 150,000 minutes, and higher tiers. Cloud Proxy has a separate minimum monthly base fee in some modes.
- Useful managed option; pricing is participant-minute based and should be estimated from actual host + audience minutes.
- Official reference: https://www.agora.io/en/pricing/interactive-live-streaming/

### Mux
- Free plan is on-demand only (up to 10 stored videos and 100,000 delivery minutes); live video is available on Pay-as-you-go, which lists a $20 monthly usage credit. Plus-quality live input starts at $0.025/min at 720p; delivery has a 100,000-minute monthly free allowance, then usage charges apply.
- Good managed video pipeline, but cost depends on ingest, storage and total audience delivery.
- Official references: https://www.mux.com/pricing and https://www.mux.com/docs/pricing/overview

**Decision:** use the current open-source WebRTC/Coturn prototype for controlled testing only. No TURN or live-streaming provider is selected, provisioned, or purchased. LiveKit self-hosting is the leading open-source candidate for a future live-room adapter, subject to architecture and security review.

## 7. Final gate

PR #2 must remain Draft and unmerged until the feature gaps, CI, Emulator tests, legal review, and physical-device acceptance criteria are resolved. Production deployment is a separate owner-approved operation. The assistant must stop at this gate and wait for the exact phrase **"نفّذ النشر"**.
