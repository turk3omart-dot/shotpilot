import { signIn } from "@shotpilot/api";
import { apiRoute } from "@/lib/api-route";

export const POST = apiRoute(async (ctx, req) => {
  const { user, token, expiresAt } = await signIn(ctx, await req.json(), { ip: req.headers.get("x-forwarded-for") ?? "api", userAgent: req.headers.get("user-agent") ?? undefined });
  return { token, expiresAt, user: { id: user.id, name: user.name, email: user.email, locale: user.locale } };
}, { public: true });
