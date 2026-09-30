import { ConsentInputSchema } from "@/core/validation";
import { body, handle } from "@/server/http";
import { setConsent } from "@/server/services";

export async function POST(req: Request, ctx: RouteContext<"/api/traders/[id]/consent">) {
  const { id } = await ctx.params;
  return handle(async () => setConsent(id, ConsentInputSchema.parse(await body(req)).granted));
}
