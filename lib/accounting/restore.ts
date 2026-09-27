import type { LibroLocal } from "../types";
import { baseAccounts, cents, date, parseCatalog, parseEntries } from "./core";
import { calcularKardex, localCommand, rolesKardex } from "./local";
import { rolesReporte } from "./reports";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Respaldo: objeto inválido.");
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 500): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Respaldo: ${label} inválido.`);
}
function unique(values: unknown[], label: string) {
  values.forEach(v => text(v, label, 200));
  if (new Set(values).size !== values.length) throw new Error(`Respaldo: ${label} duplicado.`);
}

/** Revalida archivos y datos del navegador en el servidor antes de persistirlos.
 * Conserva IDs, orden, históricos inactivos y períodos cerrados.
 */
export function restoreBook(value: unknown): LibroLocal {
  const raw = record(value);
  const version = raw.versionLocal ?? (raw.versionAuditoria === 2 ? 3 : undefined);
  if (version !== 2 && version !== 3) throw new Error("Respaldo incompatible. Usa un ejercicio local v2/v3 o un respaldo de auditoría v2.");
  for (const key of ["cuentas", "asientos", "periodos"])
    if (!Array.isArray(raw[key])) throw new Error(`Respaldo: falta ${key}.`);
  if (raw.kardex !== undefined && !Array.isArray(raw.kardex)) throw new Error("Respaldo: Kardex inválido.");
  const s = structuredClone({ ...raw, versionLocal: version, kardex: raw.kardex ?? [] }) as unknown as LibroLocal;
  unique(s.cuentas.map(c => record(c).id), "ID de cuenta");
  unique(s.cuentas.map(c => c.codigo), "código de cuenta");
  for (const c of s.cuentas) {
    text(c.nombre, "nombre de cuenta", 160);
    text(c.familia, "familia"); text(c.tipo, "tipo"); text(c.rubro, "rubro");
    if (!["Deudora", "Acreedora"].includes(c.naturaleza) || typeof c.activa !== "boolean")
      throw new Error("Respaldo: clasificación de cuenta inválida.");
  }
  unique(s.asientos.map(a => record(a).id), "ID de asiento");
  unique(s.asientos.map(a => a.referencia), "referencia");
  if (new Set(s.periodos.map(p => record(p).anio)).size !== s.periodos.length) throw new Error("Respaldo: períodos duplicados.");
  for (const p of s.periodos)
    if (!Number.isInteger(p.anio) || p.anio < 1900 || p.anio > 2200 || typeof p.cerrado !== "boolean")
      throw new Error("Respaldo: período inválido.");
  for (const [i, a] of s.asientos.entries()) {
    if (a.numero !== i + 1 || !["normal", "ajuste", "reversion"].includes(a.tipo) || !Array.isArray(a.detalles))
      throw new Error("Respaldo: numeración, tipo o detalle de asiento inválido.");
    date(a.fecha);
    if (!s.periodos.some(p => p.anio === Number(a.fecha.slice(0, 4)))) throw new Error("Respaldo: falta el período de un asiento.");
    for (const d of a.detalles) {
      record(d); text(d.id, "ID de línea", 200);
      const c = s.cuentas.find(c => c.id === d.cuentaId && c.codigo === d.codigoCuenta);
      if (!c || typeof d.debe !== "number" || typeof d.haber !== "number") throw new Error("Respaldo: cuenta o importe de línea inválido.");
      cents(d.debe); cents(d.haber); cents(d.parcial);
    }
    if (a.liquidacionIva !== undefined && a.liquidacionIva !== "acumulada" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(a.liquidacionIva))
      throw new Error("Respaldo: liquidación IVA inválida.");
  }
  unique(s.asientos.flatMap(a => a.detalles.map(d => d.id)), "ID de línea");
  // La migración existente completa los padres del formato anterior.
  const migrated = localCommand(s, "init", {}).estado;
  const bases = baseAccounts();
  for (const base of bases) {
    const actual = migrated.cuentas.find(c => c.codigo === base.codigo);
    if (!actual || actual.padreCodigo !== base.padreCodigo || actual.naturaleza !== base.naturaleza)
      throw new Error("Respaldo: jerarquía base incompleta.");
  }
  const operative = migrated.cuentas.filter(c => c.codigo.length > 2);
  for (let start = 0; start < operative.length; start += 1000)
    parseCatalog({ version: 1, cuentas: operative.slice(start, start + 1000).map(c => ({
      codigo: c.codigo, nombre: c.nombre, padreCodigo: c.padreCodigo, activa: c.activa,
    })) }, migrated.cuentas);
  if (migrated.cuentas.some(c => c.codigo.length <= 2 && !bases.some(b => b.codigo === c.codigo)))
    throw new Error("Respaldo: grupo base desconocido.");
  const historicalAccounts = migrated.cuentas.map(c => ({ ...c, activa: true }));
  for (const a of migrated.asientos) {
    parseEntries({ version: 1, asientos: [{
      referencia: a.referencia, fecha: a.fecha, concepto: a.concepto,
      tipo: a.tipo === "reversion" ? "ajuste" : a.tipo,
      modoIva: a.modoIva, ajusteInventario: a.ajusteInventario,
      detalles: a.detalles.map(d => ({ codigoCuenta: d.codigoCuenta, debe: d.debe, haber: d.haber, descripcion: d.descripcion })),
    }] }, historicalAccounts);
    if (a.tipo === "reversion") {
      const original = migrated.asientos.find(o => o.id === a.reversaDe);
      if (!original || original.tipo === "reversion" || original.numero >= a.numero || original.fecha > a.fecha ||
        migrated.asientos.filter(o => o.reversaDe === original.id).length !== 1 ||
        original.detalles.length !== a.detalles.length || original.detalles.some((d, i) =>
          d.cuentaId !== a.detalles[i].cuentaId || d.debe !== a.detalles[i].haber || d.haber !== a.detalles[i].debe))
        throw new Error("Respaldo: reversión inconsistente.");
    } else if (a.reversaDe) throw new Error("Respaldo: enlace de reversión inválido.");
    a.cuadra = true;
  }
  const config = record(migrated.configuracion);
  if (!["mas_iva", "incluido"].includes(String(config.modoIva)) ||
    !["traslados_compras", "inventarios_explicitos"].includes(String(config.modoInventario)))
    throw new Error("Respaldo: configuración inválida.");
  const checkAccount = (v: unknown) => {
    if (typeof v !== "string" || (v !== "" && !operative.some(c => c.codigo === v)))
      throw new Error("Respaldo: cuenta configurada inexistente.");
  };
  for (const k of ["cuentaIvaCredito", "cuentaIvaDebito"])
    if (config[k] !== undefined) checkAccount(config[k]);
  if (config.cuentasReporte !== undefined)
    for (const [k, v] of Object.entries(record(config.cuentasReporte))) {
      if (!rolesReporte.some(r => r.rol === k)) throw new Error("Respaldo: rol de reporte inválido.");
      checkAccount(v);
    }
  if (config.inventarioFinalFisico !== undefined) {
    if (typeof config.inventarioFinalFisico !== "string") throw new Error("Respaldo: inventario físico inválido.");
    if (config.inventarioFinalFisico) cents(config.inventarioFinalFisico);
  }
  unique(migrated.kardex!.map(p => record(p).id), "ID de producto");
  const assigned = new Set<string>();
  for (const p of migrated.kardex!) {
    text(p.nombre, "nombre del producto", 120);
    if (typeof p.costo !== "string" || typeof p.venta !== "string") throw new Error("Respaldo: precios inválidos.");
    record(p.cuentas);
    for (const [rol] of rolesKardex) {
      const code = p.cuentas[rol]; checkAccount(code);
      if ((!code && ["compras", "ventas"].includes(rol)) || (code && assigned.has(code)))
        throw new Error("Respaldo: asignaciones Kardex inválidas.");
      if (code) assigned.add(code);
    }
    calcularKardex(p, migrated.asientos);
  }
  return { versionLocal: 3, cuentas: migrated.cuentas, asientos: migrated.asientos,
    periodos: migrated.periodos, configuracion: migrated.configuracion, kardex: migrated.kardex };
}
