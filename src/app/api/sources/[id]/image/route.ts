import { getSourceImage } from "@/server/services";

export async function GET(_req: Request, ctx: RouteContext<"/api/sources/[id]/image">) {
  const { id } = await ctx.params;
  const image = await getSourceImage(id);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "content-type": image.mime,
      // Photos never change once stored: their id is their identity.
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
