"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getDb } from "@shotpilot/database";
import { listMyWorkspaces, signIn, signOut, signUp } from "@shotpilot/api";
import { SESSION_COOKIE, clearSessionCookie, requestMeta, setSessionCookie } from "@/lib/server";
import { toActionError, type ActionState } from "@/lib/action-result";

async function landingFor(userId: string) {
  const ws = await listMyWorkspaces({ db: getDb(), userId });
  return ws[0] ? `/w/${ws[0].slug}` : "/onboarding";
}

export async function signUpAction(_: ActionState, form: FormData): Promise<ActionState> {
  let dest: string;
  try {
    const { user, token, expiresAt } = await signUp({ db: getDb(), userId: null }, Object.fromEntries(form), await requestMeta());
    await setSessionCookie(token, expiresAt);
    dest = await landingFor(user.id);
  } catch (e) {
    return toActionError(e);
  }
  redirect(dest);
}

export async function signInAction(_: ActionState, form: FormData): Promise<ActionState> {
  let dest: string;
  try {
    const { user, token, expiresAt } = await signIn({ db: getDb(), userId: null }, Object.fromEntries(form), await requestMeta());
    await setSessionCookie(token, expiresAt);
    const next = String(form.get("next") ?? "");
    dest = next.startsWith("/") && !next.startsWith("//") ? next : await landingFor(user.id);
  } catch (e) {
    return toActionError(e);
  }
  redirect(dest);
}

export async function signOutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await signOut({ db: getDb(), userId: null }, token);
  await clearSessionCookie();
  redirect("/login");
}

export async function setLocaleAction(form: FormData) {
  const locale = form.get("locale") === "ar" ? "ar" : "en";
  (await cookies()).set("sp_locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(String(form.get("back") ?? "/"));
}
