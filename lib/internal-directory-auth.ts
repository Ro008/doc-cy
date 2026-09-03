import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  INTERNAL_DIRECTORY_COOKIE,
  readInternalDirectorySecrets,
  roleFromCookieValue,
  type InternalDirectoryRole,
} from "@/lib/internal-directory-auth-core";

export {
  INTERNAL_DIRECTORY_COOKIE,
  isInternalDirectoryCookieAuthorized,
  readInternalDirectorySecrets,
  roleFromCookieValue,
  type InternalDirectoryRole,
  type InternalDirectorySecrets,
} from "@/lib/internal-directory-auth-core";

/** True when the request carries a valid founder or partner gate cookie. */
export function isInternalDirectoryAuthenticated(): boolean {
  return getInternalDirectoryRole() !== null;
}

export function getInternalDirectoryRole(): InternalDirectoryRole | null {
  const secrets = readInternalDirectorySecrets();
  if (!secrets.founder) return null;
  const cookie = cookies().get(INTERNAL_DIRECTORY_COOKIE)?.value;
  return roleFromCookieValue(cookie, secrets);
}

export function canMutateInternalDirectory(): boolean {
  return getInternalDirectoryRole() === "founder";
}

export function unauthorizedInternalDirectoryResponse(): NextResponse {
  return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
}

export function forbiddenInternalDirectoryWriteResponse(): NextResponse {
  return NextResponse.json(
    { message: "Read-only access. Ask a founder to approve or reject." },
    { status: 403 },
  );
}

/** 401 if logged out, 403 if partner (read-only). */
export function denyUnlessInternalFounder(): NextResponse | null {
  const role = getInternalDirectoryRole();
  if (!role) return unauthorizedInternalDirectoryResponse();
  if (role !== "founder") return forbiddenInternalDirectoryWriteResponse();
  return null;
}

/** 401 unless founder or partner. */
export function denyUnlessInternalAuthenticated(): NextResponse | null {
  if (!isInternalDirectoryAuthenticated()) return unauthorizedInternalDirectoryResponse();
  return null;
}
