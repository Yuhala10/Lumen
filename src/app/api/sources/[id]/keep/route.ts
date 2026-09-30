import { handle } from "@/server/http";
import { keepDuplicate } from "@/server/services";

export async function POST(_req: Request, ctx: RouteContext<"/api/sources/[id]/keep">) {
  const { id } = await ctx.params;
  return handle(() => keepDuplicate(id));
}
