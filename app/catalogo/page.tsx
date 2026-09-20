"use client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { familias, parseCatalog } from "@/lib/accounting/core";
import seed from "@/lib/accounting/seed.json";
import JsonImport, { download } from "@/components/accounting/json-import";
export default function CatalogoPage() {
  const { cuentas, ejecutar, ocupado } = useAccountingStore();
  const [familia, setFamilia] = useState("efectivo"),
    [codigo, setCodigo] = useState("1101"),
    [nombre, setNombre] = useState(""),
    [padre, setPadre] = useState(""),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState("");
  async function save(data: unknown) {
    await ejecutar("catalog", data);
    return "Catálogo guardado en este navegador.";
  }
  async function manual(e: React.FormEvent) {
    e.preventDefault();
    try {
      const data = {
        version: 1,
        cuentas: [
          { codigo, nombre, familia, padreCodigo: padre || null, activa: true },
        ],
      };
      const checked = parseCatalog(data, cuentas);
      setMessage(await save({ version: 1, cuentas: checked }));
      setNombre("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <div className="accounting-original catalog-original max-w-5xl mx-auto space-y-8 font-sans text-zinc-900">
      <header className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Catálogo de Cuentas
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Estructura primaria y de detalle contable.
        </p>
      </header>
      {message && (
        <p role="status" className="text-xs text-zinc-600">
          {message}
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <aside className="lg:col-span-1">
          <form
            onSubmit={manual}
            className="space-y-4 bg-zinc-50 p-4 border border-zinc-200"
          >
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">
              Nueva cuenta
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <label className="text-xs text-zinc-600">
                Familia
                <select
                  className="field"
                  value={familia}
                  onChange={(e) => {
                    setFamilia(e.target.value);
                    setCodigo(
                      familias.find((f) => f.id === e.target.value)!.codigo,
                    );
                    setPadre("");
                  }}
                >
                  {familias.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-zinc-600">
                Cuenta padre
                <select
                  className="field"
                  value={padre}
                  onChange={(e) => {
                    setPadre(e.target.value);
                    setCodigo(
                      e.target.value
                        ? e.target.value + "01"
                        : familias.find((f) => f.id === familia)!.codigo,
                    );
                  }}
                >
                  <option value="">Cuenta principal</option>
                  {cuentas
                    .filter((c) => c.familia === familia)
                    .map((c) => (
                      <option key={c.id} value={c.codigo}>
                        {c.codigo} · {c.nombre}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-xs text-zinc-600">
                Código
                <input
                  className="field"
                  required
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                />
              </label>
              <label className="text-xs text-zinc-600">
                Nombre
                <input
                  className="field"
                  required
                  maxLength={160}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </label>
            </div>
            <p className="text-xs text-zinc-500">
              Un padre con movimientos no puede recibir subcuentas. Crea el
              desglose antes de registrar asientos. Para renombrar o desactivar
              cuentas utiliza el JSON; los códigos existentes conservan su
              identidad.
            </p>
            <button
              className="primary w-full flex items-center justify-center gap-2"
              disabled={ocupado}
            >
              <Plus size={14} /> Guardar cuenta
            </button>
          </form>
        </aside>
        <section className="lg:col-span-3 min-w-0 space-y-4">
          <input
            className="field max-w-md"
            aria-label="Buscar cuenta"
            placeholder="Buscar por código o nombre"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cuenta</th>
                  <th>Grupo / rubro</th>
                  <th>Naturaleza</th>
                </tr>
              </thead>
              <tbody>
                {[...cuentas]
                  .sort((a, b) => a.codigo.localeCompare(b.codigo))
                  .filter((c) =>
                    (c.codigo + " " + c.nombre)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((c) => (
                    <tr key={c.id}>
                      <td>{c.codigo}</td>
                      <td>
                        {c.padreCodigo ? "↳ " : ""}
                        {c.nombre}
                        <span className="block text-[10px] text-zinc-400">
                          {c.movimiento ? "Movimiento" : "Agrupación"} ·{" "}
                          {c.activa ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td>
                        {c.tipo}
                        <div className="text-xs text-zinc-500">
                          {c.rubro.replaceAll("_", " ")}
                        </div>
                      </td>
                      <td>{c.naturaleza}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!cuentas.length && (
              <p className="p-8 text-center text-zinc-500">
                Carga el catálogo para comenzar.
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="space-y-4 border-t border-zinc-200 pt-6">
        <div className="catalog-toolbar flex items-center gap-3 flex-wrap text-xs">
          <button
            className="primary"
            disabled={ocupado || cuentas.length > 0}
            onClick={() =>
              void save(seed)
                .then(setMessage)
                .catch((e) => setMessage(e.message))
            }
          >
            Cargar cuentas
          </button>
          <button
            disabled={ocupado}
            onClick={() =>
              download("catalogo.json", {
                version: 1,
                cuentas: cuentas.map(
                  ({ codigo, nombre, familia, padreCodigo, activa }) => ({
                    codigo,
                    nombre,
                    familia,
                    padreCodigo,
                    activa,
                  }),
                ),
              })
            }
          >
            Exportar catálogo
          </button>
          <button onClick={() => download("catalogo-modelo.json", seed)}>
            Descargar modelo JSON
          </button>
        </div>
        <JsonImport
          label="Importar catálogo JSON"
          busy={ocupado}
          validate={(v) => ({ version: 1, cuentas: parseCatalog(v, cuentas) })}
          commit={save}
        />
      </section>
    </div>
  );
}
