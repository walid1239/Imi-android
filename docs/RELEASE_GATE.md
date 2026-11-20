# IMI final release gate (preparation only)

**Status on 2026-11-20: NOT APPROVED FOR PRODUCTION DEPLOYMENT.**
This document is a release runbook. No command in this document has been executed against the production Firebase project.

## 1. Preflight — all must pass

- [ ] Confirm the exact production Firebase project is `imi-indroid`.
- [ ] Resolve `CONFIGURATION_NOT_FOUND` in Firebase Console. Enable only the authentication providers actually implemented and tested. Phone OTP is not yet implemented in this branch; do not promise or enable it as an IMI feature yet.
- [ ] Set all six NEXT_PUBLIC_FIREBASE_* web values in the selected host's build environment. Add NEXT_PUBLIC_FIREBASE_VAPID_KEY only after FCM web configuration is complete. NEXT_PUBLIC_* values are public browser configuration, never secrets. Never place service-account JSON, TURN_SECRET, or private keys in NEXT_PUBLIC_*.
- [ ] Do not provision/use Firebase Storage under Spark: Firebase Storage now requires Blaze for bucket access. Media uploads remain blocked unless a separate storage provider is approved or billing is explicitly authorized.
- [ ] Review Firestore and Storage rules with the Emulator security tests. The Android users/{uid} contract is now aligned for displayName, city, photoPath, bio, languages, and updatedAt; Emulator tests cover private fields. This is not a production deployment. Review the exact diff and obtain the owner's explicit approval before deploying Firestore rules.
- [ ] Provision the TURN host and secret only after a separate owner decision. Coturn is not running and cross-network calling has not been accepted on physical devices.
- [ ] Run the full Web and Functions CI, Android CI, Emulator suite, accessibility checks, and physical-device acceptance matrix on the exact release commit.
- [ ] Complete legal review of `/privacy` and `/terms`; both pages are drafts and explicitly disclose incomplete account deletion/retention policy.
- [ ] Configure App Check and production rate limits. These are not confirmed as enabled in production by this repository audit.
- [ ] Confirm that no admin or teacher role is granted until the owner verifies the UID and authorization.


### Authentication identity and provider configuration

- `CONFIGURATION_NOT_FOUND` means Firebase Auth has no identity-provider configuration for the attempted sign-in. The repository cannot read or change Firebase Console provider settings; the real project must have Authentication initialized and the intended providers enabled (Anonymous, Email/Password, Google). For Google Android sign-in, add the app's SHA-1 fingerprint and download the updated `google-services.json`.
- Android currently calls `signInAnonymously()` only. Anonymous users on separate devices receive separate UIDs, so cross-device identity is not unified. Web supports guest-to-permanent credential linking, but the native Android client does not yet expose email/Google linking. Do not claim cross-device account sync until that Android flow is implemented and tested. No OTP is required or enabled by this plan.

## 2. Local verification commands

Use Node.js 22 and JDK 21 or later for Firebase Emulator Suite (Android Gradle build continues to use JDK 17). The root, functions/, and web/ lockfiles are committed (lockfileVersion 3) and generated with npm 22. Use npm ci from each package root for reproducible installs.

**Billing gate:** Firebase requires Blaze / linked Cloud Billing to deploy Cloud Functions. Firebase Storage also requires Blaze for bucket access as of 2026-02-03, so Spark cannot be used for project media uploads even when a bucket name is present. Under the no-billing constraint, Functions can be typechecked and emulator-tested but not deployed; Storage-backed uploads are blocked. Authentication (Email/Password, Google, Anonymous), Firestore within Spark quotas, and Firebase Hosting within its free quotas remain possible. Phone Auth/SMS and Blaze services are not approved. Do not enable billing.

Run from the repository root:

```powershell
npm ci
npm run emulators:test
```

Run Functions tests:

```powershell
cd functions
npm ci
npm test
cd ..
```

Run Web checks:

```powershell
cd web
npm ci
npm run typecheck
npm run lint
npm run build
npm run test:health
cd ..
```

Run Android checks using the repository's Android CI workflow or Android Studio with the configured JDK/SDK. A CI APK is a debug artifact, not a signed release APK.

## 3. Backend deployment order — requires explicit owner approval

**Firestore contract status:** Android writes `displayName`, `city`, `photoPath`, `bio`, `languages`, and `updatedAt` to its private `users/{uid}` document. The rules now allow the private `bio` and `languages` fields with size/type limits; avatar creation writes the required base profile fields. Emulator tests cover allowed and denied cases. This remains source-level/Emulator evidence only; no production rules have been deployed.

After that gate is resolved, and only after the owner explicitly authorizes deployment:

1. **Firestore rules/indexes only** (possible on Spark; only after the final rules tests pass and the owner authorizes it)
   ```powershell
   firebase deploy --only firestore:rules,firestore:indexes --project imi-indroid
   ```
   Storage rules and bucket access are excluded under the no-Blaze constraint.

2. **Cloud Functions**
   ```powershell
   firebase deploy --only functions --project imi-indroid  # requires Blaze; owner approval only
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
- [ ] Storage-backed media tests are BLOCKED under Spark because Firebase Storage requires Blaze. Do not claim upload safety or media functionality until an approved storage provider is available. Metadata checks are not equivalent to malware or file-signature scanning.
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
