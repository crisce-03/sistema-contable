"use client";

import { useAccountingStore } from "@/lib/store/accountingStore";

export default function MayorizacionPage() {
  const { cuentas, asientos } = useAccountingStore();

  const cuentasConMovimientos = cuentas.filter(cuenta => {
    return asientos.some(asiento => 
      asiento.detalles.some(detalle => detalle.codigoCuenta === cuenta.codigo)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 font-sans text-zinc-900 pb-12">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Libro Mayor</h1>
        <p className="text-sm text-zinc-500 mt-1">Mayorización automática de cargos y abonos en Cuentas T.</p>
      </div>

      {cuentasConMovimientos.length === 0 ? (
        <div className="border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500">
          No hay movimientos contables registrados para mayorizar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {cuentasConMovimientos.map((cuenta) => {
            const movimientosCuenta = asientos.flatMap(asiento => 
              asiento.detalles
                .filter(det => det.codigoCuenta === cuenta.codigo)
                .map(det => ({
                  fecha: asiento.fecha,
                  debe: det.debe,
                  haber: det.haber
                }))
            );

            const sumaDebe = movimientosCuenta.reduce((sum, mov) => sum + mov.debe, 0);
            const sumaHaber = movimientosCuenta.reduce((sum, mov) => sum + mov.haber, 0);

            return (
              <div key={cuenta.id} className="bg-white text-sm">
                {/* Encabezado de la Cuenta */}
                <div className="text-center font-semibold text-xs uppercase tracking-wider pb-2 border-b-2 border-black">
                  {cuenta.codigo} - {cuenta.nombre}
                </div>

                {/* Estructura de la Cuenta T */}
                <div className="flex border-b border-zinc-200">
                  {/* Lado Debe (Cargos) */}
                  <div className="w-1/2 border-r border-black min-h-30 flex flex-col">
                    <div className="text-center text-[10px] text-zinc-400 font-bold tracking-widest py-1 border-b border-zinc-100">DEBE</div>
                    <ul className="flex-1 p-2 space-y-1">
                      {movimientosCuenta.filter(m => m.debe > 0).map((mov, i) => (
                        <li key={i} className="flex justify-between text-zinc-700">
                          <span className="text-[10px] text-zinc-400">{mov.fecha.slice(5)}</span>
                          <span>{mov.debe.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="p-2 border-t border-zinc-200 text-right font-medium text-black">
                      {sumaDebe.toFixed(2)}
                    </div>
                  </div>

                  {/* Lado Haber (Abonos) */}
                  <div className="w-1/2 min-h-30 flex flex-col">
                    <div className="text-center text-[10px] text-zinc-400 font-bold tracking-widest py-1 border-b border-zinc-100">HABER</div>
                    <ul className="flex-1 p-2 space-y-1">
                      {movimientosCuenta.filter(m => m.haber > 0).map((mov, i) => (
                        <li key={i} className="flex justify-between text-zinc-700">
                          <span>{mov.haber.toFixed(2)}</span>
                          <span className="text-[10px] text-zinc-400">{mov.fecha.slice(5)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="p-2 border-t border-zinc-200 text-left font-medium text-black">
                      {sumaHaber.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Saldo Final */}
                <div className="pt-2 flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-medium uppercase tracking-wider">Saldo {cuenta.naturaleza}</span>
                  <span className="font-bold border-double border-b-4 border-black pb-0.5">
                    ${Math.abs(cuenta.saldo).toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}