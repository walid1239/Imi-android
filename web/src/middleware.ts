import { NextRequest, NextResponse } from 'next/server';

function buildContentSecurityPolicy(nonce: string): string {
  const emulatorSources = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === 'true'
    ? ' http://127.0.0.1:9099 http://127.0.0.1:8080 http://127.0.0.1:5001 http://127.0.0.1:9199 ws://127.0.0.1:9099 ws://127.0.0.1:8080 ws://127.0.0.1:5001 ws://127.0.0.1:9199'
    : '';

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://accounts.google.com",
    `script-src 'self' 'nonce-${nonce}' https://www.gstatic.com https://apis.google.com https://accounts.google.com`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    `frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.google.com${emulatorSources}`,
    `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://www.googleapis.com https://*.firebaseapp.com https://accounts.google.com${emulatorSources}`,
  ].join('; ');
}

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
