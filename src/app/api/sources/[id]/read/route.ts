import { handle } from "@/server/http";
import { readSource } from "@/server/services";

export const maxDuration = 60;

export async function POST(_req: Request, ctx: RouteContext<"/api/sources/[id]/read">) {
  const { id } = await ctx.params;
  return handle(() => readSource(id));
}
