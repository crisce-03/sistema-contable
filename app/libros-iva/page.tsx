import { FileText } from "lucide-react";

export default function LibrosIvaPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 font-sans text-zinc-900 pb-12">
      <p
        role="status"
        className="border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600"
      >
        Diseño del módulo conservado. Su integración está pendiente; esta
        pantalla no calcula ni registra operaciones.
      </p>

      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Registros Auxiliares Fiscales
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Control del Impuesto al Valor Agregado (Libros de Compras y Ventas).
        </p>
      </div>

      <div className="flex border-b border-zinc-200">
        <button
          className="px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors "
          disabled
        >
          Libro de Compras
        </button>
        <button
          className="px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors "
          disabled
        >
          Ventas a Contribuyentes
        </button>
        <button
          className="px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors "
          disabled
        >
          Ventas a Consumidor Final
        </button>
      </div>

      <div className="bg-white border border-zinc-200 overflow-x-auto">
        <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center gap-2">
          <FileText size={16} className="text-zinc-400" />
          <h2 className="text-sm font-semibold text-black">
            Libro de Compras y Ventas
          </h2>
        </div>

        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-300 text-zinc-500 uppercase tracking-wider">
              <th className="p-3 font-medium">Fecha</th>
              <th className="p-3 font-medium">No. Doc.</th>
              <th className="p-3 font-medium">NRC</th>
              <th className="p-3 font-medium">Proveedor / Cliente</th>
              <th className="p-3 text-right font-medium">Exentas</th>
              <th className="p-3 text-right font-medium">Gravadas</th>
              <th className="p-3 text-right font-medium">IVA Crédito/Débito</th>
              <th className="p-3 text-right font-medium">
                Retención/Percepción
              </th>
              <th className="p-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            <tr>
              <td
                colSpan={12}
                className="p-8 text-center text-xs text-zinc-400"
              >
                Integración pendiente. Sin operaciones disponibles.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
