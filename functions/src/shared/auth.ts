import {HttpsError} from "firebase-functions/https";
import {ID_PATTERN} from "./paths";

export type Role = "admin" | "member";

export interface Member {
  uid: string;
  orgId: string;
  role: Role;
}

// Accepts both CallableRequest.auth and the Genkit context.auth that
// onCallGenkit builds from it.
interface AuthLike {
  uid?: string;
  token?: Record<string, unknown>;
}

/**
 * Returns the caller's org membership from their custom claims, or throws.
 * @param {AuthLike|null|undefined} auth The verified auth data.
 * @return {Member} The caller's uid, orgId and role.
 */
export const requireMember = (auth?: AuthLike | null): Member => {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in first.");
  }
  const orgId = auth.token?.orgId;
  if (typeof orgId !== "string" || !ID_PATTERN.test(orgId)) {
    throw new HttpsError(
      "permission-denied",
      "Your account isn't linked to an organization."
    );
  }
  const role: Role = auth.token?.role === "admin" ? "admin" : "member";
  return {uid: auth.uid, orgId, role};
};

/**
 * Like requireMember, but the caller must be an org admin.
 * @param {AuthLike|null|undefined} auth The verified auth data.
 * @return {Member} The caller's uid, orgId and role.
 */
export const requireAdmin = (auth?: AuthLike | null): Member => {
  const member = requireMember(auth);
  if (member.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only organization admins can do this."
    );
  }
  return member;
};
