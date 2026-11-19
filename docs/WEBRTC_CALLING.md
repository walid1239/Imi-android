# IMI WebRTC Calling — implementation and release contract

## Current implementation (not production-verified)
- واجهة المكالمة داخل IMI وبالعربية؛ لا توجد صفحات مزود TURN خارجية.
- Web client uses `RTCPeerConnection`, authenticated callable `getIceServers`, public STUN fallback, configurable `iceTransportPolicy`, and up to two caller-side ICE restart attempts. Restart SDP is submitted through the server-authorized `restartCallIce` callable; the server enforces the two-restart cap and increments an SDP revision.
- Connection quality is estimated from selected-pair RTT. Direct/relay path is displayed only outside production builds.
- Audio/video permissions are requested after the user action and local tracks are stopped during cleanup.
- No Android call UI is present in this branch; the WebRTC call UI currently exists only in the web client.
- Coturn is owner-operated; Firebase Hosting/Functions are not used as TURN relays.

## Server ICE credentials
- `getIceServers` requires Firebase Auth. Anonymous sign-in is denied unless `TURN_ALLOW_ANONYMOUS=true`.
- TURN REST username is `unixExpiry:uid`; credential is Base64(HMAC-SHA1(TURN_SECRET, username)).
- Credentials expire after at most one hour. A per-UID Firestore transaction rate-limits issuance.
- ICE restart offers are written by `restartCallIce` only for the authenticated caller, only after acceptance, and at most twice per call. Callee answers must carry the current server-generated SDP revision; Firestore rules reject stale or repeated revisions.
- The shared secret is a Firebase Secret Manager secret and never returned to clients or logged.
- When TURN is unavailable, the function returns configured public STUN only. If callable retrieval fails, the client falls back to STUN and shows an Arabic warning.

## Client environment
- `NEXT_PUBLIC_STUN_URLS`: comma-separated STUN URLs, defaulting to `stun:stun.l.google.com:19302`.
- `NEXT_PUBLIC_ICE_TRANSPORT_POLICY`: `all` by default, or `relay` for controlled relay testing. Do not set relay-only for normal use before TURN is verified.
- These are public ICE settings, not secrets. Never place TURN_SECRET in a `NEXT_PUBLIC_*` variable.

## Required acceptance
1. Functions unit tests, Firestore Emulator rules tests, web typecheck and production build pass.
2. Two physical devices complete audio and video calls; both directions of audio/video work.
3. Hang-up releases tracks; a second call succeeds after the first.
4. Network changes and at least one ICE restart recover where supported.
5. Trickle ICE and real-device tests demonstrate relay candidates on restrictive networks.
6. Fill `docs/call-test-plan.md` with outcome, direct/relay, RTT and media quality for each scenario.

## Release gate
No call feature is declared production-ready until the owner completes the real-device test plan. CI and unit tests do not prove connectivity, audio/video quality, NAT traversal, or Coturn reachability. Firebase deployment and PR merge remain separate explicit approvals.
