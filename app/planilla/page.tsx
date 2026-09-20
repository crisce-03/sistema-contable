import { Calculator, Save } from "lucide-react";

export default function PlanillaPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 font-sans text-zinc-900 pb-12">
      <p
        role="status"
        className="border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600"
      >
        Diseño del módulo conservado. Su integración está pendiente; esta
        pantalla no calcula ni registra operaciones.
      </p>

      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Cálculo de Planilla
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Automatización de retenciones y carga patronal.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-zinc-200 p-6 space-y-4">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-2">
              Datos del Empleado
            </h2>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Fecha de Planilla
              </label>
              <input
                type="date"
                className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Nombre Completo
              </label>
              <input
                type="text"
                placeholder="Ej. Ana Pérez"
                className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Salario Base ($)
              </label>
              <input
                type="number"
                placeholder="0.00"
                className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Retención ISR ($) - Manual
              </label>
              <input
                type="number"
                placeholder="0.00"
                className="w-full p-2 text-sm border border-zinc-300 focus:border-black outline-none bg-white rounded-sm"
                disabled
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="bg-zinc-50 border border-zinc-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Calculator size={18} className="text-zinc-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-black">
                Desglose Calculado
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 pb-1 mb-3">
                  Deducciones Empleado
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">ISSS</span>
                    <span className="font-medium">$—</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">AFP</span>
                    <span className="font-medium">$—</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">ISR</span>
                    <span className="font-medium">$—</span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-200">
                  <span className="text-xs font-bold uppercase">
                    A Recibir (Líquido)
                  </span>
                  <span className="text-lg font-bold text-black">$—</span>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 pb-1 mb-3">
                  Carga Patronal (Empresa)
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">ISSS</span>
                    <span className="font-medium">$—</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">AFP</span>
                    <span className="font-medium">$—</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">INSAFORP</span>
                    <span className="font-medium">$—</span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-200">
                  <span className="text-xs font-bold uppercase">
                    Costo Total Empresa
                  </span>
                  <span className="text-lg font-bold text-black">$—</span>
                </div>
              </div>
            </div>

            <button
              className="mt-8 w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white text-sm font-medium rounded-sm hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 transition-colors"
              disabled
            >
              <Save size={16} /> Procesar y Generar Partida Contable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
