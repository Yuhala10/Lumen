import { MessagesInputSchema } from "@/core/validation";
import { body, handle } from "@/server/http";
import { addMessages } from "@/server/services";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/traders/[id]/messages">) {
  const { id } = await ctx.params;
  return handle(async () => addMessages(id, MessagesInputSchema.parse(await body(req)).text));
}
