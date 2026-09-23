import { handleRegistryRequest } from "@promptmarket/registry";
import { catalogRegistry } from "../../../../../lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return handleRegistryRequest(catalogRegistry(), request);
}
