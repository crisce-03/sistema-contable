"use client";

import { useAccountingStore } from "@/lib/store/accountingStore";
import { Session, useAuthSession } from "./session";
import { Sidebar } from "./sidebar";

function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const { cargar, ocupado, configuracion, error } = useAccountingStore();
  const { cerrarSesion, cerrandoSesion } = useAuthSession();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="min-w-0 flex-1 flex flex-col h-screen overflow-hidden">
        <header className="min-h-16 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 px-6 py-3 shadow-sm shrink-0">
          <h2 className="text-sm font-medium text-slate-500">Módulo de Contabilidad</h2>
          <div className="flex flex-wrap items-center gap-4">
            <button className="text-xs text-zinc-600 hover:text-black" disabled={ocupado || cerrandoSesion} onClick={() => void cargar()}>
              {ocupado ? "Guardando / actualizando…" : "Actualizar datos"}
            </button>
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium border border-green-200">
              Supabase · {configuracion.modoIva === "mas_iva" ? "Más IVA" : "IVA incluido"}
            </span>
            <button className="text-xs text-zinc-600 underline" disabled={cerrandoSesion} onClick={() => void cerrarSesion()}>
              {cerrandoSesion ? "Cerrando…" : "Cerrar sesión"}
            </button>
          </div>
        </header>
        {error && <p role="alert" className="bg-red-50 px-6 py-3 text-sm text-red-700">{error}</p>}
        <div className="flex-1 overflow-y-auto p-8">{children}</div>
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <Session><AuthenticatedShell>{children}</AuthenticatedShell></Session>;
}
