import { handle } from "@/server/http";
import { aiStatus } from "@/server/services";

export async function GET() {
  return handle(async () => ({ ai: aiStatus() }));
}
