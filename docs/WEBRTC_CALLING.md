# IMI WebRTC Calling — implementation contract

## Current verified state

The current `feature/imi-web-foundation` tree contains no WebRTC peer-connection implementation, call-signaling collections, or call UI. The chat UI currently supports text messages only. Do not describe voice/video calling as operational until the acceptance checks below pass on two real devices.

## Scope

Implement one-to-one audio and video calls between authenticated IMI users. Group calls are out of scope for this first release. Calls must be initiated from an existing conversation whose two participants have an accepted friendship.

## Firestore model

`calls/{callId}`:
- `callerUid`, `calleeUid`: immutable authenticated user IDs
- `conversationId`: conversation containing exactly those two participants
- `kind`: `audio` or `video`
- `status`: `ringing`, `accepted`, `rejected`, `ended`, or `missed`
- `createdAt`, `updatedAt`, `expiresAt`: server timestamps
- `offer`, `answer`: WebRTC session descriptions; write-once by the appropriate participant

Subcollections:
- `callerCandidates/{candidateId}`
- `calleeCandidates/{candidateId}`

Candidate documents contain only ICE candidate fields and are writable/readable only by the two call participants. Clients must never be able to change caller/callee/conversation identity or move a terminal call back to a live state.

## Server responsibilities

Use callable Cloud Functions for call creation and terminal transitions:
1. `createCall` authenticates the caller, validates the conversation and accepted friendship, verifies the callee is the other participant, and creates a short-lived `ringing` call with server timestamps.
2. `respondToCall` allows only the callee to accept or reject a ringing call.
3. `endCall` allows either participant to end an active/ringing call.
4. Expiry handling marks unanswered calls missed. A client clock must not decide authoritative expiry.

Validate IDs, call status transitions, and rate limits on the server. Do not trust a client-provided UID.

## Web client responsibilities

- Use `RTCPeerConnection`, request microphone/camera permission only after a user gesture, and stop all local media tracks when a call ends or the component unmounts.
- Exchange offer/answer and ICE candidates through the call document and the two candidate subcollections.
- Handle permission denial, unsupported browsers, network failure, callee busy/unavailable, timeout, and remote hang-up.
- Audio-only calls must not request camera access.
- Do not silently fall back to demo media or fake connected states.

## Network requirements

IMI intentionally does not use public STUN/TURN endpoints or third-party relay services. Until the project-owned Coturn server is configured, the client supplies no external ICE servers and can connect only when direct host connectivity is possible; calls across restrictive NATs, carrier-grade NATs, or separate networks may fail. Production reliability requires the owner-operated Coturn service with authenticated, short-lived credentials delivered securely. Never commit TURN shared secrets or static credentials to the repository or browser bundle. Validate relay connectivity before claiming production readiness.

## Security rules

Firestore rules must:
- Require authentication and membership in the call's immutable caller/callee pair.
- Permit only the designated caller to create the offer and only the callee to create the answer.
- Restrict candidate access to call participants.
- Prevent clients from changing immutable identity fields or writing arbitrary status transitions.
- Deny all access to nonparticipants, including reads of call metadata.
- Keep all authoritative transitions in trusted Cloud Functions.

Add emulator tests for caller/callee access, nonparticipant denial, offer/answer ownership, candidate isolation, immutable fields, and invalid status transitions.

## Release acceptance

Do not mark calling complete until:
- Functions unit tests and Firestore emulator rules tests pass.
- Web typecheck and production build pass.
- Two separate physical devices can complete audio and video calls.
- Both directions of audio/video are verified, hang-up cleans up tracks, and a second call succeeds after the first ends.
- A TURN-relayed call is demonstrated on networks where direct ICE fails.
- No secrets are present in Git history or client bundles.

## Current release gate

Calling is **not implemented or verified** in the current branch. The next implementation change must add the server call lifecycle and restrictive rules before exposing call controls in the UI. Firebase deployment and PR merge remain separate, explicit release decisions.
