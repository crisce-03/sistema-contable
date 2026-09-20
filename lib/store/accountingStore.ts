import { create } from "zustand";
import type { LibroLocal } from "../types";
import { emptyBook } from "../accounting/local";
import { browserCommand, switchArchive } from "../accounting/browser-storage";
interface AccountingState extends LibroLocal {
  listo: boolean;
  ocupado: boolean;
  error: string;
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
  cargar: async () => {
    if (get().ocupado) return;
    set({ ocupado: true, error: "" });
    try {
      const r = await browserCommand("init", {});
      set({ ...r.estado, listo: true });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ ocupado: false });
    }
  },
  ejecutar: async (action, data) => {
    if (get().ocupado) throw new Error("Espera a que termine la operación.");
    set({ ocupado: true, error: "" });
    try {
      const r = await browserCommand(action, data);
      set({ ...r.estado, listo: true });
      return { insertados: r.insertados, omitidos: r.omitidos };
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ ocupado: false });
    }
  },
  abrirArchivado: async (key) => {
    if (get().ocupado) throw new Error("Espera a que termine la operación.");
    set({ ocupado: true, error: "" });
    try {
      await switchArchive(key);
      const r = await browserCommand("init", {});
      set({ ...r.estado, listo: true });
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ ocupado: false });
    }
  },
}));
