"use client";

import { useAccountingStore } from "@/lib/store/accountingStore";
import { ArrowRight, Calculator } from "lucide-react";

export default function LiquidacionIvaPage() {
  const { cuentas } = useAccountingStore();

  // Buscar las cuentas de IVA basándonos en el catálogo estándar
  // 110901: Crédito Fiscal IVA (Deudora)
  // 21080102: IVA Débito Fiscal (Acreedora)
  const cuentaCredito = cuentas.find(c => c.codigo.startsWith('1109')) || { saldo: 0, nombre: 'Crédito Fiscal - IVA' };
  const cuentaDebito = cuentas.find(c => c.codigo.startsWith('2108')) || { saldo: 0, nombre: 'IVA - Débito Fiscal' };

  const creditoMonto = cuentaCredito.saldo;
  const debitoMonto = cuentaDebito.saldo;

  const esRemanente = creditoMonto > debitoMonto;
  const diferencia = Math.abs(creditoMonto - debitoMonto);

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans text-zinc-900">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Liquidación de IVA</h1>
        <p className="text-sm text-zinc-500 mt-1">Cálculo mensual de confrontación fiscal.</p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        
        {/* Panel de Saldos Actuales */}
        <div className="bg-white border border-zinc-200 p-6 space-y-6">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-2">Saldos de Mayor</h2>
          
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">IVA Crédito Fiscal (Compras)</p>
              <p className="text-xs text-zinc-500">Naturaleza Deudora</p>
            </div>
            <span className="text-lg font-medium">${creditoMonto.toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">IVA Débito Fiscal (Ventas)</p>
              <p className="text-xs text-zinc-500">Naturaleza Acreedora</p>
            </div>
            <span className="text-lg font-medium">${debitoMonto.toFixed(2)}</span>
          </div>

          <div className="pt-4 border-t-2 border-black flex justify-between items-center">
            <span className="text-sm font-bold uppercase">{esRemanente ? 'Remanente a favor' : 'Impuesto a Pagar'}</span>
            <span className="text-xl font-bold">${diferencia.toFixed(2)}</span>
          </div>
        </div>

        {/* Propuesta de Asiento Contable */}
        <div className="bg-zinc-50 border border-zinc-200 p-6">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-200 pb-2 mb-4">Partida de Liquidación Sugerida</h2>
          
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-300 text-xs uppercase text-zinc-500">
                <th className="py-2 font-medium">Cuenta</th>
                <th className="py-2 text-right font-medium">Debe</th>
                <th className="py-2 text-right font-medium">Haber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {/* Para liquidar, el Débito (Acreedor) se carga, y el Crédito (Deudor) se abona */}
              <tr>
                <td className="py-2">{cuentaDebito.nombre}</td>
                <td className="py-2 text-right font-medium">${debitoMonto.toFixed(2)}</td>
                <td className="py-2 text-right"></td>
              </tr>
              
              {esRemanente ? (
                <tr>
                  <td className="py-2">Remanente IVA - Crédito Fiscal</td>
                  <td className="py-2 text-right font-medium">${diferencia.toFixed(2)}</td>
                  <td className="py-2 text-right"></td>
                </tr>
              ) : (
                <tr>
                  <td className="py-2 pl-4">Acreedores Varios (IVA por Pagar)</td>
                  <td className="py-2 text-right"></td>
                  <td className="py-2 text-right font-medium">${diferencia.toFixed(2)}</td>
                </tr>
              )}

              <tr>
                <td className="py-2 pl-4">{cuentaCredito.nombre}</td>
                <td className="py-2 text-right"></td>
                <td className="py-2 text-right font-medium">${creditoMonto.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <button className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-sm hover:bg-zinc-800 transition-colors">
            <Calculator size={14} /> Registrar Partida de Liquidación
          </button>
        </div>
      </div>
    </div>
  );
}