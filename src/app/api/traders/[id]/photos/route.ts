import { TrustError } from "@/core/errors";
import { handle } from "@/server/http";
import { addPhoto } from "@/server/services";

export async function POST(req: Request, ctx: RouteContext<"/api/traders/[id]/photos">) {
  const { id } = await ctx.params;
  return handle(async () => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new TrustError("invalid_input", "Expected a photo upload.", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new TrustError("invalid_input", "No photo in the upload.", 400);
    return addPhoto(id, {
      bytes: new Uint8Array(await file.arrayBuffer()),
      kind: String(form.get("kind") ?? "notebook"),
      dhash: String(form.get("dhash") ?? ""),
      width: Number(form.get("width") ?? 0),
      height: Number(form.get("height") ?? 0),
      name: file.name,
    });
  }, 201);
}
