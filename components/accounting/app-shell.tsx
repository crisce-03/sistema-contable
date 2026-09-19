"use client";

import { useAccountingStore } from "@/lib/store/accountingStore";
import { Session } from "./session";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { cargar, ocupado, configuracion } = useAccountingStore();
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="min-w-0 flex-1 flex flex-col h-screen overflow-hidden">
        {/* Barra superior (Header) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm shrink-0">
          <h2 className="text-sm font-medium text-slate-500">
            Módulo de Contabilidad - Sistema Base
          </h2>
          <div className="flex items-center gap-4">
            <button
              className="text-xs text-zinc-500 hover:text-black"
              disabled={ocupado}
              onClick={() => void cargar()}
            >
              Actualizar datos locales
            </button>
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium border border-green-200">
              Modo local ·{" "}
              {configuracion.modoIva === "mas_iva" ? "Más IVA" : "IVA incluido"}
            </span>
          </div>
        </header>

        {/* Área de contenido dinámico con scroll independiente */}
        <div className="flex-1 overflow-y-auto p-8">
          <Session>{children}</Session>
        </div>
      </main>
    </div>
  );
}
