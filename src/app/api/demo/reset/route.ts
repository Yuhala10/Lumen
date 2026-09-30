import { handle } from "@/server/http";
import { resetDemo } from "@/server/services";

export async function POST() {
  return handle(resetDemo);
}
