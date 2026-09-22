"use client";
import { Download, Wand2, Save, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { canPost, cents, money, parseEntries } from "@/lib/accounting/core";
import { draftLineDetails, taxBreakdown, type JournalDraftLine } from "@/lib/accounting/local";
import JsonImport, { download } from "./json-import";
import JournalAccountSelector from "./journal-account-selector";
import type { ModoIva } from "@/lib/types";
type Line = JournalDraftLine;
const blank = (): Line => ({
  codigoCuenta: "",
  debe: "0.00",
  haber: "0.00",
  descripcion: "",
});
export default function LibroDiario() {
  const { cuentas, asientos, ejecutar, ocupado, configuracion } =
    useAccountingStore();
  const [fecha, setFecha] = useState(new Date().toLocaleDateString("sv-SE")),
    [concepto, setConcepto] = useState(""),
    [referencia, setReferencia] = useState(""),
    [tipo, setTipo] = useState<"normal" | "ajuste">("normal"),
    [lines, setLines] = useState<Line[]>([blank(), blank()]),
    [message, setMessage] = useState("");
  const [reverseId, setReverseId] = useState(""),
    [reason, setReason] = useState(""),
    [reverseDate, setReverseDate] = useState(fecha);
  const [assist, setAssist] = useState(false),
    [operation, setOperation] = useState("compras"),
    [total, setTotal] = useState(""),
    [main, setMain] = useState(""),
    [iva, setIva] = useState(""),
    [payment, setPayment] = useState("");
  const [ajusteInventario, setAjusteInventario] = useState<
    "inicial" | "final" | ""
  >("");
  const posting = cuentas.filter((c) => canPost(c, cuentas))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const exportable = asientos.filter((a) => a.tipo !== "reversion");
  const exportGroups = (["incluido", "mas_iva"] as const).map((modoIva) => ({
    modoIva,
    label: modoIva === "incluido" ? "IVA incluido" : "Más IVA",
    entries: exportable.filter((a) => (a.modoIva ?? configuracion.modoIva) === modoIva),
  })).filter((group) => group.entries.length > 0);
  function downloadEntries(mode: ModoIva) {
    const group = exportGroups.find((g) => g.modoIva === mode);
    if (!group) return;
    download(mode === "incluido" ? "asientos-iva-incluido.json" : "asientos-mas-iva.json", {
      version: 1,
      modoIva: mode,
      asientos: group.entries.map((a) => ({
        referencia: a.referencia,
        fecha: a.fecha,
        concepto: a.concepto,
        tipo: a.tipo,
        modoIva: mode,
        ajusteInventario: a.ajusteInventario ?? null,
        detalles: a.detalles.map((d) => ({
          codigoCuenta: d.codigoCuenta,
          debe: d.debe.toFixed(2),
          haber: d.haber.toFixed(2),
          descripcion: d.descripcion ?? "",
        })),
      })),
    });
  }
  const calculated = lines.map((line) => {
    try {
      return { ...draftLineDetails(line, configuracion, cuentas), error: "" };
    } catch (e) {
      return { detalles: [], desglose: null, error: (e as Error).message };
    }
  });
  const finalLines = calculated.flatMap((line) => line.detalles);
  const sums = finalLines.reduce(
    (s, l) => {
      try {
        return {
          debe: s.debe + cents(l.debe),
          haber: s.haber + cents(l.haber),
          invalid: s.invalid,
        };
      } catch {
        return { ...s, invalid: true };
      }
    },
    { debe: 0, haber: 0, invalid: calculated.some((line) => !!line.error) },
  );
  function change(i: number, field: "codigoCuenta" | "debe" | "haber" | "descripcion", value: string) {
    setLines((current) => current.map((l, j) => (i === j ? { ...l, [field]: value } : l)));
  }
  function toggleIva(i: number, enabled: boolean) {
    setLines((current) => current.map((line, j) => {
      if (i !== j) return line;
      if (!enabled) return { ...line, iva: undefined };
      return { ...line, iva: { tipo: "" } };
    }));
  }
  function changeIva(i: number, patch: Partial<NonNullable<Line["iva"]>>) {
    setLines((current) => current.map((line, j) => {
      if (i !== j || !line.iva) return line;
      return { ...line, iva: { ...line.iva, ...patch } };
    }));
  }
  async function importEntries(data: unknown) {
    const r = await ejecutar("entries", {
      version: 1,
      asientos: parseEntries(data, cuentas, configuracion, true),
    });
    return `${r.insertados} asientos guardados; ${r.omitidos} ya existían sin cambios.`;
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const invalid = calculated.find((line) => line.error);
      if (invalid) throw new Error(invalid.error);
      const data = {
        version: 1,
        asientos: [
          {
            fecha,
            concepto,
            referencia,
            tipo,
            detalles: finalLines,
            modoIva: configuracion.modoIva,
            ajusteInventario: ajusteInventario || null,
          },
        ],
      };
      const checked = parseEntries(data, cuentas, configuracion);
      setMessage(await importEntries({ version: 1, asientos: checked }));
      setLines([blank(), blank()]);
      setConcepto("");
      setReferencia("");
      setAjusteInventario("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function generate() {
    try {
      const t = cents(total);
      if (!t || !main || !iva || !payment)
        throw new Error("Seleccione las tres cuentas y un total positivo.");
      const {
        base: net,
        iva: tax,
        total: grandTotal,
      } = taxBreakdown(total, configuracion.modoIva);
      const sale = operation === "ventas";
      const proposed = [
        {
          codigoCuenta: main,
          debe: money(sale ? 0 : net),
          haber: money(sale ? net : 0),
          descripcion: "",
        },
        {
          codigoCuenta: iva,
          debe: money(sale ? 0 : tax),
          haber: money(sale ? tax : 0),
          descripcion: "",
        },
        {
          codigoCuenta: payment,
          debe: money(sale ? grandTotal : 0),
          haber: money(sale ? 0 : grandTotal),
          descripcion: "",
        },
      ];
      setLines(proposed.filter((l) => cents(l.debe) > 0 || cents(l.haber) > 0));
      setTipo("normal");
      setAjusteInventario("");
      setMessage(
        "Borrador generado. Revisa el documento, el IVA y las cuentas antes de guardar.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const selector = (
    value: string,
    set: (s: string) => void,
    families: string[],
    label: string,
  ) => (
    <select
      aria-label={label}
      className="field"
      value={value}
      onChange={(e) => set(e.target.value)}
    >
      <option value="">Seleccionar cuenta</option>
      {posting
        .filter((c) => families.includes(c.familia))
        .map((c) => (
          <option key={c.id} value={c.codigo}>
            {c.codigo} · {c.nombre}
          </option>
        ))}
    </select>
  );
  return (
    <div className="accounting-original diary-original max-w-5xl mx-auto space-y-6 font-sans text-zinc-900 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Registro de Asientos
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Ingreso ágil y validación de partida doble.
          </p>
        </div>
        <button
          onClick={() => setAssist(!assist)}
          aria-label={
            assist
              ? "Ocultar asistente de compra / venta"
              : "Abrir asistente de compra / venta"
          }
          className="flex items-center gap-2 border border-zinc-300 bg-white px-3 py-1.5 text-xs rounded-sm hover:bg-zinc-50"
        >
          <Wand2 size={14} /> Asistente Fiscal Automático
        </button>
      </header>
      <section aria-label="Descargar asientos registrados" className="border border-zinc-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {exportGroups.map((group) => (
            <button
              key={group.modoIva}
              type="button"
              className="primary flex items-center gap-2"
              disabled={ocupado}
              onClick={() => downloadEntries(group.modoIva)}
            >
              <Download size={16} aria-hidden="true" />
              Descargar asientos (JSON) · {group.label} ({group.entries.length})
            </button>
          ))}
          {!exportGroups.length && (
            <button type="button" className="primary flex items-center gap-2" disabled>
              <Download size={16} aria-hidden="true" /> Descargar asientos (JSON)
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          {exportable.length
            ? "Descarga los asientos normales y ajustes registrados, incluidos los ingresados por JSON. Cada archivo corresponde a un modo de IVA; para importarlo, activa ese mismo modo en Configuración."
            : "Guarda o importa asientos para habilitar la descarga."}
          {" "}El respaldo completo con reversiones se descarga en Configuración.
        </p>
      </section>
      {assist && (
        <section className="p-6 border border-blue-200 bg-blue-50 space-y-3">
          <h2 className="font-medium">
            Borrador al contado o a crédito · IVA del ejercicio: 13%
          </h2>
          <p className="text-xs">
            {configuracion.modoIva === "mas_iva"
              ? "El importe es la base: se suma el 13% de IVA."
              : "El importe es el total: se separa el IVA incluido."}{" "}
            No calcula retenciones, exenciones ni pagos mixtos. Se reemplazan
            las líneas del borrador.
          </p>
          <div className="grid md:grid-cols-5 gap-3">
            <label className="text-sm">
              Operación
              <select
                className="field"
                aria-label="Operación"
                value={operation}
                onChange={(e) => {
                  setOperation(e.target.value);
                  setMain("");
                  setIva("");
                  setPayment("");
                }}
              >
                <option value="compras">Compra de mercadería</option>
                <option value="ventas">Venta</option>
                <option value="gastos_venta">Gasto de Venta</option>
                <option value="administrativos">Gasto administrativo</option>
                <option value="ppe">Compra de equipo</option>
                <option value="financieros">
                  Gasto financiero gravado del ejercicio
                </option>
              </select>
            </label>
            <label className="text-sm">
              {configuracion.modoIva === "mas_iva"
                ? "Importe sin IVA"
                : "Total con IVA"}
              <input
                className="field"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <label className="text-sm">
              Cuenta de la operación
              {selector(main, setMain, [operation], "Cuenta de la operación")}
            </label>
            <label className="text-sm">
              IVA
              {selector(
                iva,
                setIva,
                [operation === "ventas" ? "iva_debito" : "iva_credito"],
                "IVA",
              )}
            </label>
            <label className="text-sm">
              Pago / crédito
              {selector(
                payment,
                setPayment,
                ["efectivo", operation === "ventas" ? "cobrar" : "pagar"],
                "Pago / crédito",
              )}
            </label>
          </div>
          <button type="button" className="primary" onClick={generate}>
            Generar borrador
          </button>
        </section>
      )}
      <p className="text-xs text-zinc-600">
        Modo para nuevos asientos y el asistente:{" "}
        {configuracion.modoIva === "mas_iva" ? "Más IVA" : "IVA incluido"}. Las
        columnas Debe y Haber reciben el importe de la operación. Marca
        Calcular IVA solo en las líneas que lo necesitan. Selecciona una cuenta de 4 dígitos en cada
        línea. Puedes detallar con subcuentas de 6, 8 y 10 dígitos; son opcionales.
      </p>
      <form onSubmit={save} className="entry-form space-y-6">
        <div className="journal-header grid md:grid-cols-4 gap-6 border border-zinc-200 bg-white p-6">
          <label className="text-sm">
            Fecha
            <input
              required
              type="date"
              className="field"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Referencia única
            <input
              required
              maxLength={100}
              className="field"
              placeholder="Ej. ENE-2026-001"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Tipo
            <select
              className="field"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as "normal" | "ajuste");
                setAjusteInventario("");
              }}
            >
              <option value="normal">Normal</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </label>
          <label className="text-sm">
            Concepto
            <input
              required
              maxLength={500}
              className="field"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
          </label>
        </div>
        {tipo === "ajuste" && (
          <label className="block text-sm max-w-md">
            Tratamiento del ajuste
            <select
              className="field"
              value={ajusteInventario}
              onChange={(e) =>
                setAjusteInventario(e.target.value as "" | "inicial" | "final")
              }
            >
              <option value="">Otro ajuste</option>
              {configuracion.modoInventario === "traslados_compras" && (
                <>
                  <option value="inicial">
                    Inventario inicial: Debe Compras / Haber Inventarios
                  </option>
                  <option value="final">
                    Inventario final: Debe Inventarios / Haber Compras
                  </option>
                </>
              )}
            </select>
          </label>
        )}
        <p className="text-xs text-zinc-600">
          El importe se registra una sola vez, en el último nivel elegido, y
          se acumula en su cuenta de mayor de 4 dígitos. La descripción auxiliar
          no suma dinero. Ingresa el importe en Debe o Haber. Con IVA incluido
          se separa el impuesto del total; con Más IVA se agrega el 13%. La base
          a guardar aparece debajo del importe y el IVA en una fila del mismo lado. Completa la
          contrapartida de caja, banco o crédito hasta que la diferencia sea cero.
        </p>
        <div className="overflow-auto border border-zinc-200 bg-white">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Descripción auxiliar</th>
                <th>Debe · importe ingresado</th>
                <th>Haber · importe ingresado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <Fragment key={i}>
                <tr>
                  <td>
                    <JournalAccountSelector
                      accounts={posting}
                      lineNumber={i + 1}
                      value={l.codigoCuenta}
                      onChange={(code) =>
                        change(i, "codigoCuenta", code)
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Descripción línea ${i + 1}`}
                      className="field"
                      value={l.descripcion}
                      maxLength={200}
                      onChange={(e) => change(i, "descripcion", e.target.value)}
                    />
                    <label className="mt-3 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        aria-label={`Calcular IVA línea ${i + 1}`}
                        checked={!!l.iva}
                        onChange={(e) => toggleIva(i, e.target.checked)}
                      />
                      Calcular IVA (13%)
                    </label>
                    {l.iva && (
                      <div className="mt-3 min-w-72 space-y-3 border border-blue-200 bg-blue-50 p-3 text-xs">
                        <label className="block">
                          Tipo de IVA
                          <select
                            className="field"
                            aria-label={`Tipo de IVA línea ${i + 1}`}
                            value={l.iva.tipo}
                            required
                            onChange={(e) => changeIva(i, { tipo: e.target.value as "credito" | "debito" | "" })}
                          >
                            <option value="">Seleccionar…</option>
                            <option value="credito">IVA crédito fiscal</option>
                            <option value="debito">IVA débito fiscal</option>
                          </select>
                        </label>
                        <p>{configuracion.modoIva === "incluido"
                          ? "IVA incluido: el importe ingresado es el total con impuesto."
                          : "Más IVA: al importe ingresado se le suma el 13%."}</p>
                        {calculated[i].error ? (
                          <p role="status" className="text-red-700">{calculated[i].error}</p>
                        ) : calculated[i].desglose && (
                          <p role="status">
                            Base: ${money(calculated[i].desglose.base)} · IVA: ${money(calculated[i].desglose.iva)} · Total: ${money(calculated[i].desglose.total)}
                          </p>
                        )}
                        <p>Al desmarcar, se conserva el importe ingresado y se retira el IVA generado.</p>
                      </div>
                    )}
                  </td>
                  <td>
                    <input
                      aria-label={`Debe línea ${i + 1}`}
                      className="field min-w-24 text-right"
                      inputMode="decimal"
                      value={l.debe}
                      onChange={(e) => change(i, "debe", e.target.value)}
                    />
                    {l.iva && calculated[i].desglose && Number(l.debe) > 0 && (
                      <p className="mt-1 text-xs text-blue-800">Base a guardar: ${money(calculated[i].desglose.base)}</p>
                    )}
                  </td>
                  <td>
                    <input
                      aria-label={`Haber línea ${i + 1}`}
                      className="field min-w-24 text-right"
                      inputMode="decimal"
                      value={l.haber}
                      onChange={(e) => change(i, "haber", e.target.value)}
                    />
                    {l.iva && calculated[i].desglose && Number(l.haber) > 0 && (
                      <p className="mt-1 text-xs text-blue-800">Base a guardar: ${money(calculated[i].desglose.base)}</p>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label={`Eliminar línea ${i + 1}`}
                      onClick={() => setLines(lines.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
                {l.iva && calculated[i].detalles[1] && (
                  <tr className="text-blue-800">
                    <td>
                      <span className="block font-medium">IVA automático · línea {i + 1}</span>
                      {calculated[i].detalles[1].codigoCuenta} · {posting.find((c) => c.codigo === calculated[i].detalles[1].codigoCuenta)?.nombre}
                    </td>
                    <td className="text-xs">Se actualiza con el importe de la operación.</td>
                    <td className="text-right">{calculated[i].detalles[1].debe}</td>
                    <td className="text-right">{calculated[i].detalles[1].haber}</td>
                    <td />
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  {sums.invalid
                    ? "Corrige los importes"
                    : `Diferencia: $${money(Math.abs(sums.debe - sums.haber))}`}
                </td>
                <td className="text-right font-semibold"><span className="block text-xs">Debe a guardar</span>{money(sums.debe)}</td>
                <td className="text-right font-semibold">
                  <span className="block text-xs">Haber a guardar</span>{money(sums.haber)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex justify-between items-center gap-4 border-t border-zinc-200 pt-4 text-sm">
          <button
            type="button"
            disabled={lines.length >= 200}
            onClick={() => setLines([...lines, blank()])}
          >
            + Agregar línea
          </button>
          <button
            className="primary"
            disabled={
              ocupado ||
              sums.invalid ||
              sums.debe !== sums.haber ||
              sums.debe === 0 ||
              finalLines.length < 2 || finalLines.length > 200 ||
              finalLines.some((l) => !posting.some((c) => c.codigo === l.codigoCuenta))
            }
          >
            <span className="flex items-center gap-2">
              <Save size={16} />
              {ocupado ? "Guardando…" : "Guardar asiento"}
            </span>
          </button>
        </div>
        {finalLines.length > 200 && (
          <p role="status" className="text-sm text-red-700">
            El asiento supera las 200 líneas permitidas, contando las de IVA automático.
          </p>
        )}
      </form>
      {message && (
        <p role="status" className="text-sm whitespace-pre-wrap">
          {message}
        </p>
      )}
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">
          Diario registrado ({asientos.length})
        </h2>
      </div>
      {!asientos.length && (
        <p className="text-sm p-6 border border-dashed text-center">
          Todavía no hay asientos.
        </p>
      )}
      {[...asientos].reverse().map((a) => (
        <details key={a.id} className="border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer text-sm">
            #{a.numero} · {a.fecha} · {a.referencia} · {a.concepto} · {a.tipo}
            {asientos.some((r) => r.reversaDe === a.id) ? " · Revertido" : ""}
          </summary>
          <div className="overflow-auto">
            <table className="data-table mt-3">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Auxiliar</th>
                  <th>Debe</th>
                  <th>Haber</th>
                </tr>
              </thead>
              <tbody>
                {a.detalles.map((d) => (
                  <tr key={d.id}>
                    <td>
                      {d.codigoCuenta} ·{" "}
                      {cuentas.find((c) => c.id === d.cuentaId)?.nombre}
                    </td>
                    <td>{d.descripcion}</td>
                    <td>{d.debe.toFixed(2)}</td>
                    <td>{d.haber.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {a.tipo !== "reversion" &&
            !asientos.some((r) => r.reversaDe === a.id) && (
              <button
                className="mt-3 text-sm text-red-700"
                onClick={() => setReverseId(a.id)}
              >
                Preparar reversión
              </button>
            )}
        </details>
      ))}
      {reverseId && (
        <form
          className="border border-red-200 p-5 space-y-3 bg-white"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await ejecutar("reverse", {
                id: reverseId,
                fecha: reverseDate,
                motivo: reason,
              });
              setReverseId("");
              setReason("");
              setMessage(
                "Reversión registrada. Se conserva el asiento original.",
              );
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          <h3 className="font-semibold">
            Reversión del asiento #
            {asientos.find((a) => a.id === reverseId)?.numero}
          </h3>
          <p className="text-sm">
            Se creará otro asiento con Debe y Haber intercambiados, sin borrar
            el original.
          </p>
          <label>
            Fecha
            <input
              className="field"
              type="date"
              required
              value={reverseDate}
              onChange={(e) => setReverseDate(e.target.value)}
            />
          </label>
          <label>
            Motivo
            <input
              className="field"
              required
              maxLength={400}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button className="primary" disabled={ocupado}>
            Registrar reversión
          </button>
          <button
            type="button"
            className="ml-4"
            onClick={() => setReverseId("")}
          >
            Cancelar
          </button>
        </form>
      )}
      <p className="text-sm text-zinc-600">
        El JSON debe declarar modoIva y coincidir con el modo activo en
        Configuración: {configuracion.modoIva === "incluido" ? "IVA incluido" : "Más IVA"}.
        Se conservan sus importes finales. Las cuentas deben existir en el
        Catálogo y el año debe estar abierto.
      </p>
      <JsonImport
        label="Importar asientos JSON"
        busy={ocupado}
        validate={(v) => ({
          version: 1,
          asientos: parseEntries(v, cuentas, configuracion, true),
        })}
        commit={importEntries}
      />
    </div>
  );
}
