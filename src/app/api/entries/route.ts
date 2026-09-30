import { body, handle } from "@/server/http";
import { addEntry } from "@/server/services";

export async function POST(req: Request) {
  return handle(async () => addEntry(await body(req)), 201);
}
