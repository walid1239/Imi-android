export const TEACHER_CONTENT_RIGHTS_AGREEMENT_VERSION = "content-rights-2026-11-19-v1";
export const TEACHER_CHILD_SAFETY_AGREEMENT_VERSION = "child-safety-2026-11-19-v1";

export type TeacherAgreementAcceptance = {
  version: string;
  acceptedBy: string;
  acceptedAt: unknown;
};

/** Builds auditable acceptance metadata; callers must supply a server timestamp. */
export function createTeacherAgreementAcceptances(
  uid: string,
  serverTimestamp: unknown,
): {
  contentRights: TeacherAgreementAcceptance;
  childSafety: TeacherAgreementAcceptance;
} {
  if (!/^[A-Za-z0-9_-]{2,128}$/.test(uid)) {
    throw new Error("Invalid teacher uid.");
  }
  if (serverTimestamp === null || serverTimestamp === undefined) {
    throw new Error("A server timestamp is required.");
  }
  return {
    contentRights: {
      version: TEACHER_CONTENT_RIGHTS_AGREEMENT_VERSION,
      acceptedBy: uid,
      acceptedAt: serverTimestamp,
    },
    childSafety: {
      version: TEACHER_CHILD_SAFETY_AGREEMENT_VERSION,
      acceptedBy: uid,
      acceptedAt: serverTimestamp,
    },
  };
}
