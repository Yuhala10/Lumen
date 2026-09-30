import { handle } from "@/server/http";
import { confirmPage } from "@/server/services";

export async function POST(_req: Request, ctx: RouteContext<"/api/sources/[id]/confirm">) {
  const { id } = await ctx.params;
  return handle(() => confirmPage(id));
}
