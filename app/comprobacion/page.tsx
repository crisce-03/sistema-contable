"use client";
import { useState } from "react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { ledger, trial, cents, money } from "@/lib/accounting/core";
export default function Comprobacion() {
  const { cuentas, asientos } = useAccountingStore();
  const [hasta, setHasta] = useState("");
  const rows = trial(
    ledger(
      cuentas,
      asientos.filter((a) => !hasta || a.fecha <= hasta),
    ),
  ).filter((c) => c.debe || c.haber);
  const totals = rows.reduce(
    (t, c) => ({
      debe: t.debe + cents(c.debe),
      haber: t.haber + cents(c.haber),
      deudor: t.deudor + cents(c.deudor),
      acreedor: t.acreedor + cents(c.acreedor),
    }),
    { debe: 0, haber: 0, deudor: 0, acreedor: 0 },
  );
  return (
    <div className="accounting-original max-w-5xl mx-auto space-y-8 font-sans text-zinc-900 pb-12">
      <header className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Balanza de Comprobación
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Verificación de la partida doble en sumas y saldos de mayor.
        </p>
      </header>
      <p className="text-sm text-zinc-600">
        Sumas y saldos desde el inicio del libro. Incluye ajustes y reversiones;
        cada movimiento se cuenta una sola vez.
      </p>
      <label className="block max-w-xs text-sm">
        Hasta la fecha (opcional)
        <input
          className="field"
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
        />
      </label>
      <div className="overflow-auto bg-white border">
        <table className="data-table">
          <thead>
            <tr>
              <th colSpan={2}></th>
              <th colSpan={2} className="text-center">
                Sumas
              </th>
              <th colSpan={2} className="text-center">
                Saldos finales
              </th>
            </tr>
            <tr>
              <th>Código</th>
              <th>Cuenta</th>
              <th>Debe</th>
              <th>Haber</th>
              <th>Saldo deudor</th>
              <th>Saldo acreedor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.codigo}</td>
                <td>{c.nombre}</td>
                <td>{c.debe.toFixed(2)}</td>
                <td>{c.haber.toFixed(2)}</td>
                <td>{c.deudor.toFixed(2)}</td>
                <td>{c.acreedor.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={2}>Totales</td>
              <td>{money(totals.debe)}</td>
              <td>{money(totals.haber)}</td>
              <td>{money(totals.deudor)}</td>
              <td>{money(totals.acreedor)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p
        className={
          totals.debe === totals.haber && totals.deudor === totals.acreedor
            ? "text-green-800"
            : "text-red-700"
        }
      >
        {rows.length
          ? totals.debe === totals.haber && totals.deudor === totals.acreedor
            ? "Sumas y saldos cuadrados."
            : "Hay una diferencia que debe revisarse."
          : "No hay movimientos."}
      </p>
    </div>
  );
}
