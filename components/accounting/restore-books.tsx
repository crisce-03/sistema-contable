"use client";
import { useState } from "react";
import { legacyBooks } from "@/lib/accounting/legacy-storage";
import { useAccountingStore } from "@/lib/store/accountingStore";

export function RestoreBooks() {
  const { ejecutar, ocupado } = useAccountingStore();
  const [books, setBooks] = useState<Awaited<ReturnType<typeof legacyBooks>>>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<{ label: string; data: unknown } | null>(null);
  return <div className="border-t pt-4 space-y-3">
    <h3 className="text-sm font-semibold">Trasladar datos y restaurar respaldos</h3>
    <p className="text-xs text-zinc-600">Cada importación abre un ejercicio independiente en tu cuenta. El ejercicio actual queda archivado. Los datos originales del navegador se conservan.</p>
    <button disabled={ocupado} onClick={() => void legacyBooks().then(rows => {
      setBooks(rows); setMessage(rows.length ? "Selecciona el ejercicio que deseas trasladar." : "No se encontraron ejercicios locales en este navegador.");
    }).catch(e => setMessage(e.message))}>Buscar ejercicios en este navegador</button>
    {books.map(row => <div key={row.key} className="flex justify-between gap-3 text-sm">
      <span>{row.key === "current" ? "Ejercicio local actual" : "Archivo local"} · {row.book.asientos.length} asientos</span>
      <button disabled={ocupado} onClick={() => setPending({ label: "ejercicio local", data: row.book })}>Trasladar a Supabase</button>
    </div>)}
    <label className="block text-sm">Restaurar respaldo completo (.json)
      <input className="field" type="file" accept=".json,application/json" disabled={ocupado} onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (!file) return;
        try {
          if (file.size > 10 * 1024 * 1024) throw new Error("El archivo supera 10 MB.");
          setPending({ label: file.name, data: JSON.parse(await file.text()) }); setMessage("");
        } catch (error) { setMessage((error as Error).message); }
      }} />
    </label>
    {pending && <div className="border p-3 space-y-3">
      <p className="text-sm">Se validará {pending.label} y se guardará como un nuevo ejercicio de tu cuenta.</p>
      <button className="primary" disabled={ocupado} onClick={() => void ejecutar("restore", pending.data)
        .then(() => { setPending(null); setMessage("Ejercicio guardado en Supabase. El anterior está archivado."); })
        .catch(e => setMessage(e.message))}>Confirmar importación</button>
      <button className="ml-4" disabled={ocupado} onClick={() => setPending(null)}>Cancelar</button>
    </div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
