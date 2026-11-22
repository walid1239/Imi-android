export type TeacherClaims = Record<string, unknown>;

export type TeacherClaimsOperation = {
  targetUid: string;
  desiredTeacher: boolean;
};

export type TeacherClaimsOutboxDependencies = {
  getUser(uid: string): Promise<{ customClaims?: TeacherClaims }>;
  setCustomClaims(uid: string, claims: TeacherClaims): Promise<void>;
  markApplied(): Promise<void>;
  markPending(error: unknown): Promise<void>;
};

export function mergeTeacherClaims(existing: TeacherClaims | undefined, desiredTeacher: boolean): TeacherClaims {
  const claims: TeacherClaims = { ...(existing ?? {}) };
  if (desiredTeacher) {
    claims.teacher = true;
    claims.teacherVerified = true;
  } else {
    delete claims.teacher;
    delete claims.teacherVerified;
  }
  return claims;
}

export function teacherClaimsMatch(existing: TeacherClaims | undefined, desiredTeacher: boolean): boolean {
  return desiredTeacher
    ? existing?.teacher === true && existing?.teacherVerified === true
    : existing?.teacher !== true && existing?.teacherVerified !== true;
}

/** Idempotent worker: Auth writes and Firestore acknowledgement may fail independently. */
export async function applyTeacherClaimsOutboxOperation(
  operation: TeacherClaimsOperation,
  dependencies: TeacherClaimsOutboxDependencies,
): Promise<void> {
  try {
    const user = await dependencies.getUser(operation.targetUid);
    if (!teacherClaimsMatch(user.customClaims, operation.desiredTeacher)) {
      await dependencies.setCustomClaims(
        operation.targetUid,
        mergeTeacherClaims(user.customClaims, operation.desiredTeacher),
      );
    }
    await dependencies.markApplied();
  } catch (error) {
    await dependencies.markPending(error);
    throw error;
  }
}
