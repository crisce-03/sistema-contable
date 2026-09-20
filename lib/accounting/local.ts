import type {
  Asiento,
  LibroLocal,
  ConfiguracionLibro,
  AsientoInput,
} from "../types";
import {
  familias,
  parseCatalog,
  parseEntries,
  date,
  cents,
  ledger,
} from "./core";
export const DEFAULT_CONFIG: ConfiguracionLibro = {
  modoIva: "mas_iva",
  modoInventario: "traslados_compras",
};
export function emptyBook(year = new Date().getFullYear()): LibroLocal {
  return {
    versionLocal: 2,
    cuentas: [],
    asientos: [],
    periodos: [{ anio: year, cerrado: false }],
    configuracion: { ...DEFAULT_CONFIG },
  };
}
export function taxBreakdown(
  amount: unknown,
  mode: ConfiguracionLibro["modoIva"],
) {
  const input = cents(amount);
  if (!input) throw new Error("El importe debe ser positivo.");
  if (mode !== "mas_iva" && mode !== "incluido")
    throw new Error("Modo IVA inválido.");
  const base = mode === "mas_iva" ? input : Math.round((input * 100) / 113);
  const iva = mode === "mas_iva" ? Math.round((base * 13) / 100) : input - base;
  return { base, iva, total: base + iva };
}
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Se requiere un objeto.");
  return v as Record<string, unknown>;
}
function requirePeriod(s: LibroLocal, fecha: string) {
  if (
    !s.periodos.some((p) => p.anio === Number(fecha.slice(0, 4)) && !p.cerrado)
  )
    throw new Error(
      "El año no existe o está bloqueado. Ábrelo en Configuración.",
    );
}
function normalized(a: Asiento): AsientoInput {
  return {
    referencia: a.referencia,
    fecha: a.fecha,
    concepto: a.concepto,
    tipo: a.tipo as "normal" | "ajuste",
    modoIva: a.modoIva,
    ajusteInventario: a.ajusteInventario ?? null,
    detalles: a.detalles.map((d) => ({
      codigoCuenta: d.codigoCuenta,
      debe: d.debe.toFixed(2),
      haber: d.haber.toFixed(2),
      descripcion: d.descripcion ?? "",
    })),
  };
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => JSON.stringify(k) + ":" + canonical(x))
        .join(",") +
      "}"
    );
  return JSON.stringify(v);
}
export function localCommand(
  current: LibroLocal,
  action: string,
  data: unknown,
  uuid = () => crypto.randomUUID(),
) {
  // Clone before validation: rejection leaves the entire previous book intact.
  const s = structuredClone(current);
  let insertados = 0,
    omitidos = 0;
  if (action === "catalog") {
    const items = parseCatalog(data, s.cuentas);
    for (const c of items) {
      const parent = s.cuentas.find((p) => p.codigo === c.padreCodigo);
      if (
        parent &&
        s.asientos.some((a) => a.detalles.some((d) => d.cuentaId === parent.id))
      )
        throw new Error(
          "El padre ya tiene movimientos; no puede convertirse en agrupador.",
        );
      const existing = s.cuentas.find((a) => a.codigo === c.codigo),
        f = familias.find((f) => f.id === c.familia)!;
      if (existing) {
        existing.nombre = c.nombre;
        existing.activa = c.activa;
      } else
        s.cuentas.push({
          ...c,
          id: uuid(),
          tipo: f.grupo,
          naturaleza: f.naturaleza as "Deudora" | "Acreedora",
          rubro: f.rubro,
          movimiento: true,
          saldo: 0,
          debe: 0,
          haber: 0,
        });
    }
    s.cuentas = s.cuentas.map((c) => ({
      ...c,
      movimiento: !s.cuentas.some((a) => a.padreCodigo === c.codigo),
    }));
  } else if (action === "entries") {
    const entries = parseEntries(data, s.cuentas, s.configuracion);
    for (const a of entries) {
      const previous = s.asientos.find((p) => p.referencia === a.referencia);
      if (previous) {
        if (canonical(normalized(previous)) === canonical(a)) {
          omitidos++;
          continue;
        }
        throw new Error(
          `La referencia ${a.referencia} ya existe con otro contenido.`,
        );
      }
      requirePeriod(s, a.fecha);
      if (
        a.ajusteInventario &&
        s.asientos.some(
          (p) =>
            p.ajusteInventario === a.ajusteInventario &&
            p.fecha.slice(0, 4) === a.fecha.slice(0, 4) &&
            p.tipo !== "reversion" &&
            !s.asientos.some((r) => r.reversaDe === p.id),
        )
      )
        throw new Error(
          "Ya existe un ajuste de ese inventario en el año. Reviértelo antes de corregirlo.",
        );
      s.asientos.push({
        ...a,
        id: uuid(),
        numero: s.asientos.length + 1,
        cuadra: true,
        detalles: a.detalles.map((d) => ({
          ...d,
          id: uuid(),
          cuentaId: s.cuentas.find((c) => c.codigo === d.codigoCuenta)!.id,
          parcial: 0,
          debe: Number(d.debe),
          haber: Number(d.haber),
        })),
      });
      insertados++;
    }
  } else if (action === "reverse") {
    const d = object(data),
      original = s.asientos.find((a) => a.id === d.id);
    if (
      !original ||
      original.tipo === "reversion" ||
      s.asientos.some((a) => a.reversaDe === original.id)
    )
      throw new Error("Asiento no reversible o ya revertido.");
    const fecha = date(d.fecha);
    requirePeriod(s, fecha);
    if (fecha < original.fecha)
      throw new Error(
        "La fecha de reversión no puede ser anterior al asiento.",
      );
    if (
      typeof d.motivo !== "string" ||
      !d.motivo.trim() ||
      d.motivo.length > 400
    )
      throw new Error("Indique un motivo (máximo 400 caracteres).");
    s.asientos.push({
      ...original,
      id: uuid(),
      numero: s.asientos.length + 1,
      referencia: "REV-" + original.id,
      fecha,
      concepto: "Reversión: " + d.motivo.trim(),
      tipo: "reversion",
      reversaDe: original.id,
      detalles: original.detalles.map((l) => ({
        ...l,
        id: uuid(),
        debe: l.haber,
        haber: l.debe,
      })),
    });
    insertados = 1;
  } else if (action === "period") {
    const d = object(data);
    if (
      typeof d.anio !== "number" ||
      !Number.isInteger(d.anio) ||
      d.anio < 1900 ||
      d.anio > 2200 ||
      typeof d.cerrado !== "boolean"
    )
      throw new Error("Período inválido.");
    const p = s.periodos.find((p) => p.anio === d.anio);
    if (p) p.cerrado = d.cerrado;
    else s.periodos.push({ anio: d.anio, cerrado: d.cerrado });
  } else if (action === "settings") {
    const d = object(data);
    if (
      !["mas_iva", "incluido"].includes(String(d.modoIva)) ||
      !["traslados_compras", "inventarios_explicitos"].includes(
        String(d.modoInventario),
      ) ||
      Object.keys(d).some((k) => !["modoIva", "modoInventario"].includes(k))
    )
      throw new Error("Configuración inválida.");
    if (
      s.asientos.length &&
      (d.modoIva !== s.configuracion.modoIva ||
        d.modoInventario !== s.configuracion.modoInventario)
    )
      throw new Error(
        "El ejercicio ya tiene asientos: su modo de IVA e inventario no se cambia retroactivamente. Inicia otro ejercicio de prueba.",
      );
    s.configuracion = {
      modoIva: d.modoIva,
      modoInventario: d.modoInventario,
    } as ConfiguracionLibro;
  } else if (action !== "init") throw new Error("Acción local no permitida.");
  s.cuentas = ledger(s.cuentas, s.asientos);
  return { estado: s, insertados, omitidos };
}
