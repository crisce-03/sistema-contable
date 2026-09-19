export async function request(path: string, method = "GET", body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const result = await r.json();
  if (!r.ok)
    throw new Error(result.error ?? "No se pudo completar la operación.");
  return result;
}
