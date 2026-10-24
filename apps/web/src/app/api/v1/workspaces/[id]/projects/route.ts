import { listProjects } from "@shotpilot/api";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute<{ id: string }>(async (ctx, _req, { id }) => listProjects(ctx, id));
