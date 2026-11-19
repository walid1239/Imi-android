# IMI dependency security audit

Audit gate added to `.github/workflows/web-ci.yml` on 2026-11-19. The gate runs `npm audit --audit-level=high` independently in `web/` and `functions/`; high and critical findings fail CI. The workflow installs dependencies first because this repository currently does not track package lockfiles for these workspaces.

## Initial observed result

Run: https://github.com/walid1239/Imi-android/actions/runs/44571317873

- `functions`: completed successfully, including `npm audit --audit-level=high` and the Functions test script. This establishes no high/critical advisory was reported by that command at that run.
- `web`: failed the audit gate. npm reported 6 findings (1 moderate, 5 high). The high findings included:
  - `@grpc/grpc-js` affected versions before 1.13.6 and 1.14.0–1.14.4; patched releases include 1.13.6 and 1.14.5. The observed dependency tree included the vulnerable gRPC package through Firebase Firestore packages.
  - `postcss` versions through 8.5.22; patched version 8.5.23 or later.
- The audit output recommended `npm audit fix --force`, which would have changed Firebase and Next.js across major versions. That command was deliberately **not** used.

## Remediation attempted

The web workspace now declares npm overrides:
- `@grpc/grpc-js: ^1.14.5`
- `postcss: ^8.5.23`

These select patched compatible transitive releases without forcing a major Next.js or Firebase downgrade. This is a remediation attempt, not yet a verified clean audit. The next Web CI run must confirm the result.

## Remaining verification

- Re-run the web audit and inspect the full JSON report for any remaining moderate/low advisories.
- Review the Functions audit again after the final dependency graph changes.
- Add and retain lockfiles with reviewed, reproducible dependency resolution before production release.
- Do not use `npm audit fix --force` as an automatic remedy.
- A clean npm audit does not replace code review, Firebase Rules testing, secret scanning, or penetration testing.
