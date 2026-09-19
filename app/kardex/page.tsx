import { Plus } from "lucide-react";

export default function KardexInteractivo() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans text-zinc-900 pb-12">
      <p
        role="status"
        className="border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600"
      >
        Diseño del módulo conservado. Su integración está pendiente; esta
        pantalla no calcula ni registra operaciones.
      </p>

      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Tarjeta Kardex Automatizada
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Control de Inventario mediante el método de Costo Promedio.
        </p>
      </div>

      <div className="flex gap-4 text-sm font-medium">
        <div className="px-3 py-1.5 border border-zinc-200 bg-white rounded-sm shadow-sm">
          Producto: Sin seleccionar
        </div>
        <div className="px-3 py-1.5 border border-zinc-200 bg-white rounded-sm shadow-sm">
          Código: —
        </div>
        <div className="px-3 py-1.5 border border-zinc-200 bg-white rounded-sm shadow-sm">
          Método: Costo Promedio
        </div>
      </div>

      <form className="bg-zinc-50 border border-zinc-200 p-4 flex items-end gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            Operación
          </label>
          <select
            className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
            disabled
          >
            <option>Entrada (Compra)</option>
            <option>Salida (Venta)</option>
          </select>
        </div>
        <div className="w-32 space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            Fecha
          </label>
          <input
            type="date"
            className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
            required
            disabled
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            Concepto
          </label>
          <input
            type="text"
            placeholder="Ej. Compra s/CCF 1654"
            className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
            required
            disabled
          />
        </div>
        <div className="w-24 space-y-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            Cantidad
          </label>
          <input
            type="number"
            min="1"
            className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm text-right"
            required
            disabled
          />
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-black text-white text-sm font-medium rounded-sm hover:bg-zinc-800 transition-colors flex items-center gap-2"
          disabled
        >
          <Plus size={14} /> Registrar
        </button>
      </form>

      <div className="overflow-x-auto border border-zinc-200 bg-white">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="border-b border-zinc-200 p-2 font-medium bg-white"
              >
                Fecha
              </th>
              <th
                rowSpan={2}
                className="border-b border-zinc-200 p-2 font-medium bg-white border-r"
              >
                Concepto
              </th>
              <th
                colSpan={3}
                className="border-b border-zinc-200 p-2 font-bold text-center bg-zinc-100 border-r text-black tracking-wider"
              >
                ENTRADAS
              </th>
              <th
                colSpan={3}
                className="border-b border-zinc-200 p-2 font-bold text-center bg-zinc-50 border-r text-black tracking-wider"
              >
                SALIDAS
              </th>
              <th
                colSpan={3}
                className="border-b border-zinc-200 p-2 font-bold text-center bg-black text-white tracking-wider"
              >
                EXISTENCIAS (PROMEDIO)
              </th>
            </tr>
            <tr className="bg-zinc-50 border-b-2 border-black">
              <th className="p-2 font-medium text-center text-zinc-500">
                Cant.
              </th>
              <th className="p-2 font-medium text-center text-zinc-500">
                C.U.
              </th>
              <th className="p-2 font-medium text-center text-zinc-500 border-r">
                Total
              </th>
              <th className="p-2 font-medium text-center text-zinc-500">
                Cant.
              </th>
              <th className="p-2 font-medium text-center text-zinc-500">
                C.U.
              </th>
              <th className="p-2 font-medium text-center text-zinc-500 border-r">
                Total
              </th>
              <th className="p-2 font-medium text-center text-zinc-500 bg-zinc-100">
                Cant.
              </th>
              <th className="p-2 font-medium text-center text-zinc-500 bg-zinc-100">
                C.U.
              </th>
              <th className="p-2 font-medium text-center text-zinc-500 bg-zinc-100">
                Total
              </th>
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
