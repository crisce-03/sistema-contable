"use client";

import { useState } from "react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { calcularKardex, rolesKardex } from "@/lib/accounting/local";
import { money } from "@/lib/accounting/core";
import type { KardexProducto } from "@/lib/types";

export default function KardexInteractivo() {
  const { cuentas, asientos, kardex, ejecutar, ocupado } = useAccountingStore();

  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<KardexProducto | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [mostrarConfiguracion, setMostrarConfiguracion] = useState(false);

  const productos = kardex ?? [];
  const id = seleccionado ?? productos[0]?.id ?? "";
  const anio = new Date().getFullYear();

  const producto: KardexProducto =
    borrador ??
    productos.find(p => p.id === id) ?? {
      id: "",
      nombre: "",
      costo: "",
      venta: "",
      inicial: 0,
      inicio: `${anio}-01-01`,
      fin: `${anio}-12-31`,
      cuentas: {
        compras: "",
        ventas: "",
        devolCompras: "",
        devolVentas: "",
      },
    };

  function cambiar(cambios: Partial<KardexProducto>) {
    setBorrador({ ...producto, ...cambios });
    setMensaje("");
  }

  let resultado: ReturnType<typeof calcularKardex> | null = null;
  let errorCalculo = "";

  try {
    resultado = calcularKardex(producto, asientos);
  } catch (e) {
    errorCalculo = (e as Error).message;
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();

    const datos = {
      ...producto,
      id: producto.id || crypto.randomUUID(),
    };

    try {
      await ejecutar("kardex", datos);
      setSeleccionado(datos.id);
      setBorrador(null);
      setMensaje("Parámetros guardados. Kardex recalculado.");
      setMostrarConfiguracion(false);
    } catch (e) {
      setMensaje((e as Error).message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans text-zinc-900 pb-12">

      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Tarjeta Kardex
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Entradas y salidas desde el diario.
        </p>
      </div>

            <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
        <label className="flex items-center gap-2 border border-zinc-200 bg-white px-3 py-1.5 rounded-sm shadow-sm">
          Producto:
          <select
            aria-label="Producto"
            value={id}
            disabled={ocupado}
            className="max-w-48 bg-transparent outline-none focus:ring-2 focus:ring-zinc-500"
            onChange={e => {
              setSeleccionado(e.target.value);
              setBorrador(null);
              setMensaje("");
            }}
          >
            <option value="">Sin seleccionar</option>
            {productos.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <span className="px-3 py-1.5 border border-zinc-200 bg-white rounded-sm shadow-sm">
          Costo: {resultado ? `$${Number(producto.costo).toFixed(2)}` : "—"}
        </span>

        <span className="px-3 py-1.5 border border-zinc-200 bg-white rounded-sm shadow-sm">
          Venta: {resultado ? `$${Number(producto.venta).toFixed(2)}` : "—"}
        </span>

        <button
          type="button"
          disabled={ocupado}
          aria-expanded={mostrarConfiguracion}
          aria-controls="configuracion-kardex"
          className="ml-auto px-4 py-2 bg-black text-white text-sm rounded-sm hover:bg-zinc-800"
          onClick={() => setMostrarConfiguracion(!mostrarConfiguracion)}
        >
          {mostrarConfiguracion
            ? "Ocultar configuración"
            : "Configurar Kardex"}
        </button>

        <button
          type="button"
          disabled={ocupado}
          className="px-3 py-2 border border-zinc-200 rounded-sm hover:bg-zinc-50"
          onClick={() => {
            setSeleccionado("");
            setBorrador(null);
            setMensaje("");
            setMostrarConfiguracion(true);
          }}
        >
          + Nuevo producto
        </button>
      </div>

      {mensaje && (
        <p role="status" className="text-sm">
          {mensaje}
        </p>
      )}

      {(borrador || !producto.id) && resultado && (
        <p className="text-xs text-amber-800">
          Vista previa: guarda la configuración para conservar los cambios.
        </p>
      )}

      <div id="configuracion-kardex" hidden={!mostrarConfiguracion}>

      <form
        onSubmit={guardar}
        className="bg-zinc-50 border border-zinc-200 p-4 space-y-4"
      >
        <fieldset
          disabled={ocupado}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <label className="text-sm">
            Nombre del producto
            <input
              className="field"
              required
              maxLength={120}
              value={producto.nombre}
              onChange={e => cambiar({ nombre: e.target.value })}
            />
          </label>

          <label className="text-sm">
            Costo unitario sin IVA
            <input
              className="field"
              required
              inputMode="decimal"
              value={producto.costo}
              onChange={e => cambiar({ costo: e.target.value })}
            />
          </label>

          <label className="text-sm">
            Venta unitaria sin IVA
            <input
              className="field"
              required
              inputMode="decimal"
              value={producto.venta}
              onChange={e => cambiar({ venta: e.target.value })}
            />
          </label>

          <label className="text-sm">
            Fecha inicial
            <input
              className="field"
              type="date"
              required
              value={producto.inicio}
              onChange={e => cambiar({ inicio: e.target.value })}
            />
          </label>

          <label className="text-sm">
            Fecha final
            <input
              className="field"
              type="date"
              required
              value={producto.fin}
              onChange={e => cambiar({ fin: e.target.value })}
            />
          </label>

          <label className="text-sm">
            Unidades al inicio
            <input
              className="field"
              type="number"
              min="0"
              step="1"
              required
              value={producto.inicial}
              onChange={e =>
                cambiar({ inicial: Number(e.target.value) })
              }
            />
          </label>

          {rolesKardex.map(([rol, titulo]) => (
            <label key={rol} className="text-sm">
              {titulo}
              <select
                className="field"
                value={producto.cuentas[rol]}
                required={rol === "compras" || rol === "ventas"}
                onChange={e =>
                  cambiar({
                    cuentas: {
                      ...producto.cuentas,
                      [rol]: e.target.value,
                    },
                  })
                }
              >
                <option value="">
                  {rol.startsWith("devol")
                    ? "Sin asignar (opcional)"
                    : "Seleccionar cuenta"}
                </option>

                {cuentas
                  .filter(c => c.codigo.length >= 4)
                  .map(c => (
                    <option key={c.id} value={c.codigo}>
                      {c.codigo} · {c.nombre}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        </fieldset>

        <p className="text-xs text-zinc-500">
          Asigna únicamente cuentas de mercadería. Se usan los códigos
          exactos, sin sumar padres y subcuentas. Cada producto debe
          tener cuentas distintas. Las unidades iniciales son las
          existentes antes de los movimientos de la fecha inicial.
        </p>

        <p className="text-xs text-zinc-500">
          Un precio único por producto recalcula todo el intervalo.
          Los cambios se previsualizan al escribir y se conservan al
          guardar. No se modifican asientos.
        </p>

        <button className="primary" disabled={ocupado}>
          Guardar parámetros
        </button>

        {(borrador || !producto.id) && (
          <span className="ml-3 text-xs text-amber-800">
            Vista previa sin guardar
          </span>
        )}
        
      </form>
      </div>

      {mensaje && (
          <p role="status" className="text-sm">
            {mensaje}
          </p>
        )}

            {errorCalculo && mostrarConfiguracion && (
        <p role="alert" className="text-sm text-amber-800">
          {errorCalculo}
        </p>
      )}

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
                className="border-b border-zinc-200 p-2 font-bold text-center bg-zinc-100 border-r tracking-wider"
              >
                ENTRADAS
              </th>
              <th
                colSpan={3}
                className="border-b border-zinc-200 p-2 font-bold text-center bg-zinc-50 border-r tracking-wider"
              >
                SALIDAS
              </th>
              <th
                colSpan={3}
                className="border-b border-zinc-200 p-2 font-bold text-center bg-black text-white tracking-wider"
              >
                EXISTENCIAS
              </th>
            </tr>

            <tr className="bg-zinc-50 border-b-2 border-black">
              {Array.from({ length: 3 }, (_, grupo) =>
                ["Cant.", "C.U.", "Total"].map((titulo, columna) => (
                  <th
                    key={`${grupo}-${columna}`}
                    className={`p-2 font-medium text-center text-zinc-500 ${
                      grupo === 2 ? "bg-zinc-100" : ""
                    } ${columna === 2 ? "border-r" : ""}`}
                  >
                    {titulo}
                  </th>
                )),
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100">
            {resultado ? (
              resultado.filas.map(f => (
                <tr
                  key={f.id}
                  className={
                    f.existencias < 0 ? "bg-red-50" : "hover:bg-zinc-50"
                  }
                >
                  <td className="p-2 whitespace-nowrap">{f.fecha}</td>
                  <td className="p-2 border-r">{f.concepto}</td>

                  <td className="p-2 text-right">
                    {f.entrada || "—"}
                  </td>
                  <td className="p-2 text-right">
                    {f.entrada ? Number(producto.costo).toFixed(2) : "—"}
                  </td>
                  <td className="p-2 text-right border-r">
                    {f.entrada ? money(f.deudor) : "—"}
                  </td>

                  <td className="p-2 text-right">
                    {f.salida || "—"}
                  </td>
                  <td className="p-2 text-right">
                    {f.salida ? Number(producto.costo).toFixed(2) : "—"}
                  </td>
                  <td className="p-2 text-right border-r">
                    {f.salida ? money(f.acreedor) : "—"}
                  </td>

                  <td className="p-2 text-right bg-zinc-50">
                    {f.existencias}
                  </td>
                  <td className="p-2 text-right bg-zinc-50">
                    {Number(producto.costo).toFixed(2)}
                  </td>
                  <td className="p-2 text-right bg-zinc-50 font-semibold">
                    {money(f.saldo)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={11}
                  className="p-8 text-center text-zinc-500"
                >
                  {producto.id || borrador
                    ? "Revisa los datos en Configurar Kardex para mostrar los movimientos."
                    : "Configura los precios y el inventario inicial. Los movimientos del diario aparecerán aquí automáticamente."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {resultado && (
        <>
          <p
            className={
              resultado.valido
                ? "text-sm font-semibold"
                : "text-sm text-red-700"
            }
          >
            {resultado.valido
              ? "Inventario final calculado"
              : "Resultado con inconsistencias; revisar"}
            : {resultado.unidades} unidades · $
            {money(resultado.inventarioFinal)}
          </p>

          {resultado.avisos.length > 0 && (
            <details className="border border-amber-200 bg-amber-50 p-3 text-xs">
              <summary className="cursor-pointer">
                Revisar redondeos y existencias ({resultado.avisos.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {resultado.avisos.map((aviso, i) => (
                  <li key={i}>{aviso}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

