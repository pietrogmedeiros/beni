import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { db } from "@/lib/db";

const COOKIE_NAME = "beni_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET não configurado");
  return new TextEncoder().encode(value);
}

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function readToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return readToken(store.get(COOKIE_NAME)?.value);
}

/** Usuário atual + workspace padrão. Lança se não autenticado. */
export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: {
      memberships: {
        include: { workspace: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
});

export const currentWorkspace = cache(async () => {
  const user = await requireUser();
  const membership = user.memberships[0];
  if (!membership) throw new Error("NO_WORKSPACE");
  return membership.workspace;
});

export { COOKIE_NAME };
