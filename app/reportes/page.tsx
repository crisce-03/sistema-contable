"use client";

import { useAccountingStore } from "@/lib/store/accountingStore";

export default function ReportesPage() {
  const { cuentas } = useAccountingStore();
  const activas = cuentas.filter(c => c.saldo !== 0);

  // ESTADO DE RESULTADOS
  const ingresos = activas.filter(c => c.codigo.startsWith('5'));
  const costosGastos = activas.filter(c => c.codigo.startsWith('4'));
  
  const totalIngresos = ingresos.reduce((s, c) => s + c.saldo, 0);
  const totalCostosGastos = costosGastos.reduce((s, c) => s + c.saldo, 0);
  const utilidad = totalIngresos - totalCostosGastos;

  // BALANCE GENERAL
  const activos = activas.filter(c => c.codigo.startsWith('1'));
  const pasivos = activas.filter(c => c.codigo.startsWith('2'));
  const patrimonio = activas.filter(c => c.codigo.startsWith('3'));

  const totalActivo = activos.reduce((s, c) => s + c.saldo, 0);
  const totalPasivo = pasivos.reduce((s, c) => s + c.saldo, 0);
  const totalPatrimonioBase = patrimonio.reduce((s, c) => s + c.saldo, 0);
  const totalPasivoPatrimonio = totalPasivo + totalPatrimonioBase + utilidad;

  return (
    <div className="max-w-5xl mx-auto space-y-12 font-sans text-zinc-900 pb-12">
      
      {/* ESTADO DE RESULTADOS */}
      <section>
        <header className="border-b border-zinc-200 pb-4 mb-6">
          <h2 className="text-xl font-semibold">Estado de Resultados</h2>
          <p className="text-sm text-zinc-500">Del período contable actual.</p>
        </header>

        <div className="bg-white border border-zinc-200 p-8 text-sm">
          <h3 className="font-semibold mb-4 border-b border-zinc-100 pb-2">INGRESOS DE OPERACIÓN (5)</h3>
          <div className="space-y-2 mb-6 pl-4">
            {ingresos.map(c => (
              <div key={c.id} className="flex justify-between">
                <span className="text-zinc-600">{c.nombre}</span>
                <span>${c.saldo.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <h3 className="font-semibold mb-4 border-b border-zinc-100 pb-2">COSTOS Y GASTOS DE OPERACIÓN (4)</h3>
          <div className="space-y-2 mb-8 pl-4">
            {costosGastos.map(c => (
              <div key={c.id} className="flex justify-between">
                <span className="text-zinc-600">{c.nombre}</span>
                <span>${c.saldo.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between font-bold text-base border-t-2 border-black pt-4">
            <span>{utilidad >= 0 ? 'UTILIDAD NETA' : 'PÉRDIDA NETA'}</span>
            <span>${Math.abs(utilidad).toFixed(2)}</span>
          </div>
        </div>
      </section>

      {/* BALANCE GENERAL */}
      <section>
        <header className="border-b border-zinc-200 pb-4 mb-6">
          <h2 className="text-xl font-semibold">Estado de Situación Financiera</h2>
          <p className="text-sm text-zinc-500">Al cierre del período actual.</p>
        </header>

        <div className="grid grid-cols-2 gap-8 bg-white border border-zinc-200 p-8 text-sm">
          
          {/* LADO IZQUIERDO: ACTIVOS */}
          <div>
            <h3 className="font-semibold mb-4 border-b border-zinc-100 pb-2">ACTIVO (1)</h3>
            <div className="space-y-2 pl-4">
              {activos.map(c => (
                <div key={c.id} className="flex justify-between">
                  <span className="text-zinc-600">{c.nombre}</span>
                  <span>${c.saldo.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* LADO DERECHO: PASIVO Y PATRIMONIO */}
          <div>
            <h3 className="font-semibold mb-4 border-b border-zinc-100 pb-2">PASIVO (2)</h3>
            <div className="space-y-2 mb-8 pl-4">
              {pasivos.map(c => (
                <div key={c.id} className="flex justify-between">
                  <span className="text-zinc-600">{c.nombre}</span>
                  <span>${c.saldo.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <h3 className="font-semibold mb-4 border-b border-zinc-100 pb-2">PATRIMONIO (3)</h3>
            <div className="space-y-2 pl-4">
              {patrimonio.map(c => (
                <div key={c.id} className="flex justify-between">
                  <span className="text-zinc-600">{c.nombre}</span>
                  <span>${c.saldo.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-zinc-900 font-medium pt-2">
                <span>Resultado del Ejercicio</span>
                <span>${utilidad.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* ECUACIÓN CONTABLE */}
          <div className="col-span-2 flex justify-between font-bold text-base border-t-2 border-black pt-4 mt-4">
            <div className="w-1/2 pr-4 flex justify-between">
              <span>TOTAL ACTIVO</span>
              <span>${totalActivo.toFixed(2)}</span>
            </div>
            <div className="w-1/2 pl-4 flex justify-between border-l border-zinc-200">
              <span>TOTAL PASIVO Y PATRIMONIO</span>
              <span>${totalPasivoPatrimonio.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}