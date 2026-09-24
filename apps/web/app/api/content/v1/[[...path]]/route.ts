import {
  contentMeta,
  handleContentRequest,
  loadContentCatalog,
  resolveContentDir,
} from "@promptmarket/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const catalog = loadContentCatalog();
  return handleContentRequest(
    catalog,
    request,
    contentMeta(catalog, resolveContentDir()),
  );
}
