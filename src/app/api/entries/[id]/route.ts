import { body, handle } from "@/server/http";
import { updateEntry } from "@/server/services";

export async function PATCH(req: Request, ctx: RouteContext<"/api/entries/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => updateEntry(id, await body(req)));
}
