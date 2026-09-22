import type {
  Asiento,
  LibroLocal,
  ConfiguracionLibro,
  AsientoInput,
} from "../types";
import {
  accountClassification,
  baseAccounts,
  parentCode,
  parseCatalog,
  parseEntries,
  date,
  cents,
  ledger,
  canPost,
} from "./core";
export const DEFAULT_CONFIG: ConfiguracionLibro = {
  modoIva: "mas_iva",
  modoInventario: "traslados_compras",
};
export function emptyBook(year = new Date().getFullYear()): LibroLocal {
  return {
    versionLocal: 3,
    cuentas: baseAccounts(),
    asientos: [],
    periodos: [{ anio: year, cerrado: false }],
    configuracion: { ...DEFAULT_CONFIG },
  };
}
function migrateCatalog(s: LibroLocal, uuid: () => string) {
  if (s.versionLocal === 3) return;
  // Keep account IDs and every journal line. Older books could have subaccount
  // roots; supply their missing ancestors only during migration.
  for (const c of [...s.cuentas]) {
    if (!/^(\d{4}|\d{6}|\d{8}|\d{10})$/.test(c.codigo))
      throw new Error(
        `El catálogo anterior contiene ${c.codigo}, fuera de los niveles 4, 6, 8 y 10. Se conservaron los datos sin cambios.`,
      );
    let codigo = parentCode(c.codigo);
    while (codigo.length >= 4) {
      if (!s.cuentas.some((a) => a.codigo === codigo)) {
        const f = accountClassification(codigo);
        if (!f) throw new Error(`No se pudo ubicar la cuenta ${c.codigo}.`);
        s.cuentas.push({
          id: uuid(),
          codigo,
          nombre: codigo === "5101" ? "Ingresos operacionales"
            : codigo === "510104" ? "Rebajas y devoluciones sobre ventas"
            : `Cuenta ${codigo}`,
          familia: f.id,
          tipo: f.grupo,
          naturaleza: f.naturaleza as typeof c.naturaleza,
          rubro: f.rubro,
          padreCodigo: parentCode(codigo),
          activa: true,
          movimiento: false,
          debe: 0,
          haber: 0,
          saldo: 0,
        });
      }
      codigo = parentCode(codigo);
    }
    c.padreCodigo = parentCode(c.codigo);
  }
  s.cuentas.unshift(...baseAccounts());
  s.cuentas = postingFlags(s.cuentas);
  s.versionLocal = 3;
}
function postingFlags(cuentas: LibroLocal["cuentas"]) {
  return cuentas.map((c) => ({
    ...c,
    movimiento: /^(\d{4}|\d{6}|\d{8}|\d{10})$/.test(c.codigo),
  }));
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
export interface JournalDraftLine {
  codigoCuenta: string;
  debe: string;
  haber: string;
  descripcion: string;
  iva?: {
    tipo: "credito" | "debito" | "";
  };
}

export function resolveIvaAccount(
  tipo: "credito" | "debito",
  config: ConfiguracionLibro,
  cuentas: LibroLocal["cuentas"],
) {
  const configured = tipo === "credito" ? config.cuentaIvaCredito : config.cuentaIvaDebito;
  if (configured) return cuentas.find((c) => c.codigo === configured && canPost(c, cuentas));
  const candidates = cuentas.filter((c) => {
    const name = c.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const matches = tipo === "debito" ? name.includes("debito fiscal")
      : name.includes("credito fiscal") && !name.includes("debito fiscal");
    return matches && canPost(c, cuentas);
  });
  // Prefer the named major over its similarly named auxiliaries. Ambiguous
  // catalogs require an explicit assignment, never a guessed code prefix.
  const majors = candidates.filter((c) => c.codigo.length === 4);
  if (majors.length === 1 && candidates.every((c) => c.codigo.startsWith(majors[0].codigo))) return majors[0];
  return candidates.length === 1 ? candidates[0] : undefined;
}

/** Derive final journal amounts without changing the user's source amount.
 * Generated tax lines are never fed back into this calculation.
 */
export function draftLineDetails(line: JournalDraftLine, config: ConfiguracionLibro, cuentas: LibroLocal["cuentas"]) {
  const { codigoCuenta, debe, haber, descripcion, iva } = line;
  const original = { codigoCuenta, debe, haber, descripcion };
  if (!iva) return { detalles: [original], desglose: null };
  const debit = cents(debe), credit = cents(haber);
  if (debit > 0 && credit > 0)
    throw new Error("La línea con IVA debe tener importe en un solo lado.");
  if (!debit && !credit) throw new Error("Ingresa un importe positivo en Debe o Haber.");
  if (iva.tipo !== "credito" && iva.tipo !== "debito")
    throw new Error("Selecciona IVA crédito fiscal o IVA débito fiscal.");
  const taxAccount = resolveIvaAccount(iva.tipo, config, cuentas);
  if (!taxAccount)
    throw new Error(`Asigna una cuenta activa de IVA ${iva.tipo === "credito" ? "crédito" : "débito"} fiscal en Configuración.`);
  if (codigoCuenta === taxAccount.codigo)
    throw new Error("La cuenta de IVA debe ser distinta de la cuenta de la operación.");
  const lado = debit > 0 ? "debe" : "haber";
  const desglose = taxBreakdown(line[lado], config.modoIva);
  const detalles = [{ ...original, [lado]: (desglose.base / 100).toFixed(2) }];
  if (desglose.iva > 0) detalles.push({
    codigoCuenta: taxAccount.codigo,
    debe: lado === "debe" ? (desglose.iva / 100).toFixed(2) : "0.00",
    haber: lado === "haber" ? (desglose.iva / 100).toFixed(2) : "0.00",
    descripcion: `IVA 13% de ${codigoCuenta}`,
  });
  return { detalles, desglose };
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
  migrateCatalog(s, uuid);
  let insertados = 0,
    omitidos = 0;
  if (action === "catalog") {
    const items = parseCatalog(data, s.cuentas);
    for (const c of items) {
      const existing = s.cuentas.find((a) => a.codigo === c.codigo),
        f = accountClassification(c.codigo)!;
      if (existing) {
        existing.nombre = c.nombre;
        existing.activa = c.activa;
      } else {
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
        insertados++;
      }
    }
    s.cuentas = postingFlags(s.cuentas);
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
      Object.keys(d).some((k) => !["modoIva", "modoInventario", "cuentaIvaCredito", "cuentaIvaDebito"].includes(k))
    )
      throw new Error("Configuración inválida.");
    const ivaAccounts: Pick<ConfiguracionLibro, "cuentaIvaCredito" | "cuentaIvaDebito"> = {};
    for (const key of ["cuentaIvaCredito", "cuentaIvaDebito"] as const) {
      const code = key in d ? d[key] : s.configuracion[key];
      if (code === undefined) continue;
      if (typeof code !== "string" || (code !== "" && !s.cuentas.some((c) => c.codigo === code && canPost(c, s.cuentas))))
        throw new Error("Selecciona una cuenta activa de 4, 6, 8 o 10 dígitos para el IVA.");
      ivaAccounts[key] = code;
    }
    if (ivaAccounts.cuentaIvaCredito && ivaAccounts.cuentaIvaCredito === ivaAccounts.cuentaIvaDebito)
      throw new Error("Usa cuentas distintas para IVA crédito fiscal e IVA débito fiscal.");
    if (
      s.asientos.length &&
      d.modoInventario !== s.configuracion.modoInventario
    )
      throw new Error(
        "El ejercicio ya tiene asientos: su tratamiento de inventarios no se cambia retroactivamente. Inicia otro ejercicio de prueba.",
      );
    s.configuracion = {
      ...ivaAccounts,
      modoIva: d.modoIva,
      modoInventario: d.modoInventario,
    } as ConfiguracionLibro;
  } else if (action !== "init") throw new Error("Acción local no permitida.");
  s.cuentas = ledger(postingFlags(s.cuentas), s.asientos);
  return { estado: s, insertados, omitidos };
}
