"use client";

import { useAccountingStore } from "@/lib/store/accountingStore";

export default function BalanceComprobacionPage() {
  const { cuentas } = useAccountingStore();
  
  // Filtramos solo las cuentas que tienen algún saldo
  const cuentasActivas = cuentas.filter(c => c.saldo !== 0);

  // Cálculos de sumas iguales
  const totalDeudor = cuentasActivas
    .filter(c => c.naturaleza === 'Deudora')
    .reduce((sum, c) => sum + c.saldo, 0);
    
  const totalAcreedor = cuentasActivas
    .filter(c => c.naturaleza === 'Acreedora')
    .reduce((sum, c) => sum + c.saldo, 0);

  const cuadra = Number(totalDeudor.toFixed(2)) === Number(totalAcreedor.toFixed(2));

  return (
    <div className="max-w-5xl mx-auto space-y-8 font-sans text-zinc-900 pb-12">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Balanza de Comprobación</h1>
        <p className="text-sm text-zinc-500 mt-1">Verificación de la partida doble en saldos de mayor.</p>
      </div>

      <div className="bg-white border border-zinc-200">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr>
              <th colSpan={2} className="p-3 border-b border-zinc-200 bg-zinc-50"></th>
              <th colSpan={2} className="p-3 border-b border-zinc-200 bg-zinc-100 text-center font-bold text-xs uppercase tracking-wider text-black">
                Saldos Finales
              </th>
            </tr>
            <tr className="border-b-2 border-black text-xs uppercase text-zinc-500 tracking-wider">
              <th className="p-3 font-medium">Código</th>
              <th className="p-3 font-medium">Nombre de la Cuenta</th>
              <th className="p-3 text-right font-medium bg-zinc-50/50">Deudor</th>
              <th className="p-3 text-right font-medium bg-zinc-50/50">Acreedor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {cuentasActivas.sort((a, b) => a.codigo.localeCompare(b.codigo)).map(c => (
              <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                <td className="p-3 font-medium">{c.codigo}</td>
                <td className="p-3">{c.nombre}</td>
                <td className="p-3 text-right font-medium">
                  {c.naturaleza === 'Deudora' ? `$${c.saldo.toFixed(2)}` : ''}
                </td>
                <td className="p-3 text-right font-medium">
                  {c.naturaleza === 'Acreedora' ? `$${c.saldo.toFixed(2)}` : ''}
                </td>
              </tr>
            ))}
            {cuentasActivas.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-zinc-400 text-xs uppercase tracking-widest">
                  No hay cuentas con saldo.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black font-bold">
              <td colSpan={2} className="p-4 text-right text-xs uppercase tracking-wider text-zinc-500">
                Sumas Iguales
              </td>
              <td className={`p-4 text-right ${cuadra ? 'text-black' : 'text-red-600'}`}>
                ${totalDeudor.toFixed(2)}
              </td>
              <td className={`p-4 text-right ${cuadra ? 'text-black' : 'text-red-600'}`}>
                ${totalAcreedor.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
        
        {!cuadra && (
          <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold uppercase tracking-wider text-center border-t border-red-200">
            Advertencia: Los saldos no cuadran. Revise las naturalezas del catálogo.
          </div>
        )}
      </div>
    </div>
  );
}