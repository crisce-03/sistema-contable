"use client";
import { Download, Plus } from "lucide-react";
import { useState } from "react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { familias, parseCatalog } from "@/lib/accounting/core";
import catalogoPdf from "@/examples/catalogo-pdf-importable.json";
import JsonImport, { download } from "@/components/accounting/json-import";
export default function CatalogoPage() {
  const { cuentas, ejecutar, ocupado } = useAccountingStore();
  const [codigo, setCodigo] = useState("1101"),
    [nombre, setNombre] = useState(""),
    [padre, setPadre] = useState("11"),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState("");
  const grupo = padre.slice(0, 1);
  const rubro = padre.slice(0, 2);
  const cuentaMayor = padre.length >= 4 ? padre.slice(0, 4) : "";
  const subcuenta = padre.length >= 6 ? padre.slice(0, 6) : "";
  const subcuentaOcho = padre.length === 8 ? padre : "";
  const cuentasExportables = cuentas
    .filter((c) => c.codigo.length >= 4)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const cuentasMayor = cuentas
    .filter((c) => c.codigo.length === 4 && c.padreCodigo === rubro)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const subcuentas = cuentas
    .filter((c) => c.codigo.length === 6 && c.padreCodigo === cuentaMayor)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const subcuentasOcho = cuentas
    .filter((c) => c.codigo.length === 8 && c.padreCodigo === subcuenta)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  function selectParent(value: string) {
    setPadre(value);
    const available = Array.from({ length: 99 }, (_, i) =>
      value + String(i + 1).padStart(2, "0"),
    ).find((candidate) => !cuentas.some((c) => c.codigo === candidate));
    setCodigo(available ?? "");
  }
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
          { codigo, nombre, padreCodigo: padre, activa: true },
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
          Grupos de 1 dígito y rubros de 2 dígitos predefinidos. Importa tus
          cuentas de mayor de 4 dígitos y añade subcuentas de 6, 8 y 10 dígitos.
        </p>
      </header>
      <section aria-label="Descargar catálogo configurado" className="border border-zinc-200 bg-white p-4 space-y-3">
        <button
          type="button"
          className="primary flex items-center gap-2"
          disabled={ocupado || !cuentasExportables.length}
          onClick={() =>
            download("catalogo-configurado.json", {
              version: 1,
              cuentas: cuentasExportables.map(
                ({ codigo, nombre, padreCodigo, activa }) => ({
                  codigo,
                  nombre,
                  padreCodigo,
                  activa,
                }),
              ),
            })
          }
        >
          <Download size={16} aria-hidden="true" />
          Descargar catálogo configurado (JSON) ({cuentasExportables.length})
        </button>
        <p className="text-xs text-zinc-500">
          {cuentasExportables.length
            ? "Incluye todas tus cuentas y subcuentas guardadas de 4, 6, 8 y 10 dígitos, activas e inactivas, con sus nombres y cuentas padre. La búsqueda no limita la descarga. Puedes importar este archivo en otro ejercicio."
            : "Crea o importa cuentas para habilitar la descarga del catálogo configurado."}
          {" "}Los grupos y rubros de 1 y 2 dígitos ya están predefinidos en el sistema.
        </p>
      </section>
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
                Grupo · 1 dígito
                <select
                  className="field"
                  disabled={ocupado}
                  value={grupo}
                  onChange={(e) => {
                    const firstRubro = familias.find(
                      (f) => f.codigo.length === 2 && f.codigo.startsWith(e.target.value),
                    );
                    if (firstRubro) selectParent(firstRubro.codigo);
                  }}
                >
                  {familias.filter((f) => f.codigo.length === 1).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.codigo} · {f.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-zinc-600">
                Rubro · 2 dígitos
                <select
                  className="field"
                  disabled={ocupado}
                  value={rubro}
                  onChange={(e) => selectParent(e.target.value)}
                >
                  {familias
                    .filter((f) => f.codigo.length === 2 && f.codigo.startsWith(grupo))
                    .map((f) => (
                      <option key={f.id} value={f.codigo}>
                        {f.codigo} · {f.nombre}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-xs text-zinc-600">
                Cuenta de mayor · 4 dígitos
                <select
                  className="field"
                  disabled={ocupado}
                  value={cuentaMayor}
                  onChange={(e) => selectParent(e.target.value || rubro)}
                >
                  <option value="">Crear cuenta de 4 dígitos</option>
                  {cuentasMayor.map((c) => (
                    <option key={c.id} value={c.codigo}>
                      {c.codigo} · {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              {cuentaMayor && (
                <label className="text-xs text-zinc-600">
                  Subcuenta · 6 dígitos
                  <select
                    className="field"
                    disabled={ocupado}
                    value={subcuenta}
                    onChange={(e) => selectParent(e.target.value || cuentaMayor)}
                  >
                    <option value="">Crear subcuenta de 6 dígitos</option>
                    {subcuentas.map((c) => (
                      <option key={c.id} value={c.codigo}>
                        {c.codigo} · {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {subcuenta && (
                <label className="text-xs text-zinc-600">
                  Subcuenta · 8 dígitos
                  <select
                    className="field"
                    disabled={ocupado}
                    value={subcuentaOcho}
                    onChange={(e) => selectParent(e.target.value || subcuenta)}
                  >
                    <option value="">Crear subcuenta de 8 dígitos</option>
                    {subcuentasOcho.map((c) => (
                      <option key={c.id} value={c.codigo}>
                        {c.codigo} · {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="text-xs text-zinc-500">
                {subcuentaOcho
                  ? `Nueva subcuenta de 10 dígitos dentro de ${subcuentaOcho}.`
                  : subcuenta
                    ? `Nueva subcuenta de 8 dígitos dentro de ${subcuenta}.`
                  : cuentaMayor
                    ? `Nueva subcuenta de 6 dígitos dentro de ${cuentaMayor}.`
                    : `Nueva cuenta de 4 dígitos dentro del rubro ${rubro}.`}
              </p>
              <label className="text-xs text-zinc-600">
                Código
                <input
                  className="field"
                  required
                  inputMode="numeric"
                  pattern="(?:[0-9]{4}|[0-9]{6}|[0-9]{8}|[0-9]{10})"
                  maxLength={10}
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
              Ejemplo del manual: 1101 Efectivo y equivalentes de efectivo →
              110101 Caja → 11010101 Caja General. Los asientos usan
              una cuenta de 4 dígitos y permiten detallar subcuentas de forma
              opcional; el Mayor acumula en 4 dígitos. Al añadir subcuentas se
              conservan los movimientos anteriores del padre.
              Para renombrar o desactivar cuentas utiliza el JSON.
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
                  <th>Nivel / mayor</th>
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
                      <td style={{ paddingLeft: `${(c.codigo.length === 1 ? 0 : c.codigo.length / 2) * 12 + 8}px` }}>
                        {c.padreCodigo ? "↳ " : ""}
                        {c.nombre}
                        <span className="block text-[10px] text-zinc-400">
                          {c.movimiento ? "Movimiento" : "Agrupación"} ·{" "}
                          {c.activa ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td>
                        {c.codigo.length <= 2 ? "Predefinida" : c.codigo.length === 4 ? "Cuenta de mayor" : `Subcuenta · mayor ${c.codigo.slice(0, 4)}`}
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
            {!cuentas.some((c) => c.codigo.length === 4) && (
              <p className="p-8 text-center text-zinc-500">
                La estructura base está lista. Importa tus cuentas de 4 dígitos para comenzar.
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="space-y-4 border-t border-zinc-200 pt-6">
        <div className="catalog-toolbar flex items-center gap-3 flex-wrap text-xs">
          <button onClick={() => download("catalogo-pdf-importable.json", catalogoPdf)}>
            Descargar catálogo del PDF (JSON)
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          El JSON incluye cuentas de 4, 6, 8 y 10 dígitos. Cada subcuenta necesita
          su padre en el catálogo o en el mismo archivo. Los niveles de 1 y 2
          dígitos ya existen y no se importan ni se modifican.
        </p>
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
