import definitions from "./families.json";
import classifications from "./classifications.json";
import type {
  Cuenta,
  CuentaInput,
  Asiento,
  AsientoInput,
  ConfiguracionLibro,
} from "../types";
export const familias = definitions;
const classificationPrefixes = [...classifications].sort(
  (a, b) => b.codigo.length - a.codigo.length,
);
// Classification supports the existing journal assistants; it does not create
// accounts or restrict the four-digit codes that a user can register.
export function accountClassification(codigo: string) {
  return (
    classificationPrefixes.find((f) => codigo.startsWith(f.codigo)) ??
    familias.find((f) => f.codigo === codigo.slice(0, 2))
  );
}
export function baseAccounts(): Cuenta[] {
  return familias.map((f) => ({
    id: `base-${f.codigo}`,
    codigo: f.codigo,
    nombre: f.nombre,
    familia: f.id,
    tipo: f.grupo,
    naturaleza: f.naturaleza as Cuenta["naturaleza"],
    rubro: f.rubro,
    padreCodigo: f.codigo.length === 1 ? null : f.codigo[0],
    activa: true,
    movimiento: false,
    debe: 0,
    haber: 0,
    saldo: 0,
  }));
}
export function parentCode(codigo: string) {
  return codigo.slice(0, codigo.length - 2);
}
export function cents(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number")
    throw new Error("El importe debe ser texto decimal o número.");
  const s = String(value);
  if (!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(s))
    throw new Error(
      `Importe inválido: ${s}. Use hasta 2 decimales, sin signos ni separadores de miles.`,
    );
  const [whole, dec = ""] = s.split(".");
  return Number(whole) * 100 + Number(dec.padEnd(2, "0"));
}
export const money = (n: number) => (n / 100).toFixed(2);
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Se esperaba un objeto JSON.");
  return v as Record<string, unknown>;
}
function keys(v: Record<string, unknown>, allowed: string[]) {
  for (const k of Object.keys(v))
    if (!allowed.includes(k)) throw new Error(`Campo no permitido: ${k}`);
}
function str(v: unknown, label: string, max = 500): string {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw new Error(`${label}: texto requerido (máximo ${max}).`);
  return v.trim();
}
export function date(v: unknown): string {
  const s = str(v, "Fecha", 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    Number(s.slice(0, 4)) < 1900 ||
    Number(s.slice(0, 4)) > 2200 ||
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s
  )
    throw new Error("Fecha inválida. Use AAAA-MM-DD (1900–2200).");
  return s;
}
export function parseCatalog(
  value: unknown,
  existing: Cuenta[] = [],
): CuentaInput[] {
  const root = obj(value);
  keys(root, ["version", "cuentas"]);
  if (
    root.version !== 1 ||
    !Array.isArray(root.cuentas) ||
    !root.cuentas.length ||
    root.cuentas.length > 1000
  )
    throw new Error("Catálogo v1: incluya entre 1 y 1000 cuentas.");
  const seen = new Set<string>();
  const items = root.cuentas.map((raw): CuentaInput => {
    const r = obj(raw);
    keys(r, ["codigo", "nombre", "familia", "padreCodigo", "activa"]);
    const codigo = str(r.codigo, "Código", 14);
    if (!/^(\d{4}|\d{6}|\d{8}|\d{10})$/.test(codigo) || seen.has(codigo))
      throw new Error(
        `Código inválido o repetido: ${codigo}. Use 4, 6, 8 o 10 dígitos; los niveles de 1 y 2 son predefinidos.`,
      );
    seen.add(codigo);
    const f = accountClassification(codigo);
    if (
      !f ||
      (r.familia !== undefined && r.familia !== f.id && r.familia !== codigo.slice(0, 2))
    )
      throw new Error(`Familia o prefijo incompatible: ${codigo}`);
    if (typeof r.activa !== "boolean")
      throw new Error("activa debe ser true o false.");
    const padreCodigo =
      r.padreCodigo === undefined || (r.padreCodigo === null && codigo.length === 4)
        ? parentCode(codigo)
        : str(r.padreCodigo, "Código padre", 8);
    if (padreCodigo !== parentCode(codigo))
      throw new Error(
        `Padre incompatible: ${codigo}. Debe ser ${parentCode(codigo)} (jerarquía 2 → 4 → 6 → 8 → 10).`,
      );
    const prev = existing.find((c) => c.codigo === codigo);
    if (prev && (prev.familia !== f.id || prev.padreCodigo !== padreCodigo))
      throw new Error(
        "No se puede reclasificar ni mover una cuenta existente.",
      );
    return {
      codigo,
      nombre: str(r.nombre, "Nombre", 160),
      familia: f.id,
      padreCodigo,
      activa: r.activa,
    };
  });
  const all = new Map(
    [...baseAccounts(), ...existing, ...items].map((c) => [c.codigo, c]),
  );
  for (const c of items)
    if (c.padreCodigo !== null) {
      const parent = all.get(c.padreCodigo);
      if (!parent || parent.codigo !== parentCode(c.codigo))
        throw new Error(`Padre inexistente o incompatible: ${c.codigo}`);
    }
  return items.sort(
    (a, b) =>
      a.codigo.length - b.codigo.length || a.codigo.localeCompare(b.codigo),
  );
}
export function canPost(c: Cuenta, all: Cuenta[]) {
  if (
    !/^(\d{4}|\d{6}|\d{8}|\d{10})$/.test(c.codigo) ||
    !c.activa
  ) return false;
  let current: Cuenta | undefined = c;
  // A line may stop at any level from four digits onwards, even with children.
  // Every immediate ancestor must exist and be active, including its major.
  while (current.codigo.length > 1) {
    const expected: string = current.codigo.length === 2
      ? current.codigo.slice(0, 1)
      : parentCode(current.codigo);
    if (current.padreCodigo !== expected) return false;
    current = all.find((a) => a.codigo === expected);
    if (!current?.activa) return false;
  }
  return current.padreCodigo === null;
}
/** Resolve the actual catalog ancestry, independently of classification. */
export function majorAccount(c: Cuenta, all: Cuenta[]): Cuenta | undefined {
  let current: Cuenta | undefined = c;
  const seen = new Set<string>();
  while (current && current.codigo.length > 4) {
    if (seen.has(current.codigo)) return undefined;
    seen.add(current.codigo);
    current = all.find((a) => a.codigo === current?.padreCodigo);
  }
  return current?.codigo.length === 4 ? current : undefined;
}
/** Only four-digit accounts receive consolidated balances, once per line. */
export function majorLedger(cuentas: Cuenta[], asientos: Asiento[]): Cuenta[] {
  const owners = new Map(cuentas.map((c) => [c.id, majorAccount(c, cuentas)]));
  const consolidated = asientos.map((a) => ({
    ...a,
    detalles: a.detalles.map((d) => {
      const owner = owners.get(d.cuentaId);
      if (!owner)
        throw new Error(`La cuenta ${d.codigoCuenta} no tiene una cuenta de mayor de 4 dígitos.`);
      return { ...d, cuentaId: owner.id };
    }),
  }));
  return ledger(cuentas.filter((c) => c.codigo.length === 4), consolidated);
}
export function parseEntries(
  value: unknown,
  accounts: Cuenta[],
  config?: ConfiguracionLibro,
  requireIvaMode = false,
): AsientoInput[] {
  const root = obj(value);
  keys(root, ["version", "asientos", "modoIva"]);
  if (
    root.modoIva !== undefined &&
    root.modoIva !== "mas_iva" && root.modoIva !== "incluido"
  )
    throw new Error("Modo de IVA del archivo inválido: use mas_iva o incluido.");
  const ivaMismatch = "El modo de IVA del JSON no coincide con el activo en Configuración. Cambia y guarda la configuración antes de importar.";
  if (config && root.modoIva !== undefined && root.modoIva !== config.modoIva)
    throw new Error(ivaMismatch);
  if (
    root.version !== 1 ||
    !Array.isArray(root.asientos) ||
    !root.asientos.length ||
    root.asientos.length > 500
  )
    throw new Error("Asientos v1: incluya entre 1 y 500 asientos.");
  const refs = new Set<string>();
  return root.asientos.map((raw, index) => {
    try {
      const a = obj(raw);
      keys(a, [
        "referencia",
        "fecha",
        "concepto",
        "tipo",
        "detalles",
        "modoIva",
        "ajusteInventario",
      ]);
      if (
        a.modoIva !== undefined &&
        a.modoIva !== "mas_iva" && a.modoIva !== "incluido"
      ) throw new Error("Modo de IVA del asiento inválido.");
      if (requireIvaMode && a.modoIva === undefined && root.modoIva === undefined)
        throw new Error("El JSON debe declarar modoIva: mas_iva o incluido, en el archivo o en cada asiento.");
      if (config && a.modoIva !== undefined && a.modoIva !== config.modoIva)
        throw new Error(ivaMismatch);
      if (
        root.modoIva !== undefined && a.modoIva !== undefined &&
        a.modoIva !== root.modoIva
      )
        throw new Error(
          "El modo de IVA del asiento no coincide con el declarado en el archivo.",
        );
      if (
        a.ajusteInventario !== undefined &&
        a.ajusteInventario !== null &&
        a.ajusteInventario !== "inicial" &&
        a.ajusteInventario !== "final"
      )
        throw new Error("Etiqueta de inventario inválida.");
      const referencia = str(a.referencia, "Referencia", 100);
      if (refs.has(referencia))
        throw new Error("Referencia repetida dentro del archivo.");
      refs.add(referencia);
      if (a.tipo !== "normal" && a.tipo !== "ajuste")
        throw new Error("Tipo permitido: normal o ajuste.");
      if (
        !Array.isArray(a.detalles) ||
        a.detalles.length < 2 ||
        a.detalles.length > 200
      )
        throw new Error("Debe contener entre 2 y 200 líneas.");
      let debit = 0,
        credit = 0;
      const detalles = a.detalles.map((raw) => {
        const d = obj(raw);
        keys(d, ["codigoCuenta", "debe", "haber", "descripcion"]);
        const codigoCuenta = str(d.codigoCuenta, "Cuenta", 14);
        const c = accounts.find((c) => c.codigo === codigoCuenta);
        if (!c || !canPost(c, accounts))
          throw new Error(
            `Cuenta inexistente, inactiva o sin jerarquía válida desde una cuenta de 4 dígitos: ${codigoCuenta}`,
          );
        const debe = cents(d.debe),
          haber = cents(d.haber);
        if (debe > 0 === haber > 0)
          throw new Error(
            "Cada línea debe tener un importe positivo en un solo lado.",
          );
        debit += debe;
        credit += haber;
        const descripcion =
          d.descripcion === undefined || d.descripcion === ""
            ? ""
            : str(d.descripcion, "Descripción", 200);
        return {
          codigoCuenta,
          debe: money(debe),
          haber: money(haber),
          descripcion,
        };
      });
      if (debit !== credit || !debit)
        throw new Error(
          `No cuadra: Debe ${money(debit)} / Haber ${money(credit)}.`,
        );
      if (config) {
        const fs = detalles.map(
          (d) => accounts.find((c) => c.codigo === d.codigoCuenta)!.familia,
        );
        const transfer =
          fs.includes("compras") &&
          fs.includes("inventarios") &&
          fs.every((f) => f === "compras" || f === "inventarios");
        if (transfer && config.modoInventario !== "traslados_compras")
          throw new Error(
            "El modo de inventarios explícitos no permite los traspasos entre Compras e Inventarios.",
          );
        if (transfer && (!a.ajusteInventario || a.tipo !== "ajuste"))
          throw new Error(
            "Identifique el traspaso como ajuste de inventario inicial o final.",
          );
        if (a.ajusteInventario) {
          if (!transfer || detalles.length !== 2 || a.tipo !== "ajuste")
            throw new Error(
              "El ajuste de inventario requiere dos líneas: Compras e Inventarios.",
            );
          const purchase = detalles.find(
            (d) =>
              accounts.find((c) => c.codigo === d.codigoCuenta)!.familia ===
              "compras",
          )!;
          if (
            (a.ajusteInventario === "inicial" && cents(purchase.debe) === 0) ||
            (a.ajusteInventario === "final" && cents(purchase.haber) === 0)
          )
            throw new Error(
              "El sentido del ajuste de inventario es incorrecto.",
            );
        }
      }
      const modoIva = (a.modoIva ?? root.modoIva ?? config?.modoIva) as
        ConfiguracionLibro["modoIva"] | undefined;
      return {
        // JSON amounts are final: preserve the declared mode through preview
        // and commit; both stages check against the active configuration.
        ...(modoIva !== undefined ? { modoIva } : {}),
        ...(config
          ? {
              ajusteInventario: (a.ajusteInventario ?? null) as
                | "inicial"
                | "final"
                | null,
            }
          : {}),
        referencia,
        fecha: date(a.fecha),
        concepto: str(a.concepto, "Concepto"),
        tipo: a.tipo,
        detalles,
      };
    } catch (e) {
      throw new Error(`Asiento ${index + 1}: ${(e as Error).message}`);
    }
  });
}
export function ledger(cuentas: Cuenta[], asientos: Asiento[]): Cuenta[] {
  const totals = new Map<string, { debe: number; haber: number }>();
  for (const a of asientos)
    for (const d of a.detalles) {
      const t = totals.get(d.cuentaId) ?? { debe: 0, haber: 0 };
      t.debe += cents(d.debe);
      t.haber += cents(d.haber);
      totals.set(d.cuentaId, t);
    }
  return cuentas.map((c) => {
    const t = totals.get(c.id) ?? { debe: 0, haber: 0 };
    return {
      ...c,
      debe: t.debe / 100,
      haber: t.haber / 100,
      saldo:
        (c.naturaleza === "Deudora" ? t.debe - t.haber : t.haber - t.debe) /
        100,
    };
  });
}
export function trial(cuentas: Cuenta[]) {
  return cuentas.map((c) => {
    const net = cents(c.debe) - cents(c.haber);
    return {
      ...c,
      deudor: Math.max(net, 0) / 100,
      acreedor: Math.max(-net, 0) / 100,
    };
  });
}
