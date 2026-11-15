import { AppError, createPdfUpload } from "@repo/backend";
import { withRoute } from "@/lib/http";
import { getOwnerId } from "@/lib/owner";

export const runtime = "nodejs";

/**
 * Creates a pending PDF source and returns a signed upload token (NB-008 R8): 200 { sourceId, path, token }
 * or the error shape. The browser uploads the file straight to Storage with the token.
 */
export const POST = withRoute("createPdfUpload", async (request) => {
  const ownerId = await getOwnerId();
  const body: unknown = await request.json().catch(() => {
    throw new AppError("VALIDATION", "Choose a PDF file.");
  });
  return Response.json(await createPdfUpload(ownerId, body));
});
