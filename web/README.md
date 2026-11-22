# IMI Web

Arabic RTL Next.js application for the IMI platform.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Fill in the Firebase web-app configuration for the existing `imi-indroid` project.
3. Run `npm install`.
4. Run `npm run dev`.

## Verification

- `npm run typecheck`
- `npm run build`

The current web foundation includes the landing page, Firebase email/password and Google authentication UI, password reset, authenticated shell, PWA shell, and application configuration health endpoint. Social features are added incrementally; do not treat placeholder sections as completed integrations.

Firebase production rules and Cloud Functions are not deployed by this web app setup.
