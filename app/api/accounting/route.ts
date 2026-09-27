import { authorizedRepository } from "@/lib/supabase/server";
import { accountingCommand, AccountingError } from "@/lib/accounting/service";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private" };
function failure(error: unknown) {
  const status = error instanceof AccountingError ? error.status : 400;
  return Response.json({ error: error instanceof Error ? error.message : "No se pudo completar la operación." }, { status, headers });
}

export async function GET(request: Request) {
  try {
    const { repo, archives } = await authorizedRepository(request);
    return Response.json(new URL(request.url).searchParams.get("archives") === "1"
      ? await archives() : await accountingCommand(repo, "init", {}), { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const { repo } = await authorizedRepository(request);
    const limit = 10 * 1024 * 1024;
    if (Number(request.headers.get("content-length")) > limit) throw new AccountingError("El archivo supera 10 MB.", 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > limit) throw new AccountingError("El archivo supera 10 MB.", 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || typeof body.action !== "string" ||
      typeof body.bookId !== "string" || !Number.isSafeInteger(body.revision))
      throw new AccountingError("Solicitud inválida. Actualiza el ejercicio.");
    const result = await accountingCommand(repo, body.action, body.data, { bookId: body.bookId, revision: body.revision });
    return Response.json(result, { headers });
  } catch (error) { return failure(error); }
}
