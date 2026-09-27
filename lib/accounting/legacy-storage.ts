import type { LibroLocal } from "../types";

/** Lectura únicamente: la migración nunca borra ni modifica IndexedDB. */
export async function legacyBooks(): Promise<{ key: string; book: LibroLocal }[]> {
  if (!globalThis.indexedDB) return [];
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("contabilidad-ejercicios-v2");
    let missing = false;
    request.onupgradeneeded = () => { missing = true; request.transaction?.abort(); };
    request.onerror = () => missing ? resolve([]) : reject(new Error("No se pudieron leer los ejercicios del navegador."));
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("books")) { db.close(); resolve([]); return; }
      const transaction = db.transaction("books", "readonly");
      const rows: { key: string; book: LibroLocal }[] = [];
      const cursor = transaction.objectStore("books").openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (row) {
          if (row.key === "current" || String(row.key).startsWith("archive-")) rows.push({ key: String(row.key), book: row.value });
          row.continue();
        }
      };
      transaction.oncomplete = () => { db.close(); resolve(rows); };
      transaction.onerror = () => { db.close(); reject(new Error("No se pudieron leer los ejercicios locales.")); };
    };
  });
}
