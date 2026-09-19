"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

interface MovimientoKardex {
  id: string;
  fecha: string;
  concepto: string;
  entradaUnidades: number;
  entradaCosto: number;
  salidaUnidades: number;
  salidaCosto: number;
  saldoUnidades: number;
  saldoCosto: number;
  saldoTotal: number;
}

export default function KardexInteractivo() {
  const [movimientos, setMovimientos] = useState<MovimientoKardex[]>([
    { id: '1', fecha: '2026-10-01', concepto: 'Inventario Inicial', entradaUnidades: 100, entradaCosto: 150.00, salidaUnidades: 0, salidaCosto: 0, saldoUnidades: 100, saldoCosto: 150.00, saldoTotal: 15000.00 },
  ]);

  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [concepto, setConcepto] = useState("");
  const [tipoOperacion, setTipoOperacion] = useState<'entrada' | 'salida'>('entrada');
  const [cantidad, setCantidad] = useState("");
  const [costoUnitarioEntrada, setCostoUnitarioEntrada] = useState("");

  const handleAgregarMovimiento = (e: React.FormEvent) => {
    e.preventDefault();
    const cant = parseFloat(cantidad) || 0;
    if (cant <= 0 || !concepto) return;

    const ultimoMovimiento = movimientos[movimientos.length - 1];
    let nuevoSaldoUnidades = ultimoMovimiento.saldoUnidades;
    let nuevoSaldoTotal = ultimoMovimiento.saldoTotal;
    let nuevoSaldoCosto = ultimoMovimiento.saldoCosto;

    let entradaU = 0, entradaC = 0, salidaU = 0, salidaC = 0;

    // MAGIA UX 2: CÁLCULO DE COSTO PROMEDIO AUTOMÁTICO
    if (tipoOperacion === 'entrada') {
      const costoEntrada = parseFloat(costoUnitarioEntrada) || 0;
      entradaU = cant;
      entradaC = costoEntrada;
      
      nuevoSaldoUnidades += cant;
      nuevoSaldoTotal += (cant * costoEntrada);
      nuevoSaldoCosto = nuevoSaldoTotal / nuevoSaldoUnidades; // Fórmula Costo Promedio
    } else {
      salidaU = cant;
      salidaC = ultimoMovimiento.saldoCosto; // En una salida, toma el costo promedio actual automáticamente
      
      nuevoSaldoUnidades -= cant;
      nuevoSaldoTotal -= (cant * salidaC);
      nuevoSaldoCosto = nuevoSaldoUnidades === 0 ? 0 : (nuevoSaldoTotal / nuevoSaldoUnidades);
    }

    setMovimientos([...movimientos, {
      id: Math.random().toString(), fecha, concepto,
      entradaUnidades: entradaU, entradaCosto: entradaC,
      salidaUnidades: salidaU, salidaCosto: salidaC,
      saldoUnidades: nuevoSaldoUnidades, saldoCosto: nuevoSaldoCosto, saldoTotal: nuevoSaldoTotal
    }]);

    setConcepto(""); setCantidad(""); setCostoUnitarioEntrada("");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans text-zinc-900 pb-12">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tarjeta Kardex Automatizada</h1>
        <p className="text-sm text-zinc-500 mt-1">Control de Inventario mediante el método de Costo Promedio.</p>
      </div>

      <div className="flex gap-4 text-sm font-medium">
        <div className="px-3 py-1.5 border border-zinc-200 bg-white rounded-sm shadow-sm">Producto: Impresoras Láser</div>
        <div className="px-3 py-1.5 border border-zinc-200 bg-white rounded-sm shadow-sm">Código: INV-001</div>
        <div className="px-3 py-1.5 border border-zinc-200 bg-white rounded-sm shadow-sm">Método: Costo Promedio</div>
      </div>

      {/* Formulario de Registro Ágil */}
      <form onSubmit={handleAgregarMovimiento} className="bg-zinc-50 border border-zinc-200 p-4 flex items-end gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Operación</label>
          <select value={tipoOperacion} onChange={(e) => setTipoOperacion(e.target.value as 'entrada'|'salida')} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm">
            <option value="entrada">Entrada (Compra)</option>
            <option value="salida">Salida (Venta)</option>
          </select>
        </div>
        <div className="w-32 space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm" required/>
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Concepto</label>
          <input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. Compra s/CCF 1654" className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm" required/>
        </div>
        <div className="w-24 space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Cantidad</label>
          <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm text-right" required/>
        </div>
        
        {tipoOperacion === 'entrada' && (
          <div className="w-28 space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Costo Unitario</label>
            <input type="number" step="0.01" value={costoUnitarioEntrada} onChange={(e) => setCostoUnitarioEntrada(e.target.value)} placeholder="0.00" className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm text-right" required/>
          </div>
        )}

        <button type="submit" className="px-4 py-2 bg-black text-white text-sm font-medium rounded-sm hover:bg-zinc-800 transition-colors flex items-center gap-2">
          <Plus size={14} /> Registrar
        </button>
      </form>

      {/* Tabla Kardex */}
      <div className="overflow-x-auto border border-zinc-200 bg-white">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr>
              <th rowSpan={2} className="border-b border-zinc-200 p-2 font-medium bg-white">Fecha</th>
              <th rowSpan={2} className="border-b border-zinc-200 p-2 font-medium bg-white border-r">Concepto</th>
              <th colSpan={3} className="border-b border-zinc-200 p-2 font-bold text-center bg-zinc-100 border-r text-black tracking-wider">ENTRADAS</th>
              <th colSpan={3} className="border-b border-zinc-200 p-2 font-bold text-center bg-zinc-50 border-r text-black tracking-wider">SALIDAS</th>
              <th colSpan={3} className="border-b border-zinc-200 p-2 font-bold text-center bg-black text-white tracking-wider">EXISTENCIAS (PROMEDIO)</th>
            </tr>
            <tr className="bg-zinc-50 border-b-2 border-black">
              <th className="p-2 font-medium text-center text-zinc-500">Cant.</th>
              <th className="p-2 font-medium text-center text-zinc-500">C.U.</th>
              <th className="p-2 font-medium text-center text-zinc-500 border-r">Total</th>
              <th className="p-2 font-medium text-center text-zinc-500">Cant.</th>
              <th className="p-2 font-medium text-center text-zinc-500">C.U.</th>
              <th className="p-2 font-medium text-center text-zinc-500 border-r">Total</th>
              <th className="p-2 font-medium text-center text-zinc-500 bg-zinc-100">Cant.</th>
              <th className="p-2 font-medium text-center text-zinc-500 bg-zinc-100">C.U.</th>
              <th className="p-2 font-medium text-center text-zinc-500 bg-zinc-100">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {movimientos.map((mov) => (
              <tr key={mov.id} className="hover:bg-zinc-50">
                <td className="p-2 text-zinc-500">{mov.fecha}</td>
                <td className="p-2 font-medium border-r border-zinc-100">{mov.concepto}</td>
                
                <td className="p-2 text-right">{mov.entradaUnidades || '-'}</td>
                <td className="p-2 text-right">{mov.entradaUnidades ? `$${mov.entradaCosto.toFixed(2)}` : '-'}</td>
                <td className="p-2 text-right font-medium text-black border-r border-zinc-100 bg-zinc-50/50">{mov.entradaUnidades ? `$${(mov.entradaUnidades * mov.entradaCosto).toFixed(2)}` : '-'}</td>
                
                <td className="p-2 text-right">{mov.salidaUnidades || '-'}</td>
                <td className="p-2 text-right text-zinc-500">{mov.salidaUnidades ? `$${mov.salidaCosto.toFixed(2)}` : '-'}</td>
                <td className="p-2 text-right font-medium text-black border-r border-zinc-100">{mov.salidaUnidades ? `$${(mov.salidaUnidades * mov.salidaCosto).toFixed(2)}` : '-'}</td>
                
                <td className="p-2 text-right font-bold text-black bg-zinc-50">{mov.saldoUnidades}</td>
                <td className="p-2 text-right text-blue-600 bg-zinc-50 font-medium">${mov.saldoCosto.toFixed(2)}</td>
                <td className="p-2 text-right font-bold text-black bg-zinc-50">${mov.saldoTotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}