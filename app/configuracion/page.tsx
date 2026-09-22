"use client";
import { useState } from "react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { download } from "@/components/accounting/json-import";
import { archives } from "@/lib/accounting/browser-storage";
import type { ConfiguracionLibro, LibroLocal } from "@/lib/types";
import { canPost } from "@/lib/accounting/core";
import { resolveIvaAccount } from "@/lib/accounting/local";
function Options({ onSaved }: { onSaved: (message: string) => void }) {
  const { configuracion, cuentas, asientos, ejecutar, ocupado } = useAccountingStore();
  const [draft, setDraft] = useState({ ...configuracion }),
    [message, setMessage] = useState("");
  const inventoryLocked = asientos.length > 0;
  return (
    <section className="border border-zinc-200 bg-white p-6 space-y-4">
      <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-2">
        Reglas del ejercicio
      </h2>
      <label className="block text-sm">
        Modo de IVA
        <select
          aria-label="Modo de IVA"
          className="field"
          disabled={ocupado}
          value={draft.modoIva}
          onChange={(e) =>
            setDraft({
              ...draft,
              modoIva: e.target.value as ConfiguracionLibro["modoIva"],
            })
          }
        >
          <option value="mas_iva">Más IVA</option>
          <option value="incluido">IVA incluido</option>
        </select>
      </label>
      <p className="text-sm text-zinc-600">
        Puedes cambiar entre Más IVA e IVA incluido. El asistente usará el modo
        guardado para los próximos cálculos; los asientos registrados conservan
        sus importes y su modo de IVA original.
      </p>
      {(["credito", "debito"] as const).map((tipo) => {
        const key = tipo === "credito" ? "cuentaIvaCredito" : "cuentaIvaDebito";
        const detected = resolveIvaAccount(tipo, { ...draft, [key]: "" }, cuentas);
        return (
          <label key={tipo} className="block text-sm">
            Cuenta de IVA {tipo === "credito" ? "crédito" : "débito"} fiscal
            <select
              className="field"
              disabled={ocupado}
              value={draft[key] ?? ""}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            >
              <option value="">{detected ? `Automática: ${detected.codigo} · ${detected.nombre}` : "Selecciona una cuenta del catálogo"}</option>
              {cuentas.filter((c) => canPost(c, cuentas)).sort((a, b) => a.codigo.localeCompare(b.codigo)).map((c) => (
                <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>
              ))}
            </select>
          </label>
        );
      })}
      <p className="text-xs text-zinc-500">
        En cada línea del Diario solo eliges crédito o débito fiscal. Se usa la
        cuenta asignada aquí o se reconoce por su nombre en el catálogo.
      </p>
      <label className="block text-sm">
        Tratamiento de inventarios
        <select
          aria-label="Tratamiento de inventarios"
          className="field"
          disabled={inventoryLocked || ocupado}
          value={draft.modoInventario}
          onChange={(e) =>
            setDraft({
              ...draft,
              modoInventario: e.target
                .value as ConfiguracionLibro["modoInventario"],
            })
          }
        >
          <option value="traslados_compras">
            Sin Inventarios
          </option>
          <option value="inventarios_explicitos">
            Con Inventarios
          </option>
        </select>
      </label>
      <p className="text-sm text-zinc-600">
        {draft.modoInventario === "traslados_compras"
          ? "Se registran los ajustes inicial y final contra Compras. El informe futuro usará Compras ajustadas, sin volver a aplicar ambos inventarios."
          : "No se admiten los dos traspasos entre Compras e Inventarios. El informe futuro calculará inventario inicial + compras netas − inventario final con sus datos de valoración."}
      </p>
      <p className="text-xs text-zinc-500">
        La configuración controla la entrada de ajustes. El estado de resultados
        completo y la valoración del inventario todavía están pendientes.
      </p>
      <button
        className="primary"
        disabled={ocupado}
        onClick={() =>
          void ejecutar("settings", draft)
            .then(() => onSaved("Configuración guardada."))
            .catch((e) => setMessage(e.message))
        }
      >
        Guardar configuración
      </button>
      {inventoryLocked && (
        <p className="text-sm text-amber-800">
          El tratamiento de inventarios se fija al guardar el primer asiento.
          Para cambiarlo, inicia un ejercicio nuevo; el actual se archivará.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export default function Configuracion() {
  const s = useAccountingStore();
  const [anio, setAnio] = useState(new Date().getFullYear()),
    [message, setMessage] = useState(""),
    [saved, setSaved] = useState<{ key: string; book: LibroLocal }[]>([]),
    [confirm, setConfirm] = useState(false);
  async function period(anio: number, cerrado: boolean) {
    try {
      await s.ejecutar("period", { anio, cerrado });
      setMessage(cerrado ? "Período bloqueado." : "Período abierto.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <div className="configuration-original max-w-5xl mx-auto space-y-8 font-sans text-zinc-900 pb-12">
      <header className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Configuración del ejercicio
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Parámetros de operación y administración del ejercicio.
        </p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Options
          onSaved={setMessage}
          key={
            s.configuracion.modoIva +
            s.configuracion.modoInventario +
            (s.configuracion.cuentaIvaCredito ?? "") +
            (s.configuracion.cuentaIvaDebito ?? "") +
            String(s.asientos.length > 0)
          }
        />
        <section className="border border-zinc-200 bg-white p-6 space-y-4">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-2">
            Períodos de registro
          </h2>
          <p className="text-sm">
            Bloquear un año impide nuevos movimientos; no ejecuta un cierre
            contable.
          </p>
          <form
            className="flex items-end gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void period(anio, false);
            }}
          >
            <label>
              Año
              <input
                className="field"
                type="number"
                min={1900}
                max={2200}
                required
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
              />
            </label>
            <button disabled={s.ocupado} className="primary">
              Crear / abrir período
            </button>
          </form>
          <table className="data-table">
            <thead>
              <tr>
                <th>Año</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {s.periodos.map((p) => (
                <tr key={p.anio}>
                  <td>{p.anio}</td>
                  <td>{p.cerrado ? "Bloqueado" : "Abierto"}</td>
                  <td>
                    <button
                      disabled={s.ocupado}
                      onClick={() => void period(p.anio, !p.cerrado)}
                    >
                      {p.cerrado ? "Reabrir" : "Bloquear registros"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="border border-zinc-200 bg-white p-6 space-y-4">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-2">
            Datos locales y ejercicios archivados
          </h2>
          <p className="text-sm">
            Los datos permanecen al recargar y al cerrar el navegador. Son de
            este navegador y esta dirección; no se sincronizan con otros
            equipos. Borrar datos del sitio también los elimina.
          </p>
          <button
            className="primary"
            onClick={() =>
              download("respaldo-contabilidad-local.json", {
                versionAuditoria: 2,
                exportadoEn: new Date().toISOString(),
                configuracion: s.configuracion,
                cuentas: s.cuentas,
                asientos: s.asientos,
                periodos: s.periodos,
              })
            }
          >
            Descargar respaldo de auditoría
          </button>
          <p className="text-xs text-zinc-500">
            Incluye originales y reversiones para consulta. El catálogo y los
            asientos normales/ajustes también se exportan en sus pantallas con
            formato de importación. La restauración completa desde archivo sigue
            pendiente.
          </p>
          <div className="flex flex-wrap gap-5">
            <button disabled={s.ocupado} onClick={() => setConfirm(true)}>
              Iniciar otro ejercicio
            </button>
            <button
              disabled={s.ocupado}
              onClick={() =>
                void archives()
                  .then(setSaved)
                  .catch((e) => setMessage(e.message))
              }
            >
              Ver ejercicios archivados
            </button>
          </div>
          {confirm && (
            <div className="bg-blue-50 p-4 space-y-3">
              <p>
                El ejercicio actual quedará archivado en este navegador. El
                nuevo empezará vacío, con Más IVA y traspasos a Compras.
              </p>
              <button
                className="primary"
                disabled={s.ocupado}
                onClick={() =>
                  void s
                    .ejecutar("newExercise", {})
                    .then(() => {
                      setConfirm(false);
                      setMessage(
                        "Ejercicio anterior archivado. Nuevo ejercicio listo.",
                      );
                      setSaved([]);
                    })
                    .catch((e) => setMessage(e.message))
                }
              >
                Archivar actual y crear nuevo
              </button>
              <button className="ml-4" onClick={() => setConfirm(false)}>
                Cancelar
              </button>
            </div>
          )}
          {saved.map((a, i) => (
            <div
              className="border-t pt-3 flex justify-between gap-3"
              key={a.key}
            >
              <span>
                Ejercicio {i + 1}: {a.book.asientos.length} asientos ·{" "}
                {a.book.cuentas.length} cuentas ·{" "}
                {a.book.configuracion.modoIva === "mas_iva"
                  ? "Más IVA"
                  : "IVA incluido"}
              </span>
              <button
                disabled={s.ocupado}
                onClick={() =>
                  void s
                    .abrirArchivado(a.key)
                    .then(() => {
                      setSaved([]);
                      setMessage(
                        "Ejercicio recuperado; el anterior se archivó.",
                      );
                    })
                    .catch((e) => setMessage(e.message))
                }
              >
                Abrir
              </button>
            </div>
          ))}
        </section>
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
