import "server-only";
import { createClient } from "@supabase/supabase-js";
import { AccountingError, type AccountingRepository, type StoredBook } from "../accounting/service";

export async function authorizedRepository(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new AccountingError("Inicia sesión para continuar.", 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AccountingError("Falta configurar Supabase en el servidor (.env.local).", 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new AccountingError("La sesión expiró. Vuelve a iniciar sesión.", 401);
  const userId = data.user.id;
  async function rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await admin.rpc(name, { ...args, p_user_id: userId });
    if (error) {
      if (error.code === "40001") throw new AccountingError("El ejercicio cambió en otra sesión. Actualiza los datos antes de continuar.", 409);
      if (error.code === "42501") throw new AccountingError("No tienes acceso a este ejercicio.", 403);
      if (["PGRST202", "42P01", "42883"].includes(error.code))
        throw new AccountingError("Ejecuta supabase/script.sql y supabase/data.sql en el proyecto configurado.", 503);
      if (error.code === "P0001") throw new AccountingError(error.message);
      console.error("Supabase accounting:", error.code, error.message);
      throw new AccountingError("No se guardó el cambio. Comprueba el esquema de Supabase y los datos enviados.", 500);
    }
    return data;
  }
  const repo: AccountingRepository = {
    load: () => rpc("accounting_load", {}) as Promise<StoredBook | null>,
    catalog: async () => {
      const { data, error } = await admin.from("catalogo_base").select("codigo,nombre,padre_codigo").order("codigo");
      if (error) throw new AccountingError("No se pudo leer el catálogo inicial. Ejecuta script.sql y data.sql.", 503);
      return data;
    },
    commit: (version, state, action, target) => rpc("accounting_commit", {
      p_book_id: version.bookId, p_revision: version.revision, p_estado: state,
      p_action: action, p_target_id: target ?? null,
    }) as Promise<StoredBook>,
  };
  return { repo, archives: () => rpc("accounting_archives", {}) };
}
