import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { sessions, users } from "@shotpilot/database";
import { DomainError, invalid, unauthenticated } from "@shotpilot/shared";
import type { ServiceContext } from "./context";
import { rateLimit } from "./rate-limit";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const SignUpInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10, "Use at least 10 characters").max(200),
});
export const SignInInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

async function createSession(ctx: ServiceContext, userId: string, userAgent?: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await ctx.db.insert(sessions).values({ id: hashToken(token), userId, expiresAt, userAgent: userAgent?.slice(0, 300) });
  return { token, expiresAt };
}

export async function signUp(ctx: ServiceContext, raw: unknown, meta: { ip?: string; userAgent?: string } = {}) {
  if (!rateLimit(`signup:${meta.ip ?? "unknown"}`, 10, 60 * 60 * 1000)) {
    throw new DomainError("RATE_LIMITED", "Too many sign-up attempts. Try again later.");
  }
  const input = SignUpInput.parse(raw);
  const existing = await ctx.db.query.users.findFirst({ where: sql`lower(${users.email}) = ${input.email}` });
  if (existing) throw invalid("An account with this email already exists.");
  const [user] = await ctx.db
    .insert(users)
    .values({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password) })
    .returning();
  const session = await createSession(ctx, user!.id, meta.userAgent);
  return { user: user!, ...session };
}

export async function signIn(ctx: ServiceContext, raw: unknown, meta: { ip?: string; userAgent?: string } = {}) {
  const input = SignInInput.parse(raw);
  if (!rateLimit(`signin:${input.email}`, 10, 15 * 60 * 1000) || !rateLimit(`signin-ip:${meta.ip ?? "unknown"}`, 50, 15 * 60 * 1000)) {
    throw new DomainError("RATE_LIMITED", "Too many sign-in attempts. Try again in a few minutes.");
  }
  const user = await ctx.db.query.users.findFirst({ where: sql`lower(${users.email}) = ${input.email}` });
  // Same error for unknown email and wrong password.
  if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
    throw invalid("Incorrect email or password.");
  }
  const session = await createSession(ctx, user.id, meta.userAgent);
  return { user, ...session };
}

export async function getSessionUser(ctx: ServiceContext, token: string | undefined | null) {
  if (!token) return null;
  const row = await ctx.db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row[0]?.user ?? null;
}

export async function signOut(ctx: ServiceContext, token: string | undefined | null) {
  if (!token) return;
  await ctx.db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export function requireUser(ctx: ServiceContext): string {
  if (!ctx.userId) throw unauthenticated();
  return ctx.userId;
}
