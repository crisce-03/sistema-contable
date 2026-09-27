import type { LibroLocal, ConfiguracionLibro } from "../types";
import { emptyBook, localCommand } from "./local";
import { restoreBook } from "./restore";
import defaultConfig from "../supabase/default-config.json";

export interface StoredBook { id: string; revision: number; estado: LibroLocal }
export interface BookVersion { bookId: string | null; revision: number | null }
export class AccountingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export interface AccountingRepository {
  load(): Promise<StoredBook | null>;
  catalog(): Promise<{ codigo: string; nombre: string; padre_codigo: string | null }[]>;
  commit(version: BookVersion, state: LibroLocal | null, action: "save" | "new" | "switch", target?: string): Promise<StoredBook>;
}

async function initialBook(repo: AccountingRepository) {
  const catalog = await repo.catalog();
  if (!catalog.length) throw new AccountingError("Ejecuta supabase/data.sql antes de crear el primer ejercicio.", 503);
  const state = localCommand(emptyBook(), "catalog", {
    version: 1,
    cuentas: catalog.filter(c => c.codigo.length >= 4).map(c => ({
      codigo: c.codigo, nombre: c.nombre, padreCodigo: c.padre_codigo, activa: true,
    })),
  }).estado;
  // La plantilla inicial y estas asignaciones pertenecen al mismo catálogo.
  return localCommand(state, "settings", defaultConfig as ConfiguracionLibro).estado;
}

function result(book: StoredBook, insertados = 0, omitidos = 0) {
  return { ...book, estado: localCommand(book.estado, "init", {}).estado, insertados, omitidos };
}

export async function accountingCommand(repo: AccountingRepository, action: string, data: unknown, version?: BookVersion) {
  const current = await repo.load();
  if (action === "init") {
    if (current) return result(current);
    const state = await initialBook(repo);
    try { return result(await repo.commit({ bookId: null, revision: null }, state, "new")); }
    catch (e) {
      // Dos pestañas pueden abrir por primera vez al mismo tiempo.
      if (e instanceof AccountingError && e.status === 409) {
        const created = await repo.load();
        if (created) return result(created);
      }
      throw e;
    }
  }
  if (!current || !version || current.id !== version.bookId || current.revision !== version.revision)
    throw new AccountingError("El ejercicio cambió en otra sesión. Actualiza los datos y vuelve a intentar la operación.", 409);
  if (action === "newExercise") return result(await repo.commit(version, await initialBook(repo), "new"));
  if (action === "restore") return result(await repo.commit(version, restoreBook(data), "new"));
  if (action === "switchArchive") {
    if (typeof data !== "string" || !/^[0-9a-f-]{36}$/i.test(data)) throw new AccountingError("Ejercicio archivado inválido.");
    return result(await repo.commit(version, null, "switch", data));
  }
  const allowed = ["catalog", "entries", "reverse", "period", "settings", "kardex", "liquidacion-iva", "saldar-resultados"];
  if (!allowed.includes(action)) throw new AccountingError("Operación no permitida.");
  const change = localCommand(current.estado, action, data);
  return result(await repo.commit(version, change.estado, "save"), change.insertados, change.omitidos);
}
