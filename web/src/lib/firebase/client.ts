import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

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
  authDomain: 'localhost',
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
export const functions = getFunctions(app);
