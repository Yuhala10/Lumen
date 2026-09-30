import { handle } from "@/server/http";
import { deleteSource } from "@/server/services";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/sources/[id]">) {
  const { id } = await ctx.params;
  return handle(() => deleteSource(id));
}
