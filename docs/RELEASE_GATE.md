# IMI final release gate (preparation only)

**Status on 2026-11-20: NOT APPROVED FOR PRODUCTION DEPLOYMENT.**
This document is a release runbook. No command in this document has been executed against the production Firebase project.

## 1. Preflight — all must pass

- [ ] Confirm the exact production Firebase project is `imi-indroid`.
- [ ] Resolve `CONFIGURATION_NOT_FOUND` in Firebase Console. Enable only the authentication providers actually implemented and tested. Phone OTP is not yet implemented in this branch; do not promise or enable it as an IMI feature yet.
- [ ] Set all six NEXT_PUBLIC_FIREBASE_* web values in the selected host's build environment. Add NEXT_PUBLIC_FIREBASE_VAPID_KEY only after FCM web configuration is complete. NEXT_PUBLIC_* values are public browser configuration, never secrets. Never place service-account JSON, TURN_SECRET, or private keys in NEXT_PUBLIC_*.
- [ ] Confirm the Firebase Storage bucket is provisioned and the intended region is selected.
- [ ] Review Firestore and Storage rules with the Emulator security tests. Do not deploy the current rules until the users/{uid} client-write contract is reconciled with Android and the exact diff is approved.
- [ ] Provision the TURN host and secret only after a separate owner decision. Coturn is not running and cross-network calling has not been accepted on physical devices.
- [ ] Run the full Web and Functions CI, Android CI, Emulator suite, accessibility checks, and physical-device acceptance matrix on the exact release commit.
- [ ] Complete legal review of `/privacy` and `/terms`; both pages are drafts and explicitly disclose incomplete account deletion/retention policy.
- [ ] Configure App Check and production rate limits. These are not confirmed as enabled in production by this repository audit.
- [ ] Confirm that no admin or teacher role is granted until the owner verifies the UID and authorization.

## 2. Local verification commands

Use Node.js 22. The repository lockfiles are a required precondition for npm ci; do not claim reproducible installs until the root, functions/, and web/ lockfiles are committed and verified. Until then, use npm install only for local diagnostic work.

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

## 3. Backend deployment order — requires explicit owner approval

**Do not deploy the current Firestore rules yet.** The reviewed Android users/{uid} document shape and the current rules' client-write allowlist must first be reconciled and tested together. A green rules test alone does not prove Android compatibility. The owner must review the exact rule diff and approve it separately.

After that gate is resolved, and only after the owner explicitly authorizes deployment:

1. **Firestore and Storage rules/indexes** (only after Android users/{uid} compatibility is fixed and emulator tests pass)
   ```powershell
   firebase deploy --only firestore:rules,firestore:indexes,storage --project imi-indroid
   ```

2. **Cloud Functions**
   ```powershell
   firebase deploy --only functions --project imi-indroid
   ```

3. **Web hosting** — select a provider first; there is no Firebase Hosting target in firebase.json, so firebase deploy --only hosting is currently invalid. No Hosting backend or deployment is configured by this repository.

### Firebase App Hosting vs Vercel for Next.js 15

| Topic | Firebase App Hosting | Vercel |
|---|---|---|
| Next.js 15 / App Router | Official framework support for Next.js 13.5+; supports SSR and framework routing | First-class Next.js platform; supports App Router and Route Handlers |
| API endpoints | Next.js Route Handlers/API routes run in the server runtime | Next.js Route Handlers/API routes run as Functions |
| Git integration | GitHub-connected backend and managed Cloud Run rollout | Git-connected automatic CI/CD |
| Billing | Requires Blaze / a linked Cloud Billing account, even though usage has no-cost quotas | Hobby is $0 for eligible personal projects, with quotas and plan terms; Pro is paid |
| Fit with strict no-billing requirement | Not eligible: Blaze requires a billing account | Better for a no-cost prototype if Hobby terms/limits fit; do not assume unlimited production use |

**Recommendation:** Do not create Firebase App Hosting resources while the project must remain free of billing. For a prototype, Vercel Hobby is the lower-friction $0 option if the project's use is eligible and stays within its limits. Before a public/commercial social-network launch, verify Vercel plan eligibility and usage limits; a production-scale deployment may not remain free. Keep Firebase Functions as the separate backend unless the architecture is deliberately changed.

Official references:
- Firebase App Hosting framework support: https://firebase.google.com/docs/app-hosting/about-app-hosting
- Firebase App Hosting billing requirement and quotas: https://firebase.google.com/docs/app-hosting/costs
- Vercel plan pricing: https://vercel.com/pricing
- Next.js 15 Route Handlers: https://nextjs.org/docs/15/app/getting-started/route-handlers-and-middleware

Do not create an App Hosting backend, Firebase Hosting site, Vercel project, domain, or DNS records as part of this preparation-only change. web/apphosting.yaml is only a non-secret template: all six required Firebase web settings and the optional VAPID key contain placeholder values. Replace them with the real public Firebase Web App configuration in the App Hosting environment before any rollout; the Firebase Console values override file values. Never place TURN_SECRET or service-account credentials there.

### Region decision — pending owner approval

The proposed Cloud Functions region is europe-west1, but **no region change has been made**. Before changing it, confirm the Firestore database location and compare expected latency/egress. A regional callable must use the same region in the web SDK (getFunctions(app, "europe-west1")) and Android SDK (FirebaseFunctions.getInstance("europe-west1")). The current clients use the default region; changing only the backend would break callable discovery. The current Android client does call createStatus, so Android region parity is required. Wait for explicit approval before changing function deployment options or either client.

## 4. Rollback plan

- Keep the last known-good release commit and the exact deployed Hosting release ID before deployment.
- If Firestore/Storage rules cause access regressions, redeploy the previously reviewed rules from the previous known-good commit:
  ```powershell
  git checkout <previous-known-good-commit> -- firestore.rules storage.rules
  firebase deploy --only firestore:rules,firestore:indexes,storage --project imi-indroid
  ```
  Restore the working tree to the intended feature branch after the operator confirms the rollback. Do not force-push or rewrite history.
- If a Function release regresses, check out the previous known-good Functions source and redeploy:
  ```powershell
  git checkout <previous-known-good-commit> -- functions
  firebase deploy --only functions --project imi-indroid
  ```
- If the selected web host regresses, use that provider's deployment history to restore the previous known-good release. Firebase Hosting is not configured in this repository; App Hosting rollback is available only after an owner separately creates and approves an App Hosting backend.
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
