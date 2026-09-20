"use client";
import { useState } from "react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { familias, cents, money } from "@/lib/accounting/core";
export default function Mayor() {
  const { cuentas, asientos } = useAccountingStore();
  const [hasta, setHasta] = useState(""),
    [group, setGroup] = useState(true);
  const display = group
    ? familias.map((f) => ({ id: f.id, codigo: f.codigo, nombre: f.nombre }))
    : cuentas;
  return (
    <div className="max-w-6xl mx-auto space-y-8 font-sans text-zinc-900 pb-12">
      <header className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Libro Mayor</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Mayorización automática de cargos y abonos en Cuentas T.
        </p>
      </header>
      <p className="text-sm text-zinc-600">
        Cargos, abonos y saldo real. Cada asiento guardado se refleja
        automáticamente.
      </p>
      <div className="flex gap-6 items-end">
        <label className="text-sm">
          Hasta la fecha
          <input
            className="field"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <input
            type="checkbox"
            checked={group}
            onChange={(e) => setGroup(e.target.checked)}
          />{" "}
          Agrupar por cuenta principal
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {display.map((c) => {
          const ids = new Set(
            cuentas
              .filter((a) => (group ? a.familia === c.id : a.id === c.id))
              .map((a) => a.id),
          );
          const movements = asientos
            .filter((a) => !hasta || a.fecha <= hasta)
            .flatMap((a) =>
              a.detalles
                .filter((d) => ids.has(d.cuentaId))
                .map((d) => ({ ...d, fecha: a.fecha, numero: a.numero })),
            );
          if (!movements.length) return null;
          const debit = movements.reduce((s, d) => s + cents(d.debe), 0),
            credit = movements.reduce((s, d) => s + cents(d.haber), 0);
          return (
            <section key={c.id} className="bg-white text-sm">
              <h2 className="text-center font-semibold text-xs uppercase tracking-wider pb-2 border-b-2 border-black">
                {c.codigo} - {c.nombre}
              </h2>
              <div className="flex border-b border-zinc-200">
                {(["debe", "haber"] as const).map((side) => (
                  <div
                    key={side}
                    className={`w-1/2 min-h-30 flex flex-col ${side === "debe" ? "border-r border-black" : ""}`}
                  >
                    <div className="text-center text-[10px] text-zinc-400 font-bold tracking-widest py-1 border-b border-zinc-100">
                      {side.toUpperCase()}
                    </div>
                    <ul className="flex-1 p-2 space-y-1">
                      {movements
                        .filter((m) => m[side] > 0)
                        .map((m) => (
                          <li
                            key={m.id}
                            className="flex justify-between text-zinc-700 gap-2"
                          >
                            <span
                              className="text-[10px] text-zinc-400"
                              title={m.fecha}
                            >
                              {m.fecha.slice(5)} · #{m.numero}
                            </span>
                            <span>{m[side].toFixed(2)}</span>
                          </li>
                        ))}
                    </ul>
                    <div className="p-2 border-t border-zinc-200 text-right font-medium text-black">
                      {money(side === "debe" ? debit : credit)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-medium uppercase tracking-wider">
                  Saldo{" "}
                  {debit > credit
                    ? "deudor"
                    : debit < credit
                      ? "acreedor"
                      : "cero"}
                </span>
                <span className="font-bold border-double border-b-4 border-black pb-0.5">
                  ${money(Math.abs(debit - credit))}
                </span>
              </div>
            </section>
          );
        })}
      </div>
      {!asientos.length && <p>No hay movimientos registrados.</p>}
    </div>
  );
}
