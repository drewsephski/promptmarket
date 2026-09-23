import { previewAuthoringDraft } from "../../../../lib/authoring-api";

function invalidJson(): Response {
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

export async function POST(request: Request): Promise<Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return invalidJson();
  }
  return Response.json(previewAuthoringDraft(input));
}
