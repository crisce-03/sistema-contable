"use client";
import { useState } from "react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { money } from "@/lib/accounting/core";
import { inventarioFinalKardex } from "@/lib/accounting/local";
import {
  balanceGeneral,
  cierreRegistrado,
  estadoResultados,
  type LineaReporte,
} from "@/lib/accounting/reports";

const monto = (n: number) => `${n < 0 ? "-" : ""}$${money(Math.abs(n))}`;

function Fila({
  concepto,
  importe,
  sangria = 0,
  resta = false,
  fuerte = false,
}: {
  concepto: string;
  importe: number;
  sangria?: number;
  resta?: boolean;
  fuerte?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-6 py-1 ${
        fuerte ? "font-semibold border-t border-zinc-300 mt-1 pt-1" : ""
      }`}
    >
      <span
        className={sangria === 1 ? "pl-4" : sangria === 2 ? "pl-8" : undefined}
      >
        {resta ? "(−) " : ""}
        {concepto}
      </span>
      <span className="tabular-nums whitespace-nowrap">{monto(importe)}</span>
    </div>
  );
}

function Grupo({ titulo, lineas }: { titulo: string; lineas: LineaReporte[] }) {
  if (!lineas.length) return null;
  return (
    <div className="mb-2">
      <p className="font-semibold text-xs uppercase tracking-wide text-zinc-500 mt-2">
        {titulo}
      </p>
      {lineas.map((l) => (
        <Fila
          key={l.codigo}
          concepto={`${l.codigo} · ${l.nombre}`}
          importe={l.importe}
          sangria={1}
        />
      ))}
    </div>
  );
}

function Bloque({
  titulo,
  porPlazo,
  total,
  etiqueta,
}: {
  titulo: string;
  porPlazo: { corriente: LineaReporte[]; noCorriente: LineaReporte[] };
  total: number;
  etiqueta: string;
}) {
  const vacio = !porPlazo.corriente.length && !porPlazo.noCorriente.length;
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider border-b border-black pb-1 mb-2">
        {titulo}
      </h3>
      {vacio ? (
        <p className="text-xs text-zinc-400 py-1 pl-4">Sin saldos.</p>
      ) : (
        <>
          <Grupo titulo={`${titulo} corriente`} lineas={porPlazo.corriente} />
          <Grupo
            titulo={`${titulo} no corriente`}
            lineas={porPlazo.noCorriente}
          />
        </>
      )}
      <Fila concepto={etiqueta} importe={total} fuerte />
    </div>
  );
}

export default function ReportesPage() {
  const { cuentas, asientos, configuracion, kardex, listo } =
    useAccountingStore();
  const [anio, setAnio] = useState(
    asientos.length
      ? Number(asientos[asientos.length - 1].fecha.slice(0, 4))
      : new Date().getFullYear(),
  );

  const resultado = estadoResultados(
    configuracion,
    cuentas,
    asientos,
    inventarioFinalKardex(kardex, asientos),
  );
  const balance = balanceGeneral(resultado);
  const cerrado = cierreRegistrado(anio, asientos);
  const faltantes = (
    ["ventas", "compras", "inventarios"] as const
  ).filter((rol) => !resultado.enlaces[rol]);

  return (
    <div className="max-w-6xl mx-auto space-y-10 font-sans text-zinc-900 pb-12">
      <header className="border-b border-black pb-4 flex items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Estados financieros
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Método analítico o pormenorizado. Importes en dólares.
          </p>
        </div>
        <label className="text-xs uppercase tracking-wider text-zinc-400">
          Ejercicio
          <input
            className="field"
            type="number"
            min={1900}
            max={2200}
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
          />
        </label>
      </header>

      {!listo && (
        <p role="status" className="text-sm text-zinc-500">
          Cargando datos locales…
        </p>
      )}

      {faltantes.length > 0 && (
        <p
          role="alert"
          className="border border-black bg-zinc-50 p-3 text-xs"
        >
          Sin reconocer en el catálogo: {faltantes.join(", ")}. Asigna esas
          cuentas en Configuración → Enlaces de cuentas para que el informe sea
          exacto.
        </p>
      )}

      {resultado.inventarioFinalOrigen === "sin-dato" && (
        <p
          role="alert"
          className="border border-black bg-zinc-50 p-3 text-xs"
        >
          No hay inventario final: ni conteo físico en Configuración, ni un
          producto configurado en el Kardex. Mientras tanto el costo de ventas
          absorbe toda la mercadería disponible.
        </p>
      )}

      {resultado.inventarioFinalOrigen === "conteo" &&
        resultado.inventarioFinalKardex !== 0 &&
        resultado.inventarioFinalKardex !== resultado.inventarioFinal && (
          <p className="border border-black bg-zinc-50 p-3 text-xs">
            El conteo físico (${money(resultado.inventarioFinal)}) difiere de
            la existencia del Kardex (${money(resultado.inventarioFinalKardex)}
            ) en ${money(
              Math.abs(
                resultado.inventarioFinal - resultado.inventarioFinalKardex,
              ),
            )}
            . Manda el conteo; la diferencia queda dentro del costo de ventas.
          </p>
        )}

      <section>
        <header className="mb-4">
          <h2 className="text-lg font-semibold">Estado de Resultados</h2>
          <p className="text-xs text-zinc-500">
            Del ejercicio {anio}
            {cerrado
              ? ` · cerrado con la partida #${cerrado.numero}`
              : " · ejercicio en curso"}
          </p>
        </header>

        <div className="border border-black bg-white p-6 text-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider border-b border-black pb-1 mb-2">
            Ingresos
          </h3>
          <Fila concepto="Ventas" importe={resultado.ventas} sangria={1} />
          <Fila
            concepto="Devoluciones y rebajas sobre ventas"
            importe={resultado.devolVentas}
            sangria={1}
            resta
          />
          <Fila concepto="VENTAS NETAS" importe={resultado.ventasNetas} fuerte />

          <h3 className="text-xs font-bold uppercase tracking-wider border-b border-black pb-1 mb-2 mt-6">
            Costo de lo vendido
          </h3>
          <Fila concepto="Compras" importe={resultado.compras} sangria={1} />
          <Fila
            concepto="Gastos sobre compras"
            importe={resultado.gastosCompra}
            sangria={1}
          />
          <Fila
            concepto="Compras totales"
            importe={resultado.comprasTotales}
            sangria={1}
            fuerte
          />
          <Fila
            concepto="Devoluciones y rebajas sobre compras"
            importe={resultado.devolCompras}
            sangria={1}
            resta
          />
          <Fila
            concepto="Compras netas"
            importe={resultado.comprasNetas}
            sangria={1}
            fuerte
          />
          <Fila
            concepto="Inventario inicial"
            importe={resultado.inventarioInicial}
            sangria={1}
          />
          <Fila
            concepto="Mercadería disponible"
            importe={resultado.mercaderiaDisponible}
            sangria={1}
            fuerte
          />
          <Fila
            concepto={
              resultado.inventarioFinalOrigen === "kardex"
                ? "Inventario final (según Kardex)"
                : "Inventario final (conteo físico)"
            }
            importe={resultado.inventarioFinal}
            sangria={1}
            resta
          />
          <Fila
            concepto="COSTO DE VENTAS"
            importe={resultado.costoVentas}
            fuerte
          />

          <h3 className="text-xs font-bold uppercase tracking-wider border-b border-black pb-1 mb-2 mt-6">
            Resultados
          </h3>
          <Fila concepto="UTILIDAD BRUTA" importe={resultado.utilidadBruta} fuerte />
          {resultado.gastosOperacion.map((l) => (
            <Fila
              key={l.codigo}
              concepto={`${l.codigo} · ${l.nombre}`}
              importe={l.importe}
              sangria={2}
              resta
            />
          ))}
          <Fila
            concepto="Total gastos de operación"
            importe={resultado.totalGastos}
            sangria={1}
            fuerte
          />
          {resultado.otrosIngresos.map((l) => (
            <Fila
              key={l.codigo}
              concepto={`${l.codigo} · ${l.nombre}`}
              importe={l.importe}
              sangria={2}
            />
          ))}
          {resultado.totalOtros !== 0 && (
            <Fila
              concepto="Total otros ingresos"
              importe={resultado.totalOtros}
              sangria={1}
              fuerte
            />
          )}

          <div className="flex justify-between gap-6 border-t-4 border-black mt-4 pt-3">
            <span className="font-bold uppercase tracking-wide">
              {resultado.utilidadNeta < 0 ? "Pérdida" : "Utilidad"} neta antes
              de impuestos
            </span>
            <span className="text-2xl font-bold tabular-nums whitespace-nowrap">
              {monto(resultado.utilidadNeta)}
            </span>
          </div>
        </div>
      </section>

      <section>
        <header className="mb-4">
          <h2 className="text-lg font-semibold">Balance General</h2>
          <p className="text-xs text-zinc-500">
            Al cierre del ejercicio {anio}. El inventario se presenta por su
            existencia final.
          </p>
        </header>

        <div className="border border-black bg-white">
          <div className="grid grid-cols-2 text-sm">
            <div className="p-6 border-r border-black">
              <Bloque
                titulo="Activo"
                porPlazo={balance.activoPorPlazo}
                total={balance.totalActivo}
                etiqueta="Total activo"
              />
            </div>
            <div className="p-6 space-y-6">
              <Bloque
                titulo="Pasivo"
                porPlazo={balance.pasivoPorPlazo}
                total={balance.totalPasivo}
                etiqueta="Total pasivo"
              />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider border-b border-black pb-1 mb-2">
                  Patrimonio
                </h3>
                {balance.patrimonio.map((l) => (
                  <Fila
                    key={l.codigo}
                    concepto={`${l.codigo} · ${l.nombre}`}
                    importe={l.importe}
                    sangria={1}
                  />
                ))}
                <Fila
                  concepto={`${resultado.utilidadNeta < 0 ? "Pérdida" : "Utilidad"} del ejercicio`}
                  importe={resultado.utilidadNeta}
                  sangria={1}
                />
                <Fila
                  concepto="Total patrimonio"
                  importe={balance.totalPatrimonio}
                  fuerte
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 bg-black text-white text-sm font-bold">
            <div className="flex justify-between gap-6 p-4 border-r border-zinc-700">
              <span className="uppercase tracking-wide">Total activos</span>
              <span className="tabular-nums">{monto(balance.totalActivo)}</span>
            </div>
            <div className="flex justify-between gap-6 p-4">
              <span className="uppercase tracking-wide">
                Total pasivo + patrimonio
              </span>
              <span className="tabular-nums">
                {monto(balance.totalPasivoPatrimonio)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3">
          {balance.cuadra ? (
            <span className="inline-block border border-green-700 text-green-800 bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Cuadre perfecto
            </span>
          ) : (
            <span
              role="alert"
              className="inline-block border border-red-700 text-red-800 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            >
              Descuadre de {monto(balance.diferencia)}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
