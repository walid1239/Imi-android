const GOOGLE_SECURE_TOKEN_JWKS =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeJsonSegment(segment) {
  const bytes = decodeBase64Url(segment);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function invalidToken() {
  // Keep errors generic: callers must not log token material or provider responses.
  return new Error("INVALID_FIREBASE_ID_TOKEN");
}

/**
 * Verify a Firebase Authentication ID token in a Web-Crypto runtime.
 *
 * This deliberately verifies the signed token only. It does not check token
 * revocation or user-disabled state; use a trusted Admin SDK environment for
 * sensitive operations that require those checks.
 */
export async function verifyFirebaseIdToken(
  token,
  {
    projectId,
    fetcher = fetch,
    cryptoProvider = globalThis.crypto,
    nowSeconds = Math.floor(Date.now() / 1000),
  },
) {
  if (
    typeof token !== "string" ||
    token.length < 20 ||
    token.length > 8192 ||
    typeof projectId !== "string" ||
    !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) ||
    !cryptoProvider?.subtle ||
    typeof fetcher !== "function"
  ) {
    throw invalidToken();
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) throw invalidToken();

  let header;
  let claims;
  let signature;
  try {
    header = decodeJsonSegment(parts[0]);
    claims = decodeJsonSegment(parts[1]);
    signature = decodeBase64Url(parts[2]);
  } catch {
    throw invalidToken();
  }

  if (
    header?.alg !== "RS256" ||
    typeof header.kid !== "string" ||
    !header.kid ||
    claims?.aud !== projectId ||
    claims?.iss !== `https://securetoken.google.com/${projectId}` ||
    typeof claims.sub !== "string" ||
    claims.sub.length < 1 ||
    claims.sub.length > 128 ||
    typeof claims.exp !== "number" ||
    typeof claims.iat !== "number" ||
    typeof claims.auth_time !== "number" ||
    !Number.isFinite(claims.exp) ||
    !Number.isFinite(claims.iat) ||
    !Number.isFinite(claims.auth_time) ||
    claims.exp <= nowSeconds ||
    claims.iat > nowSeconds + 60 ||
    claims.auth_time > nowSeconds + 60 ||
    claims.exp <= claims.iat
  ) {
    throw invalidToken();
  }

  let response;
  try {
    response = await fetcher(GOOGLE_SECURE_TOKEN_JWKS, {
      headers: { accept: "application/json" },
    });
  } catch {
    throw invalidToken();
  }
  if (!response?.ok) throw invalidToken();

  let keySet;
  try {
    keySet = await response.json();
  } catch {
    throw invalidToken();
  }
  const jwk = Array.isArray(keySet?.keys)
    ? keySet.keys.find((key) => key?.kid === header.kid && key?.kty === "RSA")
    : undefined;
  if (!jwk) throw invalidToken();

  try {
    const publicKey = await cryptoProvider.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await cryptoProvider.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signature,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) throw invalidToken();
  } catch {
    throw invalidToken();
  }

  return { uid: claims.sub };
}
