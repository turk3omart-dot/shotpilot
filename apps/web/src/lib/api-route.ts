import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getDb } from "@shotpilot/database";
import { getSessionUser, type ServiceContext } from "@shotpilot/api";
import { DomainError, unauthenticated } from "@shotpilot/shared";
import { SESSION_COOKIE } from "./server";

const STATUS: Record<DomainError["code"], number> = {
  UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, INVALID: 422, AI_DISABLED: 409, RATE_LIMITED: 429,
};

/** JSON API for native clients. Accepts `Authorization: Bearer <session token>` or the web session cookie. */
export function apiRoute<P>(handler: (ctx: ServiceContext, req: NextRequest, params: P) => Promise<unknown>, opts: { public?: boolean } = {}) {
  return async (req: NextRequest, { params }: { params: Promise<P> }) => {
    try {
      const db = getDb();
      const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
      const user = await getSessionUser({ db, userId: null }, bearer ?? req.cookies.get(SESSION_COOKIE)?.value);
      if (!user && !opts.public) throw unauthenticated();
      const data = await handler({ db, userId: user?.id ?? null }, req, await params);
      return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof DomainError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: STATUS[e.code] });
      if (e instanceof ZodError) return NextResponse.json({ error: { code: "INVALID", message: "Invalid input", issues: e.issues } }, { status: 422 });
      console.error(e);
      return NextResponse.json({ error: { code: "INTERNAL", message: "Internal error" } }, { status: 500 });
    }
  };
}
