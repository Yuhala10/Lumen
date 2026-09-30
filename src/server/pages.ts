import { notFound } from "next/navigation";
import { TrustError } from "@/core/errors";
import { getTraderView } from "./services";

/** Loads a trader for a page, turning "not found" into the 404 page. */
export async function loadTrader(id: string) {
  try {
    return await getTraderView(id);
  } catch (err) {
    if (err instanceof TrustError && err.code === "not_found") notFound();
    throw err;
  }
}
