"use client";
import { useState } from "react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { download } from "@/components/accounting/json-import";
import { archives } from "@/lib/accounting/browser-storage";
import type { ConfiguracionLibro, LibroLocal, RolReporte } from "@/lib/types";
import { canPost, money } from "@/lib/accounting/core";
import {
  inventarioFinalKardex,
  resolveIvaAccount,
} from "@/lib/accounting/local";
import {
  asientoCierre,
  cierreRegistrado,
  estadoResultados,
  referenciaCierre,
  resolverCuentaReporte,
  rolesReporte,
} from "@/lib/accounting/reports";
function Options({ onSaved }: { onSaved: (message: string) => void }) {
  const { configuracion, cuentas, asientos, ejecutar, ocupado } = useAccountingStore();
  const [draft, setDraft] = useState({ ...configuracion }),
    [message, setMessage] = useState("");
  const trasladosVigentes = asientos.filter(
    (a) =>
      a.tipo === "ajuste" &&
      a.ajusteInventario &&
      !asientos.some((r) => r.reversaDe === a.id),
  ).length;
  return (
    <section className="border border-zinc-200 bg-white p-6 space-y-4">
      <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-2">
        Reglas del ejercicio
      </h2>
      <p className="text-xs text-zinc-500">
        Estas reglas gobiernan cómo el asistente del Libro Diario calcula los
        importes. No alteran los asientos ya registrados: cada uno conserva el
        importe y el modo de IVA con que se guardó.
      </p>
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
      <p className="text-xs text-zinc-500">
        Define cómo interpreta el asistente el importe que escribes en una
        línea con IVA. <strong>Más IVA</strong>: lo tratas como valor neto y se
        le suma el 13 % encima. <strong>IVA incluido</strong>: lo tratas como
        total con impuesto y se separa la base dividiendo entre 1.13. Con
        $10,000 y 13 %, el primero registra 10,000 + 1,300; el segundo,
        8,849.56 + 1,150.44.
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
        Dónde aterriza el IVA que el asistente separa. El{" "}
        <strong>crédito fiscal</strong> es el IVA de tus compras, un activo a
        tu favor; el <strong>débito fiscal</strong> es el de tus ventas, un
        pasivo con Hacienda. En el Diario solo eliges cuál de los dos aplica y
        la cuenta se toma de aquí. Si las dejas en automático se reconocen por
        su nombre en el catálogo; asígnalas a mano cuando haya varias cuentas
        que se llamen parecido. Son también las dos cuentas que compara la
        pantalla de Liquidación de IVA.
      </p>
      <label className="block text-sm">
        Traslados del método analítico
        <select
          aria-label="Traslados del método analítico"
          className="field"
          disabled={ocupado}
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
            Analítico con traslados a Compras
          </option>
          <option value="inventarios_explicitos">
            Analítico sin traslados
          </option>
        </select>
      </label>
      <p className="text-xs text-zinc-500">
        El ejercicio siempre lleva el método analítico o pormenorizado, y el
        estado de resultados calcula inventario inicial + compras netas −
        inventario final en los dos casos. Lo único que cambia es si esos dos
        traslados quedan asentados en el Libro Diario.
      </p>
      <p className="text-xs text-zinc-500">
        {draft.modoInventario === "traslados_compras" ? (
          <>
            <strong>Con traslados:</strong> al guardar el Kardex se registran
            dos asientos de ajuste. El primero vacía Inventarios contra
            Compras; el segundo devuelve a Inventarios la existencia final que
            calculó el Kardex. Así el Mayor muestra la existencia real y
            Compras queda convertida en costo de ventas. Se recalculan solos
            cada vez que cambia el diario.
          </>
        ) : (
          <>
            <strong>Sin traslados:</strong> el Kardex es extracontable.
            Inventarios se queda con el saldo de apertura y Compras con su
            importe bruto durante todo el período; la existencia final solo
            aparece en el Estado de Resultados y en el Balance. Es la forma
            que siguen la mayoría de los libros de texto.
          </>
        )}
      </p>
      <p className="text-xs text-zinc-500">
        Puedes cambiar de opción cuando quieras: los traslados se crean o se
        revierten solos y los importes del informe no varían. El método de
        inventario perpetuo, con su cuenta de Costo de Ventas por cada venta,
        no está implementado.
      </p>
      {draft.modoInventario !== configuracion.modoInventario &&
        draft.modoInventario === "inventarios_explicitos" &&
        trasladosVigentes > 0 && (
          <p className="text-sm text-amber-800">
            Al guardar se revertirán los {trasladosVigentes} traslados ya
            registrados. Quedan en el diario como reversiones, no se borran, y
            el estado de resultados no cambia de importes.
          </p>
        )}
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
      {message && <p role="status">{message}</p>}
    </section>
  );
}
function EnlacesYCierre({ onSaved }: { onSaved: (message: string) => void }) {
  const { configuracion, cuentas, asientos, kardex, ejecutar, ocupado } =
    useAccountingStore();
  const existenciaKardex = inventarioFinalKardex(kardex, asientos);
  const postables = cuentas
    .filter((c) => canPost(c, cuentas))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const [draft, setDraft] = useState({
    cuentasReporte: { ...(configuracion.cuentasReporte ?? {}) } as Partial<
      Record<RolReporte, string>
    >,
    inventarioFinalFisico: configuracion.inventarioFinalFisico ?? "",
  });
  const [message, setMessage] = useState("");
  const [anio, setAnio] = useState(
    asientos.length
      ? Number(asientos[asientos.length - 1].fecha.slice(0, 4))
      : new Date().getFullYear(),
  );
  const [confirmar, setConfirmar] = useState(false);

  // El informe usa la configuración guardada; el borrador solo afecta a la
  // vista previa de esta pantalla hasta que se pulsa guardar.
  const vista: ConfiguracionLibro = { ...configuracion, ...draft };
  const registrado = cierreRegistrado(anio, asientos);
  let resumen: ReturnType<typeof estadoResultados> | null = null,
    partida: ReturnType<typeof asientoCierre> | null = null,
    errorCierre = "";
  try {
    resumen = estadoResultados(vista, cuentas, asientos, existenciaKardex);
    partida = asientoCierre(vista, cuentas, asientos, anio, existenciaKardex);
  } catch (e) {
    errorCierre = (e as Error).message;
  }

  async function guardar() {
    try {
      await ejecutar("settings", { ...configuracion, ...draft });
      onSaved("Enlaces e inventario final guardados.");
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function ejecutarCierre() {
    if (!partida) return;
    try {
      await ejecutar("settings", { ...configuracion, ...draft });
      await ejecutar("entries", {
        version: 1,
        modoIva: configuracion.modoIva,
        asientos: [partida],
      });
      setConfirmar(false);
      onSaved(`Cierre ${anio} registrado como ${referenciaCierre(anio)}.`);
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  return (
    <section className="border border-zinc-200 bg-white p-6 space-y-4">
      <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-2">
        Enlaces de cuentas y cierre
      </h2>
      <p className="text-xs text-zinc-500">
        Cada renglón del Estado de Resultados necesita saber de qué cuenta sale
        su importe. Los informes no adivinan por código —en un catálogo real
        1102 puede ser Inventarios o Cuentas por cobrar—, así que se toma la
        cuenta que asignes aquí <strong>con todas sus subcuentas</strong>: si
        enlazas el mayor de Devoluciones, entran también sus rebajas. Sin
        asignación se reconoce por el nombre en el catálogo, y solo hace falta
        intervenir cuando el nombre es ambiguo.
      </p>
      {rolesReporte.map(({ rol, titulo }) => {
        const detectada = resolverCuentaReporte(
          rol,
          { ...vista, cuentasReporte: { ...draft.cuentasReporte, [rol]: "" } },
          cuentas,
        );
        return (
          <label key={rol} className="block text-sm">
            {titulo}
            <select
              className="field"
              disabled={ocupado}
              value={draft.cuentasReporte[rol] ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  cuentasReporte: {
                    ...draft.cuentasReporte,
                    [rol]: e.target.value,
                  },
                })
              }
            >
              <option value="">
                {detectada
                  ? `Automática: ${detectada.codigo} · ${detectada.nombre}`
                  : "Sin reconocer: selecciona una cuenta"}
              </option>
              {postables.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.codigo} · {c.nombre}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      <label className="block text-sm border-t border-zinc-100 pt-4">
        Inventario Final Físico ($)
        <input
          className="field"
          inputMode="decimal"
          placeholder={
            existenciaKardex
              ? `Automático desde el Kardex: ${money(existenciaKardex)}`
              : "0.00"
          }
          disabled={ocupado}
          value={draft.inventarioFinalFisico}
          onChange={(e) =>
            setDraft({ ...draft, inventarioFinalFisico: e.target.value })
          }
        />
      </label>
      <p className="text-xs text-zinc-500">
        {existenciaKardex
          ? "Déjalo vacío para usar la existencia que el Kardex calcula del diario. Escribe un importe solo si el conteo físico difiere: entonces manda el conteo y el faltante o sobrante queda dentro del costo de ventas."
          : "Resultado del conteo físico. Sin este dato, o sin un producto en el Kardex, el costo de ventas absorbe toda la mercadería disponible."}
      </p>
      <button className="primary" disabled={ocupado} onClick={() => void guardar()}>
        Guardar enlaces e inventario
      </button>

      <div className="border-t border-zinc-200 pt-4 space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Cierre del ejercicio
        </h3>
        <p className="text-xs text-zinc-500">
          Genera la partida que salda el período: carga las cuentas de ingreso,
          abona las de costo y gasto, deja Inventarios en la existencia final y
          lleva la diferencia a la cuenta de Utilidad del ejercicio. Es un paso
          opcional —el Estado de Resultados y el Balance ya muestran la utilidad
          sin él— y el informe no cambia de importes al ejecutarlo. Queda con la
          referencia CIERRE y se deshace revirtiéndolo en el Libro Diario.
        </p>
        <label className="block text-sm">
          Año a cerrar
          <input
            className="field"
            type="number"
            min={1900}
            max={2200}
            disabled={ocupado}
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
          />
        </label>
        {registrado ? (
          <p className="text-sm">
            Ya existe la partida de cierre #{registrado.numero} (
            {registrado.referencia}). Reviértela en el Libro Diario para volver
            a calcularla.
          </p>
        ) : errorCierre ? (
          <p role="alert" className="text-sm text-amber-800">
            {errorCierre}
          </p>
        ) : (
          resumen &&
          partida && (
            <>
              <table className="data-table text-xs">
                <thead>
                  <tr>
                    <th>Cuenta</th>
                    <th className="text-right">Debe</th>
                    <th className="text-right">Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {partida.detalles.map((d, i) => (
                    <tr key={i}>
                      <td>
                        {d.codigoCuenta} ·{" "}
                        {cuentas.find((c) => c.codigo === d.codigoCuenta)
                          ?.nombre ?? ""}
                      </td>
                      <td className="text-right tabular-nums">
                        {d.debe === "0.00" ? "—" : d.debe}
                      </td>
                      <td className="text-right tabular-nums">
                        {d.haber === "0.00" ? "—" : d.haber}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-sm font-semibold">
                {resumen.utilidadNeta < 0 ? "Pérdida" : "Utilidad"} del
                ejercicio: ${money(Math.abs(resumen.utilidadNeta))}
              </p>
              {confirmar ? (
                <div className="border border-black p-3 space-y-3">
                  <p className="text-sm">
                    Se registrará la partida con fecha {partida.fecha}. El año
                    debe estar abierto.
                  </p>
                  <button
                    className="primary"
                    disabled={ocupado}
                    onClick={() => void ejecutarCierre()}
                  >
                    Confirmar y registrar
                  </button>
                  <button className="ml-4" onClick={() => setConfirmar(false)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button disabled={ocupado} onClick={() => setConfirmar(true)}>
                  Ejecutar Cierre
                </button>
              )}
            </>
          )
        )}
      </div>
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
        <div className="space-y-8">
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
          <p className="text-xs text-zinc-500">
            Un asiento solo se puede registrar si su año existe aquí y está
            abierto. Bloquear un año impide agregarle o modificarle
            movimientos, lo que sirve para congelar un período ya revisado; no
            es lo mismo que el cierre contable, que sí genera una partida.
            Siempre se puede reabrir.
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
          <p className="text-xs text-zinc-500">
            Todo el ejercicio —catálogo, asientos, Kardex y configuración— vive
            en este navegador. Sobrevive a recargas y reinicios, pero no viaja
            a otro equipo ni a otro navegador, y se pierde si borras los datos
            del sitio. Descarga el respaldo antes de cualquier cosa que no
            quieras rehacer. <strong>Iniciar otro ejercicio</strong> archiva el
            actual y abre uno vacío; los archivados se pueden volver a abrir.
          </p>
          <button
            className="primary"
            onClick={() =>
              download("respaldo-contabilidad-local.json", {
                versionAuditoria: 2,
                kardex: s.kardex ?? [],
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
        <EnlacesYCierre
          onSaved={setMessage}
          key={
            "enlaces" +
            JSON.stringify(s.configuracion.cuentasReporte ?? {}) +
            (s.configuracion.inventarioFinalFisico ?? "") +
            s.asientos.length
          }
        />
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
