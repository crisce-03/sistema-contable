"use client";

import { useState } from "react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { calcularLiquidacionIva } from "@/lib/accounting/local";
import { cents, money } from "@/lib/accounting/core";
import { Calculator } from "lucide-react";

export default function LiquidacionIvaPage() {
  const s = useAccountingStore();

  const [fechaElegida, setFecha] = useState("");
  const [mensaje, setMensaje] = useState("");

  let r: ReturnType<typeof calcularLiquidacionIva> | null = null;
  let error = "";

  try {
    r = calcularLiquidacionIva(s);
  } catch (e) {
    error = (e as Error).message;
  }

  const fecha = r?.registrada?.fecha || fechaElegida || r?.fecha || new Date().toISOString().slice(0, 10);

  const nombreResultado = !r
    ? "Resultado pendiente"
    : r.diferencia > 0
      ? "IVA a pagar"
      : r.diferencia < 0
        ? "Remanente IVA a favor"
        : "Sin diferencia";

  const filas = r?.registrada
    ? r.registrada.detalles.map(d => ({
        nombre:
          s.cuentas.find(c => c.codigo === d.codigoCuenta)?.nombre ??
          d.codigoCuenta,
        debe: cents(d.debe),
        haber: cents(d.haber),
      }))
    : r
      ? [
          ...r.lineas.map((l) => ({
            nombre: s.cuentas.find((c) => c.codigo === l.codigoCuenta)?.nombre ?? l.codigoCuenta,
            debe: l.debe,
            haber: l.haber,
          })),
          {
            nombre:
              r.destino?.cuenta.nombre ??
              nombreResultado,
            debe: Math.max(-r.diferencia, 0),
            haber: Math.max(r.diferencia, 0),
          },
        ].filter(f => f.debe || f.haber)
      : [];

  const abierto = s.periodos.some(
    p => p.anio === Number(fecha.slice(0, 4)) && !p.cerrado,
  );

  async function registrar() {
    try {
      await s.ejecutar("liquidacion-iva", { fecha });
      setMensaje("Liquidación registrada. IVA crédito y débito fiscal quedaron saldados.");
    } catch (e) {
      setMensaje((e as Error).message);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans text-zinc-900">
      <div className="border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 space-y-2">
        <label className="flex items-center gap-3">
          Fecha de liquidación
          <input
            type="date"
            className="border border-zinc-300 bg-white p-2"
            value={fecha}
            min={r?.fecha}
            disabled={s.ocupado || !!r?.registrada}
            onChange={e => {
              setFecha(e.target.value);
              setMensaje("");
            }}
          />
        </label>

        <p>
          Se suma todo el IVA débito y crédito fiscal pendiente del diario,
          incluyendo devoluciones y subcuentas. Una sola partida salda ambas
          cuentas y lleva la diferencia a IVA a pagar o Remanente IVA a favor.
          La fecha indica cuándo se registra la partida; no filtra los movimientos.
        </p>

        {error && <p role="alert">{error}</p>}

        {!abierto && (
          <p>El año está cerrado o no existe en Configuración.</p>
        )}

        {mensaje && <p role="status">{mensaje}</p>}

        {r?.invertidos && (
          <p role="alert" className="text-amber-800">
            Hay un saldo de IVA contrario a su naturaleza. Se liquida cancelando
            cada cuenta por el lado que le corresponde; revisa los asientos
            si no lo esperabas.
          </p>
        )}

        {r?.registrada && (
          <p>
            Registrada en el asiento #{r.registrada.numero}.
            Para corregirla, revierte ese asiento.
          </p>
        )}
      </div>

      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Liquidación de IVA
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Liquidación acumulada de todos los saldos pendientes de IVA.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="bg-white border border-zinc-200 p-6 space-y-6">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-2">
            Saldos de Mayor
          </h2>

          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">
                IVA Crédito Fiscal (Compras)
              </p>
              <p className="text-xs text-zinc-500">Naturaleza Deudora</p>
            </div>
            <span className="text-lg font-medium">
              {r ? `$${money(r.cf)}` : "$—"}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">IVA Débito Fiscal (Ventas)</p>
              <p className="text-xs text-zinc-500">Naturaleza Acreedora</p>
            </div>
            <span className="text-lg font-medium">
              {r ? `$${money(r.df)}` : "$—"}
            </span>
          </div>

          <div className="pt-4 border-t-2 border-black flex justify-between items-center">
            <span className="text-sm font-bold uppercase">
              {nombreResultado}
            </span>
            <span className="text-xl font-bold">
              {r ? `$${money(Math.abs(r.diferencia))}` : "$—"}
            </span>
          </div>
        </div>

        <div className="bg-zinc-50 border border-zinc-200 p-6">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-200 pb-2 mb-4">
            {r?.registrada ? "Partida de liquidación registrada" : "Partida de Liquidación Sugerida"}
          </h2>

          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-300 text-xs uppercase text-zinc-500">
                <th className="py-2 font-medium">Cuenta</th>
                <th className="py-2 text-right font-medium">Debe</th>
                <th className="py-2 text-right font-medium">Haber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filas.map((f, i) => (
                <tr key={i}>
                  <td className={`py-2 ${f.haber ? "pl-4" : ""}`}>
                    {f.nombre}
                  </td>

                  <td className="py-2 text-right font-medium">
                    {f.debe ? `$${money(f.debe)}` : ""}
                  </td>

                  <td className="py-2 text-right font-medium">
                    {f.haber ? `$${money(f.haber)}` : ""}
                  </td>
                </tr>
              ))}

              {!filas.length && (
                <tr>
                  <td colSpan={3} className="py-4 text-zinc-500">
                    Sin importes para liquidar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {r?.destino && !r.registrada && (
            <p className="text-xs text-zinc-500 mt-4">
              {r.destino.crear ? "Se creará" : "Se utilizará"} la cuenta{" "}
              {r.destino.cuenta.codigo} · {r.destino.cuenta.nombre}{" "}
              ({r.destino.cuenta.tipo}).
            </p>
          )}
            
          <button
            type="button"
            onClick={registrar}
            className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-sm hover:bg-zinc-800 transition-colors"
            disabled={
              s.ocupado ||
              !s.listo ||
              !abierto ||
              !r ||
              !!r.registrada ||
              !r.lineas.length ||
              fecha < r.fecha
            }
          >
            <Calculator size={14} />
            Registrar Partida de Liquidación
          </button>
        </div>
      </div>
    </div>
  );
}
