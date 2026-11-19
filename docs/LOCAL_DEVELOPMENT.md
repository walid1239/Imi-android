# IMI local development

## Web environment

Copy `web/.env.example` to `web/.env.local` and fill the Firebase **web app's public configuration** from Firebase Console > Project settings > Your apps. These `NEXT_PUBLIC_*` values are public client configuration, not service-account credentials. Never put Admin SDK private keys or service-account JSON in this file or the repository.

Required values:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

The checked-in example defaults the project ID, bucket, and sender ID to the documented `imi-indroid` project; verify them against the intended Firebase web app before use.

## Start local emulators

From the repository root:

```sh
npm install
npx firebase-tools emulators:start --only auth,functions,firestore,storage --project demo-imi-local
```

The configured local ports are Auth `9099`, Functions `5001`, Firestore `8080`, and Storage `9199`. The Emulator UI is disabled by default. Use a `demo-*` project ID for local tests; do not point local experiments at the production project.

In a separate terminal, start the web app:

```sh
cd web
npm install
npm run dev
```

The web client must be explicitly configured to use emulator endpoints in development before expecting browser operations to reach them. Do not infer emulator connectivity merely because the emulator processes start.

## Security tests

From the repository root:

```sh
npm run test:rules
```

CI runs the Firestore and Storage rules tests against the emulators. No command in this guide deploys rules, Functions, or Hosting.

## Health endpoint

`GET /api/v1/health` reports that the Next.js process is responding and whether required Firebase web configuration variables are present. It is a configuration/liveness endpoint only; it does not authenticate with Firebase or prove production Firestore, Storage, or Functions connectivity.
