"use client";

import { useState } from "react";
import { Calculator, Save, User } from "lucide-react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { DetalleAsiento } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

export default function PlanillaPage() {
  const { cuentas, agregarAsiento } = useAccountingStore();
  
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [nombre, setNombre] = useState("");
  const [salarioBase, setSalarioBase] = useState("");
  const [isrManual, setIsrManual] = useState(""); // El ISR en El Salvador usa tablas complejas, lo dejamos manual para el mock

  // ==========================================
  // MAGIA UX: MOTOR DE CÁLCULO DE NÓMINA (El Salvador)
  // ==========================================
  const salario = parseFloat(salarioBase) || 0;
  const isr = parseFloat(isrManual) || 0;

  // Techo salarial para ISSS es $1,000.00
  const salarioISSS = salario > 1000 ? 1000 : salario;

  // Deducciones Laborales (Lo que paga el empleado)
  const isssLaboral = salarioISSS * 0.03;      // 3%
  const afpLaboral = salario * 0.0725;         // 7.25%
  const totalDeducciones = isssLaboral + afpLaboral + isr;
  const salarioLiquido = salario - totalDeducciones;

  // Aportes Patronales (Lo que paga la empresa como gasto extra)
  const isssPatronal = salarioISSS * 0.075;    // 7.5%
  const afpPatronal = salario * 0.0775;        // 7.75%
  const insaforp = salarioISSS * 0.01;         // 1% (Asumiendo plantilla > 10 empleados)
  const totalCargaPatronal = isssPatronal + afpPatronal + insaforp;

  const registrarAsientoPlanilla = () => {
    if (salario <= 0 || !nombre) return;

    // Buscamos las cuentas del catálogo comercial base
    const ctaGastoSalario = cuentas.find(c => c.codigo === '41020101') || { id: uuidv4(), codigo: '41020101' };
    const ctaGastoISSS = cuentas.find(c => c.codigo === '41020108') || { id: uuidv4(), codigo: '41020108' };
    const ctaGastoAFP = cuentas.find(c => c.codigo === '41020109') || { id: uuidv4(), codigo: '41020109' };
    const ctaGastoInsaforp = cuentas.find(c => c.codigo === '41020110') || { id: uuidv4(), codigo: '41020110' };

    const ctaRetIsss = cuentas.find(c => c.codigo === '210401') || { id: uuidv4(), codigo: '210401' };
    const ctaRetAfp = cuentas.find(c => c.codigo === '210402') || { id: uuidv4(), codigo: '210402' };
    const ctaRetIsr = cuentas.find(c => c.codigo === '210403') || { id: uuidv4(), codigo: '210403' };
    const ctaBancos = cuentas.find(c => c.codigo === '1101020101') || { id: uuidv4(), codigo: '1101020101' };

    const detalles: DetalleAsiento[] = [
      // GASTOS (Debe)
      { id: uuidv4(), cuentaId: ctaGastoSalario.id, codigoCuenta: ctaGastoSalario.codigo, parcial: 0, debe: salario, haber: 0 },
      { id: uuidv4(), cuentaId: ctaGastoISSS.id, codigoCuenta: ctaGastoISSS.codigo, parcial: 0, debe: Number(isssPatronal.toFixed(2)), haber: 0 },
      { id: uuidv4(), cuentaId: ctaGastoAFP.id, codigoCuenta: ctaGastoAFP.codigo, parcial: 0, debe: Number(afpPatronal.toFixed(2)), haber: 0 },
      { id: uuidv4(), cuentaId: ctaGastoInsaforp.id, codigoCuenta: ctaGastoInsaforp.codigo, parcial: 0, debe: Number(insaforp.toFixed(2)), haber: 0 },
      
      // PASIVOS Y SALIDAS (Haber)
      // Nota: Se suma la retención laboral + el aporte patronal en la misma cuenta por pagar institucional
      { id: uuidv4(), cuentaId: ctaRetIsss.id, codigoCuenta: ctaRetIsss.codigo, parcial: 0, debe: 0, haber: Number((isssLaboral + isssPatronal).toFixed(2)) },
      { id: uuidv4(), cuentaId: ctaRetAfp.id, codigoCuenta: ctaRetAfp.codigo, parcial: 0, debe: 0, haber: Number((afpLaboral + afpPatronal).toFixed(2)) },
      { id: uuidv4(), cuentaId: ctaRetIsr.id, codigoCuenta: ctaRetIsr.codigo, parcial: 0, debe: 0, haber: Number(isr.toFixed(2)) },
      { id: uuidv4(), cuentaId: ctaBancos.id, codigoCuenta: ctaBancos.codigo, parcial: 0, debe: 0, haber: Number(salarioLiquido.toFixed(2)) },
    ];

    agregarAsiento({
      fecha,
      concepto: `Provisión y pago de planilla - Empleado: ${nombre}`,
      detalles
    });

    setNombre(""); setSalarioBase(""); setIsrManual("");
    alert("Asiento de planilla registrado y mayorizado con éxito.");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 font-sans text-zinc-900 pb-12">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Cálculo de Planilla</h1>
        <p className="text-sm text-zinc-500 mt-1">Automatización de retenciones y carga patronal.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Formulario de Entrada */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-zinc-200 p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-2">Datos del Empleado</h2>
            
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Fecha de Planilla</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Nombre Completo</label>
              <input type="text" placeholder="Ej. Ana Pérez" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Salario Base ($)</label>
              <input type="number" placeholder="0.00" value={salarioBase} onChange={(e) => setSalarioBase(e.target.value)} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Retención ISR ($) - Manual</label>
              <input type="number" placeholder="0.00" value={isrManual} onChange={(e) => setIsrManual(e.target.value)} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm" />
            </div>
          </div>
        </div>

        {/* Tablero de Resultados (Cálculos automáticos) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-zinc-50 border border-zinc-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Calculator size={18} className="text-zinc-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-black">Desglose Calculado</h2>
            </div>

            <div className="grid grid-cols-2 gap-8">
              
              {/* Retenciones Laborales */}
              <div>
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 pb-1 mb-3">Deducciones Empleado</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-600">ISSS (3%)</span><span className="font-medium">${isssLaboral.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">AFP (7.25%)</span><span className="font-medium">${afpLaboral.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">ISR</span><span className="font-medium">${isr.toFixed(2)}</span></div>
                </div>
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-200">
                  <span className="text-xs font-bold uppercase">A Recibir (Líquido)</span>
                  <span className="text-lg font-bold text-black">${salarioLiquido.toFixed(2)}</span>
                </div>
              </div>

              {/* Aportes Patronales */}
              <div>
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 pb-1 mb-3">Carga Patronal (Empresa)</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-600">ISSS (7.5%)</span><span className="font-medium">${isssPatronal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">AFP (7.75%)</span><span className="font-medium">${afpPatronal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">INSAFORP (1%)</span><span className="font-medium">${insaforp.toFixed(2)}</span></div>
                </div>
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-200">
                  <span className="text-xs font-bold uppercase">Costo Total Empresa</span>
                  <span className="text-lg font-bold text-black">${(salario + totalCargaPatronal).toFixed(2)}</span>
                </div>
              </div>

            </div>

            <button 
              onClick={registrarAsientoPlanilla}
              disabled={salario <= 0 || !nombre}
              className="mt-8 w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white text-sm font-medium rounded-sm hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 transition-colors"
            >
              <Save size={16} /> Procesar y Generar Partida Contable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}