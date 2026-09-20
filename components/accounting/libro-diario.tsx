"use client";
import { Wand2, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { canPost, cents, money, parseEntries } from "@/lib/accounting/core";
import { taxBreakdown } from "@/lib/accounting/local";
import JsonImport, { download } from "./json-import";
interface Line {
  codigoCuenta: string;
  debe: string;
  haber: string;
  descripcion: string;
}
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
  const posting = cuentas.filter((c) => canPost(c, cuentas));
  const sums = lines.reduce(
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
    { debe: 0, haber: 0, invalid: false },
  );
  function change(i: number, field: keyof Line, value: string) {
    setLines(lines.map((l, j) => (i === j ? { ...l, [field]: value } : l)));
  }
  async function importEntries(data: unknown) {
    const r = await ejecutar("entries", data);
    return `${r.insertados} asientos guardados; ${r.omitidos} ya existían sin cambios.`;
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const data = {
        version: 1,
        asientos: [
          {
            fecha,
            concepto,
            referencia,
            tipo,
            detalles: lines,
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
        Modo del ejercicio:{" "}
        {configuracion.modoIva === "mas_iva" ? "Más IVA" : "IVA incluido"}. Las
        columnas Debe y Haber siempre reciben importes contables finales: no se
        les vuelve a aplicar IVA.
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
          Registra una línea por cuenta de movimiento. Las subcuentas se
          desglosan con importes propios; no repitas el total en su padre. La
          descripción auxiliar no suma dinero.
        </p>
        <div className="overflow-auto border border-zinc-200 bg-white">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Descripción auxiliar</th>
                <th>Debe</th>
                <th>Haber</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <select
                      aria-label={`Cuenta línea ${i + 1}`}
                      className="field min-w-48"
                      value={l.codigoCuenta}
                      onChange={(e) =>
                        change(i, "codigoCuenta", e.target.value)
                      }
                      required
                    >
                      <option value="">Seleccionar…</option>
                      {posting.map((c) => (
                        <option key={c.id} value={c.codigo}>
                          {c.codigo} · {c.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`Descripción línea ${i + 1}`}
                      className="field"
                      value={l.descripcion}
                      maxLength={200}
                      onChange={(e) => change(i, "descripcion", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Debe línea ${i + 1}`}
                      className="field min-w-24 text-right"
                      inputMode="decimal"
                      value={l.debe}
                      onChange={(e) => change(i, "debe", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Haber línea ${i + 1}`}
                      className="field min-w-24 text-right"
                      inputMode="decimal"
                      value={l.haber}
                      onChange={(e) => change(i, "haber", e.target.value)}
                    />
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
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  {sums.invalid
                    ? "Corrige los importes"
                    : `Diferencia: $${money(Math.abs(sums.debe - sums.haber))}`}
                </td>
                <td className="text-right font-semibold">{money(sums.debe)}</td>
                <td className="text-right font-semibold">
                  {money(sums.haber)}
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
              lines.length < 2
            }
          >
            <span className="flex items-center gap-2">
              <Save size={16} />
              {ocupado ? "Guardando…" : "Guardar asiento"}
            </span>
          </button>
        </div>
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
        <button
          disabled={!asientos.length}
          onClick={() =>
            download("asientos.json", {
              version: 1,
              asientos: asientos
                .filter((a) => a.tipo !== "reversion")
                .map((a) => ({
                  referencia: a.referencia,
                  fecha: a.fecha,
                  concepto: a.concepto,
                  tipo: a.tipo,
                  modoIva: a.modoIva,
                  ajusteInventario: a.ajusteInventario ?? null,
                  detalles: a.detalles.map((d) => ({
                    codigoCuenta: d.codigoCuenta,
                    debe: d.debe.toFixed(2),
                    haber: d.haber.toFixed(2),
                    descripcion: d.descripcion ?? "",
                  })),
                })),
            })
          }
        >
          Exportar normales y ajustes
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        El JSON de importación no incluye reversiones. El respaldo completo de
        auditoría se descarga en Configuración.
      </p>
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
      <JsonImport
        label="Importar asientos JSON"
        busy={ocupado}
        validate={(v) => ({
          version: 1,
          asientos: parseEntries(v, cuentas, configuracion),
        })}
        commit={importEntries}
      />
    </div>
  );
}
