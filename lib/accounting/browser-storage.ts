import { emptyBook, localCommand } from "./local";
import type { LibroLocal } from "../types";
const DB = "contabilidad-ejercicios-v2";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("books");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(
        new Error("No se pudo abrir el almacenamiento local del navegador."),
      );
  });
}
export async function browserCommand(action: string, data: unknown) {
  const db = await open();
  return new Promise<ReturnType<typeof localCommand>>((resolve, reject) => {
    const tx = db.transaction("books", "readwrite"),
      store = tx.objectStore("books");
    let result: ReturnType<typeof localCommand>, failure: unknown;
    const req = store.get("current");
    req.onsuccess = () => {
      try {
        const current = req.result as LibroLocal | undefined;
        if (current && current.versionLocal !== 2)
          throw new Error(
            "Versión local incompatible. No se sobrescribieron los datos.",
          );
        if (action === "newExercise") {
          if (current) store.put(current, "archive-" + crypto.randomUUID());
          result = { estado: emptyBook(), insertados: 0, omitidos: 0 };
        } else result = localCommand(current ?? emptyBook(), action, data);
        store.put(result.estado, "current");
      } catch (e) {
        failure = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        failure ??
          new Error(
            "No se guardó el cambio. Revisa el espacio o permisos del navegador.",
          ),
      );
    };
  });
}
export async function archives() {
  const db = await open();
  return new Promise<{ key: string; book: LibroLocal }[]>((resolve, reject) => {
    const tx = db.transaction("books", "readonly"),
      store = tx.objectStore("books");
    const rows: { key: string; book: LibroLocal }[] = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) {
        if (String(c.key).startsWith("archive-"))
          rows.push({ key: String(c.key), book: c.value });
        c.continue();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(rows);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function switchArchive(key: string) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("books", "readwrite"),
      store = tx.objectStore("books");
    let fail: Error | undefined;
    const req = store.get(key);
    req.onsuccess = () => {
      if (!key.startsWith("archive-") || !req.result) {
        fail = new Error("Ejercicio archivado inexistente.");
        tx.abort();
        return;
      }
      const selected = req.result;
      const cur = store.get("current");
      cur.onsuccess = () => {
        if (cur.result) store.put(cur.result, "archive-" + crypto.randomUUID());
        store.put(selected, "current");
        store.delete(key);
      };
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(fail ?? tx.error);
    };
  });
}
