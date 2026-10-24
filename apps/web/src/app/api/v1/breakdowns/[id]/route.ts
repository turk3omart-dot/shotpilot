import { getBreakdown } from "@shotpilot/api";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute<{ id: string }>(async (ctx, _req, { id }) => getBreakdown(ctx, id));
