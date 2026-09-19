"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

export default function LibrosIvaPage() {
  const [libroActivo, setLibroActivo] = useState<'compras' | 'ventas-ccf' | 'ventas-cf'>('compras');

  // Mocks de datos estructurados para que el backend sepa qué inyectar
  const datosCompras = [
    { fecha: '2026-09-06', documento: 'CCF-125', nrc: '147479-4', proveedor: 'SANTANI S.A.', exentas: 0, gravadas: 74000.00, iva: 9620.00, retencion: 0, total: 83620.00 },
    { fecha: '2026-09-14', documento: 'CCF-6547', nrc: '89012-3', proveedor: 'Gasolinera Uno', exentas: 0, gravadas: 755.75, iva: 98.25, retencion: 0, total: 854.00 },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 font-sans text-zinc-900 pb-12">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Registros Auxiliares Fiscales</h1>
        <p className="text-sm text-zinc-500 mt-1">Control del Impuesto al Valor Agregado (Libros de Compras y Ventas).</p>
      </div>

      <div className="flex border-b border-zinc-200">
        <button 
          onClick={() => setLibroActivo('compras')}
          className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${libroActivo === 'compras' ? 'border-b-2 border-black text-black' : 'text-zinc-400 hover:text-black'}`}
        >
          Libro de Compras
        </button>
        <button 
          onClick={() => setLibroActivo('ventas-ccf')}
          className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${libroActivo === 'ventas-ccf' ? 'border-b-2 border-black text-black' : 'text-zinc-400 hover:text-black'}`}
        >
          Ventas a Contribuyentes
        </button>
        <button 
          onClick={() => setLibroActivo('ventas-cf')}
          className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${libroActivo === 'ventas-cf' ? 'border-b-2 border-black text-black' : 'text-zinc-400 hover:text-black'}`}
        >
          Ventas a Consumidor Final
        </button>
      </div>

      <div className="bg-white border border-zinc-200 overflow-x-auto">
        {/* Cabecera dinámica según el libro */}
        <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center gap-2">
          <FileText size={16} className="text-zinc-400" />
          <h2 className="text-sm font-semibold text-black">
            {libroActivo === 'compras' && 'Libro de Compras (Mes Actual)'}
            {libroActivo === 'ventas-ccf' && 'Libro de Ventas a Contribuyentes (CCF)'}
            {libroActivo === 'ventas-cf' && 'Libro de Ventas a Consumidor Final (Facturas)'}
          </h2>
        </div>

        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-300 text-zinc-500 uppercase tracking-wider">
              <th className="p-3 font-medium">Fecha</th>
              <th className="p-3 font-medium">No. Doc.</th>
              <th className="p-3 font-medium">NRC</th>
              <th className="p-3 font-medium">{libroActivo === 'compras' ? 'Proveedor' : 'Cliente'}</th>
              <th className="p-3 text-right font-medium">Exentas</th>
              <th className="p-3 text-right font-medium">Gravadas</th>
              <th className="p-3 text-right font-medium">IVA Crédito/Débito</th>
              <th className="p-3 text-right font-medium">Retención/Percepción</th>
              <th className="p-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {libroActivo === 'compras' && datosCompras.map((fila, i) => (
              <tr key={i} className="hover:bg-zinc-50 transition-colors">
                <td className="p-3 text-zinc-500">{fila.fecha}</td>
                <td className="p-3">{fila.documento}</td>
                <td className="p-3 text-zinc-500">{fila.nrc}</td>
                <td className="p-3 font-medium">{fila.proveedor}</td>
                <td className="p-3 text-right text-zinc-500">${fila.exentas.toFixed(2)}</td>
                <td className="p-3 text-right font-medium">${fila.gravadas.toFixed(2)}</td>
                <td className="p-3 text-right font-medium">${fila.iva.toFixed(2)}</td>
                <td className="p-3 text-right text-zinc-500">${fila.retencion.toFixed(2)}</td>
                <td className="p-3 text-right font-bold">${fila.total.toFixed(2)}</td>
              </tr>
            ))}
            {libroActivo !== 'compras' && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-zinc-400 uppercase tracking-widest">
                  Sin registros para este periodo
                </td>
              </tr>
            )}
          </tbody>
          {libroActivo === 'compras' && (
            <tfoot>
              <tr className="border-t-2 border-black bg-zinc-50 font-bold">
                <td colSpan={4} className="p-3 text-right uppercase text-zinc-500 tracking-wider">Totales del Mes</td>
                <td className="p-3 text-right">$0.00</td>
                <td className="p-3 text-right">${datosCompras.reduce((s, c) => s + c.gravadas, 0).toFixed(2)}</td>
                <td className="p-3 text-right">${datosCompras.reduce((s, c) => s + c.iva, 0).toFixed(2)}</td>
                <td className="p-3 text-right">$0.00</td>
                <td className="p-3 text-right">${datosCompras.reduce((s, c) => s + c.total, 0).toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}