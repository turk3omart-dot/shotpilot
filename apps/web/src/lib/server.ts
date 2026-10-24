import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@shotpilot/database";
import { getSessionUser, type ServiceContext } from "@shotpilot/api";
import type { Locale } from "@shotpilot/shared";

export const SESSION_COOKIE = "sp_session";

export const currentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getSessionUser({ db: getDb(), userId: null }, token);
});

/** Service context for the signed-in user; redirects to /login otherwise. */
export async function requireCtx(): Promise<ServiceContext & { user: NonNullable<Awaited<ReturnType<typeof currentUser>>> }> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return { db: getDb(), userId: user.id, user };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function requestMeta() {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local", userAgent: h.get("user-agent") ?? undefined };
}

export async function currentLocale(): Promise<Locale> {
  const v = (await cookies()).get("sp_locale")?.value;
  return v === "ar" ? "ar" : "en";
}
