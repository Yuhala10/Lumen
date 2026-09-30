import { body, handle } from "@/server/http";
import { createTrader, listSummaries } from "@/server/services";

export async function GET() {
  return handle(listSummaries);
}

export async function POST(req: Request) {
  return handle(async () => createTrader((await body(req)) as never), 201);
}
