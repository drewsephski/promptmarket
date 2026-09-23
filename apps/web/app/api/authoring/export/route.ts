import { exportAuthoringDraft } from "../../../../lib/authoring-api";

export async function POST(request: Request): Promise<Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        issues: [
          {
            code: "package_structure",
            path: "body",
            message: "Request body must be JSON.",
          },
        ],
      },
      { status: 400 },
    );
  }

  const result = exportAuthoringDraft(input);
  if (!result.ok) {
    return Response.json({ ok: false, issues: result.issues }, { status: 400 });
  }

  return new Response(Buffer.from(result.bytes), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${result.filename}"`,
      "cache-control": "no-store",
    },
  });
}
