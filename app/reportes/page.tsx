export default function ReportesPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-12 font-sans text-zinc-900 pb-12">
      <p
        role="status"
        className="border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600"
      >
        Diseño del módulo conservado. Su integración está pendiente; esta
        pantalla no calcula ni registra operaciones.
      </p>

      <section>
        <header className="border-b border-zinc-200 pb-4 mb-6">
          <h2 className="text-xl font-semibold">Estado de Resultados</h2>
          <p className="text-sm text-zinc-500">Del período contable actual.</p>
        </header>

        <div className="bg-white border border-zinc-200 p-8 text-sm">
          <h3 className="font-semibold mb-4 border-b border-zinc-100 pb-2">
            INGRESOS DE OPERACIÓN (5)
          </h3>
          <div className="space-y-2 mb-6 pl-4"></div>

          <h3 className="font-semibold mb-4 border-b border-zinc-100 pb-2">
            COSTOS Y GASTOS DE OPERACIÓN (4)
          </h3>
          <div className="space-y-2 mb-8 pl-4"></div>

          <div className="flex justify-between font-bold text-base border-t-2 border-black pt-4">
            <span>RESULTADO DEL EJERCICIO</span>
            <span>$—</span>
          </div>
        </div>
      </section>

      <section>
        <header className="border-b border-zinc-200 pb-4 mb-6">
          <h2 className="text-xl font-semibold">
            Estado de Situación Financiera
          </h2>
          <p className="text-sm text-zinc-500">Al cierre del período actual.</p>
        </header>

        <div className="grid grid-cols-2 gap-8 bg-white border border-zinc-200 p-8 text-sm">
          <div>
            <h3 className="font-semibold mb-4 border-b border-zinc-100 pb-2">
              ACTIVO (1)
            </h3>
            <div className="space-y-2 pl-4"></div>
          </div>

          <div>
            <h3 className="font-semibold mb-4 border-b border-zinc-100 pb-2">
              PASIVO (2)
            </h3>
            <div className="space-y-2 mb-8 pl-4"></div>

            <h3 className="font-semibold mb-4 border-b border-zinc-100 pb-2">
              PATRIMONIO (3)
            </h3>
            <div className="space-y-2 pl-4">
              <div className="flex justify-between text-zinc-900 font-medium pt-2">
                <span>Resultado del Ejercicio</span>
                <span>$—</span>
              </div>
            </div>
          </div>

          <div className="col-span-2 flex justify-between font-bold text-base border-t-2 border-black pt-4 mt-4">
            <div className="w-1/2 pr-4 flex justify-between">
              <span>TOTAL ACTIVO</span>
              <span>$—</span>
            </div>
            <div className="w-1/2 pl-4 flex justify-between border-l border-zinc-200">
              <span>TOTAL PASIVO Y PATRIMONIO</span>
              <span>$—</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
