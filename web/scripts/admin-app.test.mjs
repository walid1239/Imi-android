import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync, statSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ExternalAccountClient } from "google-auth-library";

const source = readFileSync(resolve("src/lib/server/imi-api.ts"), "utf8");
const start = source.indexOf("export function adminApp(");
const end = source.indexOf("\n}\n\nfunction assertOrigin", start);
assert.ok(start >= 0 && end > start, "adminApp function must be present in imi-api.ts");
const functionSource = source.slice(start, end + 2).replace(/^export\s+/, "");
const transpiled = ts.transpileModule(functionSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const buildAdminApp = new Function(
  "applicationDefault", "getApps", "initializeApp", "existsSync", "renameSync",
  "writeFileSync", "process", "ExternalAccountClient",
  "let currentVercelOidcToken = null;\n" + transpiled + "\nreturn adminApp;",
);
const adminApp = buildAdminApp(
  applicationDefault, getApps, initializeApp, existsSync, renameSync,
  writeFileSync, process, ExternalAccountClient,
);

const names = [
  "FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "IMI_USE_FIREBASE_EMULATORS",
  "FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "GCP_PROJECT_NUMBER",
  "GCP_WORKLOAD_IDENTITY_POOL_ID", "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID",
  "FIREBASE_SERVICE_ACCOUNT_EMAIL", "VERCEL_OIDC_TOKEN", "GOOGLE_APPLICATION_CREDENTIALS",
];
const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
const tokenFile = "/tmp/imi-vercel-oidc-token";
const configFile = "/tmp/imi-wif-config.json";
const temporaryFiles = [
  tokenFile, configFile,
  tokenFile + "." + process.pid + ".tmp",
  configFile + "." + process.pid + ".tmp",
];
let app;

try {
  for (const file of temporaryFiles) {
    try { unlinkSync(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  process.env.FIREBASE_PROJECT_ID = "imi-indroid";
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  delete process.env.IMI_USE_FIREBASE_EMULATORS;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  process.env.GCP_PROJECT_NUMBER = "123456789012";
  process.env.GCP_WORKLOAD_IDENTITY_POOL_ID = "ci-pool";
  process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID = "ci-provider";
  process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL = "imi-ci@imi-indroid.iam.gserviceaccount.com";
  delete process.env.VERCEL_OIDC_TOKEN;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const request = token => new Request("https://imi-api-preview.vercel.app/api/v1/health", {
    headers: { "x-vercel-oidc-token": token },
  });
  app = adminApp(request("ci-dummy-oidc-token-first"));
  assert.ok(app, "adminApp must initialize a Firebase Admin app");
  const db = getFirestore(app);
  assert.ok(db, "getFirestore(app) must initialize without invalid-credential");
  assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, configFile);

  const config = JSON.parse(readFileSync(configFile, "utf8"));
  assert.equal(config.type, "external_account");
  assert.equal(config.credential_source.file.path, tokenFile);
  assert.equal(config.token_url, "https://sts.googleapis.com/v1/token");
  assert.equal(
    readFileSync(tokenFile, "utf8"),
    "ci-dummy-oidc-token-first",
    "OIDC token must be written to the external-account subject-token file",
  );
  assert.equal(statSync(tokenFile).mode & 0o777, 0o600, "subject-token file must be owner-only");

  const sameApp = adminApp(request("ci-dummy-oidc-token-second"));
  assert.equal(sameApp, app, "subsequent requests must reuse the named Admin app");
  assert.equal(
    readFileSync(tokenFile, "utf8"),
    "ci-dummy-oidc-token-second",
    "the subject-token file must be refreshed on every request",
  );

  process.stdout.write("PASS adminApp: applicationDefault external_account credentials initialize getFirestore without network access; per-request token file refresh and file permissions verified.\n");
} finally {
  if (app) await deleteApp(app);
  for (const file of temporaryFiles) {
    try { unlinkSync(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  for (const name of names) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
}
