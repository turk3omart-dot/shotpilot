import { getProjectOverview } from "@shotpilot/api";
import { apiRoute } from "@/lib/api-route";

/** Overview filtered by the caller's section access (no budget fields for crew, etc.). */
export const GET = apiRoute<{ id: string }>(async (ctx, _req, { id }) => {
  const o = await getProjectOverview(ctx, id);
  const { access, ...rest } = o;
  return { project: access.project, access: access.access, projectRole: access.projectRole, ...rest };
});
