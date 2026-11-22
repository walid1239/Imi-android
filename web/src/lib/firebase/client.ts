import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';

const requiredEnv = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(requiredEnv).every(Boolean);

// A complete inert configuration allows Next.js to prerender client components in CI
// when deployment secrets are intentionally absent. Auth actions remain disabled until
// real Firebase environment variables are supplied.
const buildFallback = {
  apiKey: 'build-only-not-a-real-firebase-api-key',
  authDomain: 'demo-imi-build.firebaseapp.com',
  projectId: 'demo-imi-build',
  storageBucket: 'demo-imi-build.firebasestorage.app',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000',
};

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfigured ? requiredEnv : buildFallback);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Emulator endpoints are enabled only in explicit local/CI test mode.
// This flag is public by design and must never be enabled in production builds.
if (process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === 'true' && typeof window !== 'undefined') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}
