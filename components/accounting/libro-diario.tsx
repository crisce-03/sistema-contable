"use client";

import { useState, useMemo, useRef } from "react";
import { Plus, Trash2, Save, Calculator, Wand2 } from "lucide-react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { DetalleAsiento } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

export default function LibroDiarioMejorado() {
  const { cuentas, agregarAsiento } = useAccountingStore();
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [concepto, setConcepto] = useState("");
  const [detalles, setDetalles] = useState<DetalleAsiento[]>([]);

  const [busquedaCuenta, setBusquedaCuenta] = useState("");
  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = useState("");
  const [mostrarResultados, setMostrarResultados] = useState(false);

  const [parcialInput, setParcialInput] = useState("");
  const [debeInput, setDebeInput] = useState("");
  const [haberInput, setHaberInput] = useState("");
  
  // Estados del Asistente Fiscal
  const [mostrarAsistente, setMostrarAsistente] = useState(false);
  const [montoAsistente, setMontoAsistente] = useState("");
  const [tipoOperacion, setTipoOperacion] = useState<'compra' | 'venta'>('compra');

  const inputDebeRef = useRef<HTMLInputElement>(null);

  const totalDebe = detalles.reduce((sum, det) => sum + det.debe, 0);
  const totalHaber = detalles.reduce((sum, det) => sum + det.haber, 0);
  const estaCuadrado = totalDebe > 0 && Number(totalDebe.toFixed(2)) === Number(totalHaber.toFixed(2));
  const diferencia = Math.abs(totalDebe - totalHaber);

  const cuentasFiltradas = useMemo(() => {
    if (!busquedaCuenta) return cuentas;
    const busqueda = busquedaCuenta.toLowerCase();
    return cuentas.filter(c => c.codigo.includes(busqueda) || c.nombre.toLowerCase().includes(busqueda));
  }, [busquedaCuenta, cuentas]);

  // ===================================================================
  // MAGIA UX 1: GENERADOR AUTOMÁTICO DE PARTIDAS CON IVA Y PAGO A CUENTA
  // ===================================================================
  const generarPartidaAutomatica = () => {
    const total = parseFloat(montoAsistente);
    if (!total || total <= 0) return;

    // Regla contable: Monto / 1.13 = Neto. Neto * 0.13 = IVA
    const neto = total / 1.13;
    const iva = neto * 0.13;

    const nuevosDetalles: DetalleAsiento[] = [];

    if (tipoOperacion === 'compra') {
      const ctaInventario = cuentas.find(c => c.codigo.startsWith('1105')); // Inventarios
      const ctaIvaCredito = cuentas.find(c => c.codigo.startsWith('110901')); // IVA Crédito
      const ctaBancos = cuentas.find(c => c.codigo.startsWith('110102')); // Bancos

      if(ctaInventario) nuevosDetalles.push({ id: uuidv4(), cuentaId: ctaInventario.id, codigoCuenta: ctaInventario.codigo, parcial: 0, debe: Number(neto.toFixed(2)), haber: 0 });
      if(ctaIvaCredito) nuevosDetalles.push({ id: uuidv4(), cuentaId: ctaIvaCredito.id, codigoCuenta: ctaIvaCredito.codigo, parcial: 0, debe: Number(iva.toFixed(2)), haber: 0 });
      if(ctaBancos) nuevosDetalles.push({ id: uuidv4(), cuentaId: ctaBancos.id, codigoCuenta: ctaBancos.codigo, parcial: 0, debe: 0, haber: total });
    
    } else {
      const ctaBancos = cuentas.find(c => c.codigo.startsWith('110102')); // Bancos
      const ctaVentas = cuentas.find(c => c.codigo.startsWith('510101')); // Ventas
      const ctaIvaDebito = cuentas.find(c => c.codigo.startsWith('210801')); // IVA Débito
      
      if(ctaBancos) nuevosDetalles.push({ id: uuidv4(), cuentaId: ctaBancos.id, codigoCuenta: ctaBancos.codigo, parcial: 0, debe: total, haber: 0 });
      if(ctaVentas) nuevosDetalles.push({ id: uuidv4(), cuentaId: ctaVentas.id, codigoCuenta: ctaVentas.codigo, parcial: 0, debe: 0, haber: Number(neto.toFixed(2)) });
      if(ctaIvaDebito) nuevosDetalles.push({ id: uuidv4(), cuentaId: ctaIvaDebito.id, codigoCuenta: ctaIvaDebito.codigo, parcial: 0, debe: 0, haber: Number(iva.toFixed(2)) });
    }

    setDetalles([...detalles, ...nuevosDetalles]);
    setMostrarAsistente(false);
    setMontoAsistente("");
  };

  const seleccionarCuenta = (id: string, texto: string) => {
    setCuentaSeleccionadaId(id);
    setBusquedaCuenta(texto);
    setMostrarResultados(false);
    inputDebeRef.current?.focus(); 
  };

  const handleAgregarDetalle = () => {
    if (!cuentaSeleccionadaId) return;
    const cuenta = cuentas.find(c => c.id === cuentaSeleccionadaId);
    if (!cuenta) return;
    const debe = parseFloat(debeInput) || 0;
    const haber = parseFloat(haberInput) || 0;
    if (debe === 0 && haber === 0) return;

    setDetalles([...detalles, { id: uuidv4(), cuentaId: cuenta.id, codigoCuenta: cuenta.codigo, parcial: parseFloat(parcialInput) || 0, debe, haber }]);
    setBusquedaCuenta(""); setCuentaSeleccionadaId(""); setParcialInput(""); setDebeInput(""); setHaberInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAgregarDetalle(); }
  };

  const guardarTransaccion = () => {
    if (!estaCuadrado || !concepto || detalles.length < 2) return;
    if (agregarAsiento({ fecha, concepto, detalles })) {
      setConcepto(""); setDetalles([]); setBusquedaCuenta("");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans text-zinc-900 pb-12">
      <div className="flex items-end justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Registro de Asientos</h1>
          <p className="text-sm text-zinc-500 mt-1">Ingreso ágil y validación de partida doble.</p>
        </div>
        <button 
          onClick={() => setMostrarAsistente(!mostrarAsistente)}
          className={`text-xs flex items-center gap-2 px-3 py-1.5 border rounded-sm transition-colors ${mostrarAsistente ? 'bg-black text-white border-black' : 'text-zinc-600 border-zinc-200 hover:text-black'}`}
        >
          <Wand2 size={14} /> Asistente Fiscal Automático
        </button>
      </div>

      {/* Asistente Fiscal UI */}
      {mostrarAsistente && (
        <div className="bg-blue-50 border border-blue-200 p-6 flex items-end gap-4 animate-in slide-in-from-top-2">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Monto Total de la Factura (Con IVA)</label>
            <input type="number" placeholder="Ej. 113.00" value={montoAsistente} onChange={(e) => setMontoAsistente(e.target.value)} className="w-full p-2 text-sm border border-blue-300 focus:border-blue-600 outline-none rounded-sm bg-white"/>
          </div>
          <div className="w-48 space-y-1">
            <label className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Tipo de Operación</label>
            <select value={tipoOperacion} onChange={(e) => setTipoOperacion(e.target.value as 'compra'|'venta')} className="w-full p-2 text-sm border border-blue-300 focus:border-blue-600 outline-none rounded-sm bg-white">
              <option value="compra">Compra (Genera IVA Crédito)</option>
              <option value="venta">Venta (Genera IVA Débito)</option>
            </select>
          </div>
          <button onClick={generarPartidaAutomatica} className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-sm hover:bg-blue-700 transition-colors">
            Generar Líneas
          </button>
        </div>
      )}

      {/* Encabezado del Asiento */}
      <div className="bg-white border border-zinc-200 p-6 flex gap-6">
        <div className="w-48 space-y-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none rounded-sm"/>
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Concepto de la Operación</label>
          <input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. Compra de mercadería..." className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none rounded-sm"/>
        </div>
      </div>

      {/* Grid de Entrada de Datos */}
      <div className="bg-white border border-zinc-200">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-[10px] uppercase tracking-wider text-zinc-500 bg-zinc-50">
              <th className="py-2 px-3 font-bold w-1/3">Cuenta Contable</th>
              <th className="py-2 px-3 text-right font-bold w-1/6">Parcial</th>
              <th className="py-2 px-3 text-right font-bold w-1/6">Debe</th>
              <th className="py-2 px-3 text-right font-bold w-1/6">Haber</th>
              <th className="py-2 px-3 text-center font-bold w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {detalles.map((det) => (
              <tr key={det.id} className="group hover:bg-zinc-50 transition-colors">
                <td className="py-2 px-3 text-black"><span className="text-zinc-400 mr-2">{det.codigoCuenta}</span>{cuentas.find(c => c.id === det.cuentaId)?.nombre}</td>
                <td className="py-2 px-3 text-right text-zinc-500">{det.parcial > 0 ? det.parcial.toFixed(2) : ''}</td>
                <td className="py-2 px-3 text-right font-medium">{det.debe > 0 ? det.debe.toFixed(2) : ''}</td>
                <td className="py-2 px-3 text-right font-medium">{det.haber > 0 ? det.haber.toFixed(2) : ''}</td>
                <td className="py-2 px-3 text-center"><button onClick={() => setDetalles(detalles.filter(d => d.id !== det.id))} className="text-zinc-300 hover:text-red-600 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button></td>
              </tr>
            ))}
            
            <tr className="bg-blue-50/30">
              <td className="py-2 px-2 relative">
                <input type="text" placeholder="Buscar código o nombre..." value={busquedaCuenta} onChange={(e) => { setBusquedaCuenta(e.target.value); setMostrarResultados(true); }} onFocus={() => setMostrarResultados(true)} className="w-full p-1.5 text-sm bg-white border border-blue-200 focus:border-blue-500 outline-none rounded-sm shadow-sm"/>
                {mostrarResultados && busquedaCuenta && (
                  <ul className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 shadow-lg max-h-48 overflow-y-auto rounded-sm text-xs">
                    {cuentasFiltradas.length > 0 ? cuentasFiltradas.map(c => (
                      <li key={c.id} onClick={() => seleccionarCuenta(c.id, `${c.codigo} - ${c.nombre}`)} className="p-2 hover:bg-blue-50 cursor-pointer border-b border-zinc-100 flex justify-between">
                        <span className="font-medium text-black">{c.codigo}</span><span className="text-zinc-600 truncate ml-2">{c.nombre}</span>
                      </li>
                    )) : <li className="p-2 text-zinc-500 text-center">No hay resultados</li>}
                  </ul>
                )}
              </td>
              <td className="py-2 px-2"><input type="number" placeholder="0.00" value={parcialInput} onChange={(e) => setParcialInput(e.target.value)} onKeyDown={handleKeyDown} className="w-full p-1.5 text-sm text-right bg-white border border-blue-200 focus:border-blue-500 outline-none rounded-sm shadow-sm"/></td>
              <td className="py-2 px-2"><input ref={inputDebeRef} type="number" placeholder="0.00" value={debeInput} onChange={(e) => {setDebeInput(e.target.value); setHaberInput("");}} onKeyDown={handleKeyDown} className="w-full p-1.5 text-sm text-right bg-white border border-blue-200 focus:border-blue-500 outline-none rounded-sm shadow-sm"/></td>
              <td className="py-2 px-2"><input type="number" placeholder="0.00" value={haberInput} onChange={(e) => {setHaberInput(e.target.value); setDebeInput("");}} onKeyDown={handleKeyDown} className="w-full p-1.5 text-sm text-right bg-white border border-blue-200 focus:border-blue-500 outline-none rounded-sm shadow-sm"/></td>
              <td className="py-2 px-2 text-center"><button onClick={handleAgregarDetalle} disabled={!cuentaSeleccionadaId} className="p-1.5 text-blue-600 hover:bg-blue-100 disabled:text-zinc-300 rounded-sm w-full flex justify-center"><Plus size={16} /></button></td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-300 bg-zinc-50 font-semibold text-sm">
              <td colSpan={2} className="py-3 px-3">
                {diferencia > 0 && detalles.length > 0 && (
                  <button onClick={() => { if(totalDebe > totalHaber) { setHaberInput(diferencia.toFixed(2)); setDebeInput(""); } else { setDebeInput(diferencia.toFixed(2)); setHaberInput(""); } }} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-blue-600 hover:text-blue-800 bg-blue-100 px-2 py-1 rounded-sm">
                    <Calculator size={12} /> Autocuadrar Diferencia (${diferencia.toFixed(2)})
                  </button>
                )}
              </td>
              <td className={`py-3 px-3 text-right ${estaCuadrado ? 'text-black' : 'text-red-600'}`}>${totalDebe.toFixed(2)}</td>
              <td className={`py-3 px-3 text-right ${estaCuadrado ? 'text-black' : 'text-red-600'}`}>${totalHaber.toFixed(2)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-between items-center pt-2">
        <span className="text-xs text-zinc-500">Tecla <strong>Enter</strong> para flujo rápido.</span>
        <button onClick={guardarTransaccion} disabled={!estaCuadrado || !concepto || detalles.length < 2} className="flex items-center gap-2 px-6 py-2.5 bg-black text-white text-sm font-medium rounded-sm hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 shadow-sm">
          <Save size={16} /> Guardar Operación
        </button>
      </div>
    </div>
  );
}