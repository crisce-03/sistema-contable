"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { Cuenta } from "@/lib/types";

export default function CatalogoPage() {
  const { cuentas, agregarCuenta } = useAccountingStore();
  
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<Cuenta['tipo']>('Activo');
  const [naturaleza, setNaturaleza] = useState<Cuenta['naturaleza']>('Deudora');

  const handleAgregar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo || !nombre) return;
    agregarCuenta({ codigo, nombre, tipo, naturaleza });
    setCodigo(""); setNombre("");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 font-sans text-zinc-900">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo de Cuentas</h1>
        <p className="text-sm text-zinc-500 mt-1">Estructura primaria y de detalle contable.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Formulario lateral */}
        <div className="lg:col-span-1">
          <form onSubmit={handleAgregar} className="space-y-4 bg-zinc-50 p-4 border border-zinc-200">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Nueva Cuenta</h2>
            
            <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código (Ej. 1101)" className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm" required />
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la cuenta" className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm" required />
            
            <select value={tipo} onChange={(e) => setTipo(e.target.value as Cuenta['tipo'])} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm">
              <option value="Activo">Activo (1)</option>
              <option value="Pasivo">Pasivo (2)</option>
              <option value="Patrimonio">Patrimonio (3)</option>
              <option value="Resultado Deudora">R. Deudora (4)</option>
              <option value="Resultado Acreedora">R. Acreedora (5)</option>
              <option value="Cierre">Cierre (6)</option>
            </select>

            <select value={naturaleza} onChange={(e) => setNaturaleza(e.target.value as Cuenta['naturaleza'])} className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm">
              <option value="Deudora">Deudora</option>
              <option value="Acreedora">Acreedora</option>
            </select>

            <button type="submit" className="w-full flex items-center justify-center gap-2 py-2 bg-black text-white text-sm rounded-sm hover:bg-zinc-800 transition-colors">
              <Plus size={14} /> Agregar
            </button>
          </form>
        </div>

        {/* Tabla principal */}
        <div className="lg:col-span-3">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-zinc-900 text-xs uppercase text-zinc-500 tracking-wider">
                <th className="py-3 font-medium">Código</th>
                <th className="py-3 font-medium">Nombre</th>
                <th className="py-3 font-medium">Rubro</th>
                <th className="py-3 font-medium">Naturaleza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {cuentas.sort((a, b) => a.codigo.localeCompare(b.codigo)).map((cuenta) => (
                <tr key={cuenta.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="py-3 font-medium">{cuenta.codigo}</td>
                  <td className="py-3">{cuenta.nombre}</td>
                  <td className="py-3 text-zinc-500">{cuenta.tipo}</td>
                  <td className="py-3 text-zinc-500">{cuenta.naturaleza}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}