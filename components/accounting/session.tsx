"use client";
import { useEffect } from "react";
import { useAccountingStore } from "@/lib/store/accountingStore";
export function Session({ children }: { children: React.ReactNode }) {
  const { listo, ocupado, error, cargar } = useAccountingStore();
  useEffect(() => {
    void cargar();
    const refresh = () => {
      void cargar();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [cargar]);
  if (!listo)
    return (
      <section className="max-w-lg mx-auto bg-white border rounded p-8 space-y-4">
        <h1 className="text-2xl font-semibold">
          {error
            ? "No se pudo abrir el ejercicio"
            : "Abriendo ejercicio local…"}
        </h1>
        {error && <p role="alert">{error}</p>}
        <p className="text-sm text-zinc-600">
          No necesitas cuenta ni conexión a Supabase. Se utiliza el
          almacenamiento de este navegador.
        </p>
        <button
          className="primary"
          disabled={ocupado}
          onClick={() => void cargar()}
        >
          Reintentar
        </button>
      </section>
    );
  return <>{children}</>;
}
