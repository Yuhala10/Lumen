import { z } from "zod";
import { TrustError } from "@/core/errors";
import { body, handle } from "@/server/http";
import { findSharedByCode } from "@/server/services";

const Input = z.object({ code: z.string().trim().min(4).max(40) });

export async function POST(req: Request) {
  return handle(async () => {
    const trader = await findSharedByCode(Input.parse(await body(req)).code);
    if (!trader) throw new TrustError("not_shared", "No shared profile matches this code.", 404);
    return { id: trader.id };
  });
}
