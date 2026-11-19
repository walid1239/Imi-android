# IMI dependency and security audit

Audit date: 19 November 2026
Scope: repository dependency audit and CI checks on the feature branch. This is not a penetration test and does not certify production security.

## Automated npm audit

| Package area | Command | Observed result | Status |
|---|---|---|---|
| Web | `npm audit --audit-level=high` | **0 vulnerabilities** | Passed in GitHub Actions run 44576428089 |
| Firebase Functions | `npm audit --audit-level=high` | **8 moderate vulnerabilities; no high or critical findings** | Command passed; follow-up required |

### Functions dependency findings

The report traces the moderate advisory GHSA-w5hq-g745-h8pq to `uuid < 11.1.1`, pulled transitively through `gaxios`, `google-gax`, `retry-request`, `teeny-request`, and Google Cloud Firestore/Storage dependencies used by `firebase-admin`.

The automated suggested `npm audit fix --force` proposed a breaking downgrade of `firebase-admin` to 12.1.0. That downgrade was **not** applied because it could break Admin SDK APIs and Cloud Functions compatibility. No high/critical findings were reported by this run. Re-evaluate after upgrading the Firebase Admin dependency chain with Functions unit tests and Emulator tests.

### Android HTTP client

The Android dependency graph previously selected OkHttp 3.12.13 transitively through Firebase Functions. That line is old and has known hostname-verification vulnerabilities. The Android app now declares OkHttp 4.12.0 explicitly so Gradle conflict resolution selects the maintained 4.x line. Android CI must complete successfully on the latest head before this remediation is treated as verified.

## Security controls verified in CI

- Firestore and Storage rules are exercised against disposable Firebase Emulators.
- Public Academy reads are constrained to published documents; draft access is restricted.
- Curriculum node write access is admin-claim-only; client self-promotion is denied.
- Functions build and unit tests pass in CI.
- Web TypeScript check, production build, and health smoke tests pass.
- Coturn Compose syntax is validated without starting a server or opening network ports.

## Outstanding security work

- Complete App Check configuration and enforcement only after app registration and test plan.
- Apply global and per-action rate limits to messaging, comments, reports, teacher applications, and live-room creation.
- Finish report handling, account suspension, moderation audit log, block/mute behavior, and data-deletion workflow.
- Complete teacher identity-document Storage rules and verify private access with emulator attack tests.
- Add file content-type/size validation and malware scanning policy before accepting teacher uploads.
- Finish child-safety controls before any teacher-to-learner live chat or broadcast is enabled.
- Run a dedicated Android dependency scan (Gradle dependency verification/SCA) and independent penetration test before public launch.
- Resolve the eight moderate Functions dependency findings in a separately tested dependency-upgrade change.

## Limitations

CI success only proves the checks that ran against the commit. It does not prove production Firebase configuration, App Check enforcement, live TURN connectivity, real device behavior, or legal compliance.
