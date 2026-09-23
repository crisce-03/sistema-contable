"use client";

import { useState } from "react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { calcularLiquidacionIva } from "@/lib/accounting/local";
import { canPost, cents, money } from "@/lib/accounting/core";
import { Calculator } from "lucide-react";

export default function LiquidacionIvaPage() {
    const s = useAccountingStore();

  const [mesElegido, setMes] = useState("");
  const [destino, setDestino] = useState("");
  const [mensaje, setMensaje] = useState("");

  const mes =
    mesElegido ||
    s.asientos.map(a => a.fecha.slice(0, 7)).sort().at(-1) ||
    new Date().toISOString().slice(0, 7);

  let r: ReturnType<typeof calcularLiquidacionIva> | null = null;
  let error = "";

  try {
    r = calcularLiquidacionIva(s, mes);
  } catch (e) {
    error = (e as Error).message;
  }

  const destinos = r
    ? s.cuentas.filter(
        c =>
          canPost(c, s.cuentas) &&
          c.tipo === (r.diferencia > 0 ? "Pasivo" : "Activo") &&
          ![r.credito.codigo, r.debito.codigo].some(
            raiz =>
              c.codigo.startsWith(raiz) ||
              raiz.startsWith(c.codigo),
          ),
      )
    : [];

  const destinoValido = destinos.some(c => c.codigo === destino);

  const nombreResultado = !r
    ? "Resultado pendiente"
    : r.diferencia > 0
      ? "IVA por pagar"
      : r.diferencia < 0
        ? "Remanente a favor"
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
          {
            nombre: r.debito.nombre,
            debe: Math.max(r.df, 0),
            haber: Math.max(-r.df, 0),
          },
          {
            nombre: r.credito.nombre,
            debe: Math.max(-r.cf, 0),
            haber: Math.max(r.cf, 0),
          },
          {
            nombre:
              destinos.find(c => c.codigo === destino)?.nombre ??
              nombreResultado,
            debe: Math.max(-r.diferencia, 0),
            haber: Math.max(r.diferencia, 0),
          },
        ].filter(f => f.debe || f.haber)
      : [];

  const abierto = s.periodos.some(
    p => p.anio === Number(mes.slice(0, 4)) && !p.cerrado,
  );

  async function registrar() {
    try {
      await s.ejecutar("liquidacion-iva", { mes, destino });
      setMensaje("Liquidación registrada. Diario y mayor actualizados.");
    } catch (e) {
      setMensaje((e as Error).message);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans text-zinc-900">
            <div className="border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 space-y-2">
        <label className="flex items-center gap-3">
          Mes a liquidar
          <input
            type="month"
            className="border border-zinc-300 bg-white p-2"
            value={mes}
            disabled={s.ocupado}
            onChange={e => {
              setMes(e.target.value);
              setDestino("");
              setMensaje("");
            }}
          />
        </label>

        <p>
          Saldos netos del mes, antes de esta liquidación.
          Incluyen devoluciones y subcuentas.
        </p>

        {error && <p role="alert">{error}</p>}

        {!abierto && (
          <p>El año está cerrado o no existe en Configuración.</p>
        )}

        {mensaje && <p role="status">{mensaje}</p>}

        {r?.invertidos && (
          <p role="alert" className="text-amber-800">
            Este mes cierra con algún IVA contrario a su naturaleza, lo normal
            tras revertir una operación de otro mes. Se liquida cancelando
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
          Cálculo mensual de confrontación fiscal.
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

                    {r && r.diferencia !== 0 && !r.registrada && (
            <label className="block text-xs text-zinc-500 mt-4">
              Cuenta de{" "}
              {r.diferencia > 0 ? "IVA por pagar" : "remanente a favor"}

              <select
                className="field"
                value={destino}
                disabled={s.ocupado}
                onChange={e => setDestino(e.target.value)}
              >
                <option value="">Seleccionar cuenta del catálogo</option>

                {destinos.map(c => (
                  <option key={c.id} value={c.codigo}>
                    {c.codigo} · {c.nombre}
                  </option>
                ))}
              </select>

              <span>
                Si falta, créala en el catálogo como{" "}
                {r.diferencia > 0 ? "Pasivo" : "Activo"}.
              </span>
            </label>
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
              (!r.cf && !r.df) ||
              (!!r.diferencia && !destinoValido)
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
