import { Plus } from "lucide-react";

export default function ActivosFijosPage() {
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
          Control de Activos Fijos
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Gestión de Propiedad, Planta y Equipo y cálculo de Depreciación
          Lineal.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <form className="bg-zinc-50 border border-zinc-200 p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 border-b border-zinc-200 pb-2">
              Alta de Nuevo Activo
            </h2>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Descripción del Bien
              </label>
              <input
                type="text"
                placeholder="Ej. Escritorio de madera"
                className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
                required
                disabled
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Clasificación
              </label>
              <select
                className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
                disabled
              >
                <option>Mobiliario y Equipo (Oficina)</option>
                <option>Equipo de Transporte</option>
                <option>Edificaciones</option>
                <option>Maquinaria Industrial</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Fecha Adquisición
              </label>
              <input
                type="date"
                className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
                required
                disabled
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Costo Adq. ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
                  required
                  disabled
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Valor Residual
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
                  disabled
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Vida Útil Estimada (Años)
              </label>
              <input
                type="number"
                placeholder="Ej. 5"
                className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
                required
                disabled
              />
            </div>

            <button
              type="submit"
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-sm hover:bg-zinc-800 transition-colors"
              disabled
            >
              <Plus size={14} /> Registrar Activo Fijo
            </button>
          </form>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white border border-zinc-200 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-black bg-zinc-50 text-zinc-500 uppercase tracking-wider">
                  <th className="p-3 font-medium">Descripción del Activo</th>
                  <th className="p-3 font-medium">Categoría</th>
                  <th className="p-3 text-right font-medium">
                    Base a Depreciar
                  </th>
                  <th className="p-3 text-right font-medium text-black">
                    Depr. Mensual
                  </th>
                  <th className="p-3 text-center font-medium">Acción</th>
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
      </div>
    </div>
  );
}
