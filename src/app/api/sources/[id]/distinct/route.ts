import { DistinctInputSchema } from "@/core/validation";
import { body, handle } from "@/server/http";
import { markDistinct } from "@/server/services";

export async function POST(req: Request, ctx: RouteContext<"/api/sources/[id]/distinct">) {
  const { id } = await ctx.params;
  return handle(async () => markDistinct(id, DistinctInputSchema.parse(await body(req)).otherId));
}
