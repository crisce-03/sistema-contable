"use client";

import { useState } from "react";
import { Plus, Calculator, Save, Car } from "lucide-react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { DetalleAsiento } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

interface ActivoFijo {
  id: string;
  descripcion: string;
  categoria: 'Edificaciones' | 'Mobiliario' | 'Vehículos' | 'Maquinaria';
  fechaAdquisicion: string;
  valorAdquisicion: number;
  valorResidual: number;
  vidaUtilAnios: number;
}

export default function ActivosFijosPage() {
  const { cuentas, agregarAsiento } = useAccountingStore();
  
  const [activos, setActivos] = useState<ActivoFijo[]>([
    { id: '1', descripcion: 'Pick Up Toyota Tacoma', categoria: 'Vehículos', fechaAdquisicion: '2026-07-21', valorAdquisicion: 12800, valorResidual: 1280, vidaUtilAnios: 5 },
    { id: '2', descripcion: 'Computadora SIMAN', categoria: 'Mobiliario', fechaAdquisicion: '2026-07-21', valorAdquisicion: 835.90, valorResidual: 0, vidaUtilAnios: 2 },
  ]);

  // Formulario de nuevo activo
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState<ActivoFijo['categoria']>('Mobiliario');
  const [fechaAdquisicion, setFechaAdquisicion] = useState(new Date().toISOString().split("T")[0]);
  const [valorAdquisicion, setValorAdquisicion] = useState("");
  const [valorResidual, setValorResidual] = useState("");
  const [vidaUtilAnios, setVidaUtilAnios] = useState("");

  const handleRegistrarActivo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descripcion || !valorAdquisicion || !vidaUtilAnios) return;

    setActivos([...activos, {
      id: uuidv4(),
      descripcion,
      categoria,
      fechaAdquisicion,
      valorAdquisicion: parseFloat(valorAdquisicion),
      valorResidual: parseFloat(valorResidual) || 0,
      vidaUtilAnios: parseFloat(vidaUtilAnios)
    }]);

    setDescripcion(""); setValorAdquisicion(""); setValorResidual(""); setVidaUtilAnios("");
  };

  const procesarDepreciacionMensual = (activo: ActivoFijo) => {
    // Cálculo de Línea Recta: (Costo - Valor Residual) / Vida Útil
    const depreciacionAnual = (activo.valorAdquisicion - activo.valorResidual) / activo.vidaUtilAnios;
    const depreciacionMensual = depreciacionAnual / 12;

    // Asignación de cuentas según el Catálogo Comercial
    let ctaGastoCodigo = '410205'; // Cuenta general de Gastos por Depreciación
    let ctaAcumuladaCodigo = '120108'; // Depreciación Acumulada (CR)

    if (activo.categoria === 'Edificaciones') { ctaGastoCodigo = '41020501'; ctaAcumuladaCodigo = '12010801'; }
    if (activo.categoria === 'Mobiliario') { ctaGastoCodigo = '41020505'; ctaAcumuladaCodigo = '1201080201'; }
    if (activo.categoria === 'Vehículos') { ctaGastoCodigo = '41020507'; ctaAcumuladaCodigo = '12010804'; }

    const ctaGasto = cuentas.find(c => c.codigo === ctaGastoCodigo) || { id: uuidv4(), codigo: ctaGastoCodigo };
    const ctaAcumulada = cuentas.find(c => c.codigo === ctaAcumuladaCodigo) || { id: uuidv4(), codigo: ctaAcumuladaCodigo };

    const detalles: DetalleAsiento[] = [
      { id: uuidv4(), cuentaId: ctaGasto.id, codigoCuenta: ctaGasto.codigo, parcial: 0, debe: Number(depreciacionMensual.toFixed(2)), haber: 0 },
      { id: uuidv4(), cuentaId: ctaAcumulada.id, codigoCuenta: ctaAcumulada.codigo, parcial: 0, debe: 0, haber: Number(depreciacionMensual.toFixed(2)) },
    ];

    const exito = agregarAsiento({
      fecha: new Date().toISOString().split("T")[0],
      concepto: `Depreciación mensual (Línea Recta) - ${activo.descripcion}`,
      detalles
    });

    if(exito) alert(`Partida de depreciación por $${depreciacionMensual.toFixed(2)} registrada exitosamente.`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 font-sans text-zinc-900 pb-12">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Control de Activos Fijos</h1>
        <p className="text-sm text-zinc-500 mt-1">Gestión de Propiedad, Planta y Equipo y cálculo de Depreciación Lineal.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Formulario de Alta de Activo */}
        <div className="lg:col-span-4">
          <form onSubmit={handleRegistrarActivo} className="bg-zinc-50 border border-zinc-200 p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 border-b border-zinc-200 pb-2">Alta de Nuevo Activo</h2>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Descripción del Bien</label>
              <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Escritorio de madera" className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm" required/>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Clasificación</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value as ActivoFijo['categoria'])} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm">
                <option value="Mobiliario">Mobiliario y Equipo (Oficina)</option>
                <option value="Vehículos">Equipo de Transporte</option>
                <option value="Edificaciones">Edificaciones</option>
                <option value="Maquinaria">Maquinaria Industrial</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Fecha Adquisición</label>
              <input type="date" value={fechaAdquisicion} onChange={(e) => setFechaAdquisicion(e.target.value)} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm" required/>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Costo Adq. ($)</label>
                <input type="number" step="0.01" value={valorAdquisicion} onChange={(e) => setValorAdquisicion(e.target.value)} placeholder="0.00" className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm" required/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Valor Residual</label>
                <input type="number" step="0.01" value={valorResidual} onChange={(e) => setValorResidual(e.target.value)} placeholder="0.00" className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"/>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Vida Útil Estimada (Años)</label>
              <input type="number" value={vidaUtilAnios} onChange={(e) => setVidaUtilAnios(e.target.value)} placeholder="Ej. 5" className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm" required/>
            </div>

            <button type="submit" className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-sm hover:bg-zinc-800 transition-colors">
              <Plus size={14} /> Registrar Activo Fijo
            </button>
          </form>
        </div>

        {/* Cuadro de Control y Amortización */}
        <div className="lg:col-span-8">
          <div className="bg-white border border-zinc-200 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-black bg-zinc-50 text-zinc-500 uppercase tracking-wider">
                  <th className="p-3 font-medium">Descripción del Activo</th>
                  <th className="p-3 font-medium">Categoría</th>
                  <th className="p-3 text-right font-medium">Base a Depreciar</th>
                  <th className="p-3 text-right font-medium text-black">Depr. Mensual</th>
                  <th className="p-3 text-center font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {activos.map((activo) => {
                  const baseDepreciable = activo.valorAdquisicion - activo.valorResidual;
                  const cuotaMensual = (baseDepreciable / activo.vidaUtilAnios) / 12;

                  return (
                    <tr key={activo.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="p-3">
                        <span className="font-semibold text-black block">{activo.descripcion}</span>
                        <span className="text-[10px] text-zinc-500">Adq: {activo.fechaAdquisicion}</span>
                      </td>
                      <td className="p-3 text-zinc-500">{activo.categoria}</td>
                      <td className="p-3 text-right">
                        <span className="block">${baseDepreciable.toFixed(2)}</span>
                        <span className="text-[10px] text-zinc-400">({activo.vidaUtilAnios} años)</span>
                      </td>
                      <td className="p-3 text-right font-bold text-black">${cuotaMensual.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => procesarDepreciacionMensual(activo)}
                          className="flex items-center gap-1 mx-auto px-2 py-1 bg-zinc-100 text-black hover:bg-zinc-200 border border-zinc-200 rounded-sm font-medium transition-colors"
                          title="Generar Partida Contable de este Mes"
                        >
                          <Save size={12} /> Partida Mensual
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {activos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-zinc-400 uppercase tracking-widest">Sin activos registrados</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}