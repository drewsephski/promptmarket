import { createMcpHandler } from "@modelcontextprotocol/server";
import { createPromptMarketServer } from "@promptmarket/mcp";
import { catalogRegistry } from "../../lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createMcpHandler(function createServer() {
  return createPromptMarketServer(catalogRegistry());
});

export function GET(request: Request): Promise<Response> {
  return handler.fetch(request);
}

export function POST(request: Request): Promise<Response> {
  return handler.fetch(request);
}

export function DELETE(request: Request): Promise<Response> {
  return handler.fetch(request);
}
