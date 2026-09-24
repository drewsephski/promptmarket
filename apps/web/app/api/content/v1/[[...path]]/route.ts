import {
  handleContentRequest,
  loadContentCatalog,
} from "@promptmarket/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  return handleContentRequest(loadContentCatalog(), request);
}
