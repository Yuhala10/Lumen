import { body, handle } from "@/server/http";
import { ask } from "@/server/services";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/traders/[id]/ask">) {
  const { id } = await ctx.params;
  return handle(async () => ask(id, await body(req)));
}
