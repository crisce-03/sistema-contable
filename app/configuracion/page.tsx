"use client";

import { useState } from "react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { Save, LockKeyhole } from "lucide-react";
import { DetalleAsiento } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

export default function ConfiguracionPage() {
  const { cuentas, agregarAsiento } = useAccountingStore();
  const [guardado, setGuardado] = useState(false);

  const [iva, setIva] = useState(13);
  const [retencion, setRetencion] = useState(1);
  const [periodoInicio, setPeriodoInicio] = useState("2026-01-01");
  const [periodoFin, setPeriodoFin] = useState("2026-12-31");
  const [estadoPeriodo, setEstadoPeriodo] = useState("Abierto");

  // Enlaces de Cuentas base extraídas de tu catálogo comercial
  const [cuentaIvaDebito, setCuentaIvaDebito] = useState(cuentas.find(c => c.codigo.startsWith('2108'))?.id || "");
  const [cuentaIvaCredito, setCuentaIvaCredito] = useState(cuentas.find(c => c.codigo.startsWith('1109'))?.id || "");
  
  const [cuentaLiquidadora, setCuentaLiquidadora] = useState(cuentas.find(c => c.codigo.startsWith('6101'))?.id || "");
  const [cuentaUtilidad, setCuentaUtilidad] = useState(cuentas.find(c => c.codigo.startsWith('3202'))?.id || "");

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  };

  // ==========================================
  // MOTOR DE CIERRE CONTABLE (LIQUIDACIÓN AUTOMÁTICA)
  // ==========================================
  const ejecutarCierreContable = () => {
    if (!cuentaLiquidadora || !cuentaUtilidad) {
      alert("Por favor, selecciona la cuenta liquidadora (6) y la cuenta de utilidad (3) antes de proceder.");
      return;
    }

    const confirmacion = window.confirm(
      "¿Estás seguro de ejecutar el Cierre de Ejercicio? Esto pondrá a cero todas las cuentas de Resultados (Ingresos, Costos y Gastos) y trasladará el saldo al Patrimonio."
    );
    if (!confirmacion) return;

    // Buscar cuentas de Resultados con saldo
    const ingresos = cuentas.filter(c => c.codigo.startsWith('5') && c.saldo !== 0);
    const costosGastos = cuentas.filter(c => c.codigo.startsWith('4') && c.saldo !== 0);

    if (ingresos.length === 0 && costosGastos.length === 0) {
      alert("No hay cuentas de resultados operativas con saldo para liquidar.");
      return;
    }

    const ctaPérdidasGanancias = cuentas.find(c => c.id === cuentaLiquidadora)!;
    const ctaPatrimonioUtilidad = cuentas.find(c => c.id === cuentaUtilidad)!;

    const detallesCierre: DetalleAsiento[] = [];
    let totalIngresos = 0;
    let totalGastos = 0;

    // 1. Reversar Ingresos (Naturaleza Acreedora -> Se cargan)
    ingresos.forEach(ing => {
      totalIngresos += ing.saldo;
      detallesCierre.push({
        id: uuidv4(), cuentaId: ing.id, codigoCuenta: ing.codigo, parcial: 0, 
        debe: Number(ing.saldo.toFixed(2)), haber: 0
      });
    });

    // 2. Reversar Costos y Gastos (Naturaleza Deudora -> Se abonan)
    costosGastos.forEach(gas => {
      totalGastos += gas.saldo;
      detallesCierre.push({
        id: uuidv4(), cuentaId: gas.id, codigoCuenta: gas.codigo, parcial: 0, 
        debe: 0, haber: Number(gas.saldo.toFixed(2))
      });
    });

    // 3. Cuadrar contra la Cuenta Liquidadora (Clase 6) y trasladar a Patrimonio (Clase 3)
    const utilidad = totalIngresos - totalGastos;
    
    // Si hay utilidad, el Patrimonio se abona. Si hay pérdida, el Patrimonio se carga.
    if (utilidad >= 0) {
      // Inyectamos la diferencia en la cuenta Liquidadora (Haber) para cuadrar la primera fase
      // y la movemos inmediatamente al Patrimonio.
      detallesCierre.push({
        id: uuidv4(), cuentaId: ctaPérdidasGanancias.id, codigoCuenta: ctaPérdidasGanancias.codigo, parcial: 0,
        debe: Number(totalGastos.toFixed(2)), haber: Number(totalIngresos.toFixed(2))
      });

      // El saldo neto que queda en la liquidadora se pasa al Patrimonio
      detallesCierre.push({
        id: uuidv4(), cuentaId: ctaPatrimonioUtilidad.id, codigoCuenta: ctaPatrimonioUtilidad.codigo, parcial: 0,
        debe: 0, haber: Number(utilidad.toFixed(2))
      });
    } else {
      const perdida = Math.abs(utilidad);
      detallesCierre.push({
        id: uuidv4(), cuentaId: ctaPérdidasGanancias.id, codigoCuenta: ctaPérdidasGanancias.codigo, parcial: 0,
        debe: Number(totalGastos.toFixed(2)), haber: Number(totalIngresos.toFixed(2))
      });
      detallesCierre.push({
        id: uuidv4(), cuentaId: ctaPatrimonioUtilidad.id, codigoCuenta: ctaPatrimonioUtilidad.codigo, parcial: 0,
        debe: Number(perdida.toFixed(2)), haber: 0
      });
    }

    agregarAsiento({
      fecha: periodoFin,
      concepto: "Partida de Cierre de Ejercicio y traslado de Utilidad/Pérdida",
      detalles: detallesCierre
    });

    setEstadoPeriodo("Cerrado");
    alert(`Cierre contable ejecutado. Utilidad neta registrada: $${utilidad.toFixed(2)}`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 font-sans text-zinc-900 pb-12">
      <div className="border-b border-zinc-200 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configuración y Cierre</h1>
          <p className="text-sm text-zinc-500 mt-1">Parámetros fiscales y ejecución de cierre contable.</p>
        </div>
        <button 
          onClick={handleGuardar}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-300 text-black text-sm rounded-sm hover:bg-zinc-100 transition-colors"
        >
          <Save size={14} /> Guardar Parámetros
        </button>
      </div>

      {guardado && (
        <div className="p-3 bg-zinc-900 text-white text-sm font-medium rounded-sm">
          Parámetros actualizados correctamente.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <div className="space-y-8">
          <section className="bg-white border border-zinc-200 p-6">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-2 mb-4">Tasas e Impuestos</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Tasa de IVA (%)</label>
                <input type="number" step="0.1" value={iva} onChange={(e) => setIva(Number(e.target.value))} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none rounded-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Pago a Cuenta (%)</label>
                <input type="number" step="0.01" value={retencion} onChange={(e) => setRetencion(Number(e.target.value))} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none rounded-sm" />
              </div>
            </div>
          </section>

          <section className="bg-white border border-zinc-200 p-6">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-2 mb-4">Periodo Operativo</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Inicio</label>
                  <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none rounded-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Cierre Previsto</label>
                  <input type="date" value={periodoFin} onChange={(e) => setPeriodoFin(e.target.value)} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none rounded-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Estado del Sistema</label>
                <div className={`p-2 text-sm border rounded-sm font-medium ${estadoPeriodo === 'Abierto' ? 'border-green-300 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-700'}`}>
                  {estadoPeriodo === 'Abierto' ? 'Abierto (Se permiten nuevos asientos)' : 'Cerrado (Periodo Liquidado)'}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-zinc-50 border border-zinc-200 p-6 h-fit">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-200 pb-2 mb-6">Enlaces de Integración</h2>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-black uppercase tracking-widest">Cuentas de IVA Base</h3>
                <div>
                  <label className="block text-xs text-zinc-600 mb-1">Débito Fiscal (2108)</label>
                  <select value={cuentaIvaDebito} onChange={(e) => setCuentaIvaDebito(e.target.value)} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm">
                    <option value="">Seleccionar...</option>
                    {cuentas.filter(c => c.tipo === 'Pasivo').map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-600 mb-1">Crédito Fiscal (1109)</label>
                  <select value={cuentaIvaCredito} onChange={(e) => setCuentaIvaCredito(e.target.value)} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm">
                    <option value="">Seleccionar...</option>
                    {cuentas.filter(c => c.tipo === 'Activo').map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-zinc-200">
                <h3 className="text-[10px] font-bold text-black uppercase tracking-widest">Cuentas de Liquidación</h3>
                <div>
                  <label className="block text-xs text-zinc-600 mb-1">Cuenta Liquidadora (Clase 6)</label>
                  <select value={cuentaLiquidadora} onChange={(e) => setCuentaLiquidadora(e.target.value)} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm">
                    <option value="">Seleccionar...</option>
                    {cuentas.filter(c => c.tipo === 'Cierre' || c.codigo.startsWith('6')).map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-600 mb-1">Utilidad/Déficit (Patrimonio Clase 3)</label>
                  <select value={cuentaUtilidad} onChange={(e) => setCuentaUtilidad(e.target.value)} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm">
                    <option value="">Seleccionar...</option>
                    {cuentas.filter(c => c.tipo === 'Patrimonio').map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* PANEL DE EJECUCIÓN DE CIERRE */}
          <section className="bg-black border border-black p-6 rounded-sm shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <LockKeyhole size={18} className="text-white" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Cierre de Ejercicio</h2>
            </div>
            <p className="text-xs text-zinc-400 mb-6">Esta acción es irreversible. Liquidará automáticamente las cuentas de Resultados y trasladará los saldos a Patrimonio.</p>
            
            <button 
              onClick={ejecutarCierreContable}
              disabled={estadoPeriodo === 'Cerrado'}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black font-bold uppercase tracking-wider text-xs rounded-sm hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Ejecutar Cierre Contable Definitivo
            </button>
          </section>
        </div>

      </div>
    </div>
  );
}