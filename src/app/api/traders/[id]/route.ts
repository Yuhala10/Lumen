import { handle } from "@/server/http";
import { deleteTrader, getTraderView } from "@/server/services";

export async function GET(_req: Request, ctx: RouteContext<"/api/traders/[id]">) {
  const { id } = await ctx.params;
  return handle(() => getTraderView(id));
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/traders/[id]">) {
  const { id } = await ctx.params;
  return handle(() => deleteTrader(id));
}
