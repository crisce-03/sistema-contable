"use client";
import { getSupabaseBrowser } from "../supabase/browser";
import type { LibroLocal } from "../types";
import type { BookVersion, StoredBook } from "./service";

async function cloudRequest(method: string, body?: unknown, query = "") {
  const { data, error } = await getSupabaseBrowser().auth.getSession();
  if (error || !data.session) throw new Error("Inicia sesión para abrir el ejercicio.");
  const response = await fetch(`/api/accounting${query}`, {
    method, cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
  if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar el cambio en Supabase.");
  return payload;
}

export function cloudCommand(action: string, data: unknown, version?: BookVersion): Promise<StoredBook & { insertados: number; omitidos: number }> {
  return action === "init" ? cloudRequest("GET") : cloudRequest("POST", { action, data, ...version });
}

export function archives(): Promise<{ key: string; book: LibroLocal }[]> {
  return cloudRequest("GET", undefined, "?archives=1");
}
