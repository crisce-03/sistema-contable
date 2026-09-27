import { create } from "zustand";
import type { LibroLocal } from "../types";
import { emptyBook } from "../accounting/local";
import { cloudCommand } from "../accounting/cloud-storage";
let generation = 0;
interface AccountingState extends LibroLocal {
  listo: boolean;
  ocupado: boolean;
  error: string;
  bookId: string | null;
  revision: number | null;
  reiniciar: () => void;
  cargar: () => Promise<void>;
  ejecutar: (
    action: string,
    data: unknown,
  ) => Promise<{ insertados: number; omitidos: number }>;
  abrirArchivado: (key: string) => Promise<void>;
}
export const useAccountingStore = create<AccountingState>((set, get) => ({
  ...emptyBook(),
  listo: false,
  ocupado: false,
  error: "",
  bookId: null,
  revision: null,
  reiniciar: () => {
    generation++;
    set({ ...emptyBook(), listo: false, ocupado: false, error: "", bookId: null, revision: null });
  },
  cargar: async () => {
    if (get().ocupado) return;
    const requestGeneration = generation;
    set({ ocupado: true, error: "" });
    try {
      const r = await cloudCommand("init", {});
      if (generation === requestGeneration) set({ ...r.estado, bookId: r.id, revision: r.revision, listo: true });
    } catch (e) {
      if (generation === requestGeneration) set({ error: (e as Error).message });
    } finally {
      if (generation === requestGeneration) set({ ocupado: false });
    }
  },
  ejecutar: async (action, data) => {
    if (get().ocupado) throw new Error("Espera a que termine la operación.");
    const requestGeneration = generation;
    set({ ocupado: true, error: "" });
    try {
      const { bookId, revision } = get();
      const r = await cloudCommand(action, data, { bookId, revision });
      if (generation !== requestGeneration) throw new Error("La sesión cambió durante la operación.");
      set({ ...r.estado, bookId: r.id, revision: r.revision, listo: true });
      return { insertados: r.insertados, omitidos: r.omitidos };
    } catch (e) {
      if (generation === requestGeneration) set({ error: (e as Error).message });
      throw e;
    } finally {
      if (generation === requestGeneration) set({ ocupado: false });
    }
  },
  abrirArchivado: async (key) => {
    await get().ejecutar("switchArchive", key);
  },
}));
