import { CoreError } from "./serverCore";

export interface IdTokenVerifier {
  verifyIdToken(token: string): Promise<{ uid: string }>;
}

export async function authenticateBearer(
  authorization: string | null,
  verifier: IdTokenVerifier,
): Promise<string> {
  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new CoreError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  }
  const token = authorization.slice(7).trim();
  if (!token || token.length > 8192 || /\s/.test(token)) {
    throw new CoreError("unauthenticated", "بيانات المصادقة غير صالحة.");
  }
  try {
    const decoded = await verifier.verifyIdToken(token);
    if (!decoded.uid || typeof decoded.uid !== "string") {
      throw new Error("Invalid subject");
    }
    return decoded.uid;
  } catch {
    // Never forward verifier errors, token fragments, credentials, or project details.
    throw new CoreError("unauthenticated", "جلسة الدخول غير صالحة أو منتهية.");
  }
}

export function publicErrorMessage(error: unknown): { status: number; message: string } {
  if (error instanceof CoreError) {
    const status: Record<string, number> = {
      unauthenticated: 401, "invalid-argument": 400, "resource-exhausted": 429,
      "permission-denied": 403, "not-found": 404, "already-exists": 409,
      "failed-precondition": 409,
    };
    return { status: status[error.code] ?? 400, message: error.message };
  }
  return { status: 500, message: "حدث خطأ داخلي. حاول لاحقاً." };
}
