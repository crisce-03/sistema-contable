"use client";

import { useAccountingStore } from "@/lib/store/accountingStore";
import Link from "next/link";

export default function DashboardPage() {
  const { cuentas, asientos, periodos } = useAccountingStore();
  const asientosRecientes = [...asientos].reverse().slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto space-y-8 font-sans text-zinc-900 pb-12">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Resumen Contable
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Panorama del catálogo, asientos y períodos del ejercicio.
        </p>
      </div>

      {/* Métricas Principales (Brutalistas) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-0 border border-zinc-200 bg-white">
        <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Cuentas
          </h3>
          <p className="text-2xl font-semibold mt-2 text-black">
            {cuentas.length}
          </p>
        </div>
        <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Asientos
          </h3>
          <p className="text-2xl font-semibold mt-2 text-black">
            {asientos.length}
          </p>
        </div>
        <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Períodos abiertos
          </h3>
          <p className="text-2xl font-semibold mt-2 text-black">
            {periodos.filter((p) => !p.cerrado).length}
          </p>
        </div>
        <div className="p-6">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Cuentas activas
          </h3>
          <p className="text-2xl font-semibold mt-2 text-black">
            {cuentas.filter((c) => c.activa).length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tabla de Actividad Reciente */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-black">
              Transacciones Recientes
            </h2>
            <Link
              href="/asientos"
              className="text-xs font-medium text-zinc-500 hover:text-black transition-colors"
            >
              Ver Libro Diario →
            </Link>
          </div>

          <table className="w-full text-sm text-left border-collapse bg-white border border-zinc-200">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
                <th className="py-3 px-4 font-medium">Fecha</th>
                <th className="py-3 px-4 font-medium">Concepto</th>
                <th className="py-3 px-4 text-right font-medium">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {asientosRecientes.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="py-8 text-center text-zinc-400 text-xs uppercase tracking-widest"
                  >
                    Sin actividad reciente
                  </td>
                </tr>
              ) : (
                asientosRecientes.map((asiento) => {
                  const montoTotal = asiento.detalles.reduce(
                    (sum, det) => sum + det.debe,
                    0,
                  );
                  return (
                    <tr
                      key={asiento.id}
                      className="hover:bg-zinc-50 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-500">
                        {asiento.fecha}
                      </td>
                      <td className="py-3 px-4 text-black">
                        {asiento.concepto}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-black">
                        ${montoTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Panel lateral: Atajos Operativos */}
        <div>
          <div className="border-b border-zinc-200 pb-2 mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-black">
              Operaciones
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href="/asientos"
              className="p-3 border border-zinc-200 bg-white hover:border-black text-sm text-zinc-600 hover:text-black transition-all flex justify-between items-center group"
            >
              Registrar Asiento Contable
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                →
              </span>
            </Link>
            <Link
              href="/catalogo"
              className="p-3 border border-zinc-200 bg-white hover:border-black text-sm text-zinc-600 hover:text-black transition-all flex justify-between items-center group"
            >
              Administrar Catálogo
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                →
              </span>
            </Link>
            <Link
              href="/mayorizacion"
              className="p-3 border border-zinc-200 bg-white hover:border-black text-sm text-zinc-600 hover:text-black transition-all flex justify-between items-center group"
            >
              Consultar Libro Mayor
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                →
              </span>
            </Link>
            <Link
              href="/comprobacion"
              className="p-3 border border-zinc-200 bg-white hover:border-black text-sm text-zinc-600 hover:text-black transition-all flex justify-between items-center group"
            >
              Balance de Comprobación
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
