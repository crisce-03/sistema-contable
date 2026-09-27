import type {
  Asiento,
  LibroLocal,
  ConfiguracionLibro,
  AsientoInput,
  KardexProducto,
  RolReporte,
} from "../types";
import {
  asientoCierre,
  cierreRegistrado,
  cuentasOperativas,
  grupoSaldoResultados,
  prepararSaldoResultados,
  resolverCuentaReporte,
  rolesReporte,
  saldoSubarbol,
} from "./reports";
import {
  accountClassification,
  baseAccounts,
  parentCode,
  parseCatalog,
  parseEntries,
  date,
  cents,
  money,
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
    kardex: [],
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
function revertirAsiento(
  s: LibroLocal,
  original: Asiento,
  fecha: string,
  motivo: string,
  uuid: () => string,
) {
  s.asientos.push({
    ...original,
    id: uuid(),
    numero: s.asientos.length + 1,
    referencia: "REV-" + original.id,
    fecha,
    concepto: "Reversión: " + motivo,
    tipo: "reversion",
    reversaDe: original.id,
    detalles: original.detalles.map((l) => ({
      ...l,
      id: uuid(),
      debe: l.haber,
      haber: l.debe,
    })),
  });
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
  s.kardex ??= [];
  let insertados = 0,
    omitidos = 0,
    cambioDeInventarios: ConfiguracionLibro["modoInventario"] | null = null;
  if (action === "saldar-resultados") {
    const d = object(data);
    if (typeof d.anio !== "number") throw new Error("Selecciona el ejercicio.");
    requirePeriod(s, `${d.anio}-12-31`);
    const plan = prepararSaldoResultados(
      s.configuracion, s.cuentas, s.asientos, d.anio,
      inventarioFinalKardex(s.kardex, s.asientos),
    );
    s.cuentas.push(...plan.cuentasNuevas.map((c) => ({ ...c, id: uuid() })));
    s.configuracion = plan.configuracion;
    const lote = uuid();
    return localCommand(s, "entries", {
      version: 1,
      modoIva: s.configuracion.modoIva,
      asientos: plan.partidas.map((a, i) => ({
        ...a, referencia: `CIERRE-${d.anio}-RESULTADOS-${lote}-${i + 1}`,
      })),
    }, uuid);
  } else if (action === "liquidacion-iva") {
    registrarLiquidacionIva(s, data, uuid);
    insertados = 1;
  } else if (action === "kardex") {
    guardarProductoKardex(s, data);
  } else if (action === "catalog") {
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
      const cierre = cierreRegistrado(Number(a.fecha.slice(0, 4)), s.asientos);
      if (a.referencia.startsWith("CIERRE-") && cierre &&
        (!grupoSaldoResultados(a) || grupoSaldoResultados(a) !== grupoSaldoResultados(cierre)))
        throw new Error("El ejercicio ya tiene un cierre. Reviértelo antes de registrar otro.");
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
    const grupo = grupoSaldoResultados(original);
    const partidas = grupo ? s.asientos.filter((a) =>
      a.tipo === "ajuste" && grupoSaldoResultados(a) === grupo &&
      !s.asientos.some((r) => r.reversaDe === a.id),
    ) : [original];
    for (const partida of partidas)
      revertirAsiento(s, partida, fecha, d.motivo.trim(), uuid);
    insertados = partidas.length;
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
      Object.keys(d).some((k) => !["modoIva", "modoInventario", "cuentaIvaCredito", "cuentaIvaDebito", "cuentasReporte", "inventarioFinalFisico"].includes(k))
    )
      throw new Error("Configuración inválida.");
    const reporte: ConfiguracionLibro["cuentasReporte"] = {};
    const enlaces = "cuentasReporte" in d ? d.cuentasReporte : s.configuracion.cuentasReporte;
    if (enlaces !== undefined) {
      const fuente = object(enlaces);
      for (const [rol, code] of Object.entries(fuente)) {
        if (!rolesReporte.some((r) => r.rol === rol))
          throw new Error(`Rol de informe desconocido: ${rol}`);
        if (typeof code !== "string" || (code !== "" && !s.cuentas.some((c) => c.codigo === code && canPost(c, s.cuentas))))
          throw new Error("Selecciona una cuenta activa de 4, 6, 8 o 10 dígitos para cada rol del informe.");
        if (code !== "") reporte[rol as RolReporte] = code;
      }
    }
    const inventarioFinal = "inventarioFinalFisico" in d ? d.inventarioFinalFisico : s.configuracion.inventarioFinalFisico;
    if (inventarioFinal !== undefined && typeof inventarioFinal !== "string")
      throw new Error("El inventario final físico se guarda como texto decimal.");
    // cents() rechaza signos, separadores de miles y más de dos decimales.
    if (inventarioFinal) cents(inventarioFinal);
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
    // Cambiar de tratamiento retira los traslados del método anterior: se
    // revierten, nunca se borran, para que el diario siga siendo auditable.
    if (d.modoInventario !== s.configuracion.modoInventario) {
      cambioDeInventarios = d.modoInventario as ConfiguracionLibro["modoInventario"];
      if (cambioDeInventarios === "inventarios_explicitos") {
        const vigentes = s.asientos.filter(
          (a) =>
            a.tipo === "ajuste" &&
            a.ajusteInventario &&
            !s.asientos.some((r) => r.reversaDe === a.id),
        );
        for (const a of vigentes) {
          requirePeriod(s, a.fecha);
          revertirAsiento(
            s,
            a,
            a.fecha,
            "Cambio a analítico sin traslados",
            uuid,
          );
        }
      }
    }
    s.configuracion = {
      ...ivaAccounts,
      cuentasReporte: reporte,
      ...(inventarioFinal ? { inventarioFinalFisico: inventarioFinal } : {}),
      modoIva: d.modoIva,
      modoInventario: d.modoInventario,
    } as ConfiguracionLibro;
  } else if (action !== "init") throw new Error("Acción local no permitida.");
  if (["kardex", "entries", "reverse", "settings", "catalog"].includes(action)) {
    for (const producto of s.kardex ?? []) {
      // Al configurar el Kardex el problema se informa; en las demás
      // operaciones se reintenta después, sin bloquear el registro.
      // Al volver al método de traspasos se registran otra vez, aunque los
      // del intento anterior hayan quedado revertidos. Configurar el Kardex
      // y elegir ese método son las dos peticiones explícitas del usuario:
      // si el traslado no se puede registrar, se explica en el momento.
      const rehacer = cambioDeInventarios === "traslados_compras";
      if (action === "kardex" || rehacer)
        sincronizarTrasladosKardex(s, producto, uuid, true, rehacer);
      else
        try {
          sincronizarTrasladosKardex(s, producto, uuid, false, false);
        } catch {}
    }
  }
  const grupos = new Set(s.asientos.filter((a) => a.tipo === "ajuste" &&
    !s.asientos.some((r) => r.reversaDe === a.id)).map(grupoSaldoResultados).filter(Boolean));
  for (const grupo of grupos) {
    const partidas = s.asientos.filter((a) => a.tipo === "ajuste" && grupoSaldoResultados(a) === grupo);
    const anio = Number(partidas[0].fecha.slice(0, 4));
    const saldos = new Map<string, number>();
    for (const a of partidas)
      for (const d of a.detalles)
        saldos.set(d.codigoCuenta, (saldos.get(d.codigoCuenta) ?? 0) + cents(d.debe) - cents(d.haber));
    try {
      const esperado = asientoCierre(s.configuracion, s.cuentas, s.asientos, anio,
        inventarioFinalKardex(s.kardex, s.asientos));
      for (const d of esperado.detalles)
        saldos.set(d.codigoCuenta, (saldos.get(d.codigoCuenta) ?? 0) - cents(d.debe) + cents(d.haber));
      if ([...saldos.values()].some((saldo) => saldo !== 0)) throw new Error("Los importes del cierre cambiaron.");
    } catch (e) {
      throw new Error(`Revierte primero el cierre de resultados ${anio} para modificar sus importes. ${(e as Error).message}`);
    }
  }
  for (const a of s.asientos) {
    if (
      a.tipo === "ajuste" &&
      a.liquidacionIva &&
      !s.asientos.some(r => r.reversaDe === a.id)
    ) {
      // Solo un desajuste real de importes bloquea la operación. Si el IVA
      // ni siquiera puede recalcularse, la pantalla de Liquidación explica
      // el motivo; abortar aquí dejaría el libro sin forma de corregirse.
      let desactualizada = false;
      try {
        desactualizada = calcularLiquidacionIva(
          s,
          a.liquidacionIva === "acumulada" ? undefined : a.liquidacionIva,
        ).desactualizada;
      } catch {}
      if (desactualizada) {
        throw new Error(
          `Revierte primero la liquidación de IVA ${a.liquidacionIva} para cambiar sus importes.`,
        );
      }
    }
  }
  s.cuentas = ledger(postingFlags(s.cuentas), s.asientos);
  return { estado: s, insertados, omitidos };
}

export const rolesKardex = [
  ["compras", "Compras"],
  ["ventas", "Ventas"],
  ["devolCompras", "Devolución sobre Compra"],
  ["devolVentas", "Devolución sobre Venta"],
] as const;

export function precioKardexSinIva(importe: string, incluyeIva = false) {
  if (typeof incluyeIva !== "boolean") throw new Error("Indica si el precio incluye IVA.");
  const valor = cents(importe);
  return incluyeIva ? Math.round(valor * 100 / 113) : valor;
}

function parametrosKardex(p: KardexProducto) {
  const costo = precioKardexSinIva(p.costo, p.costoIncluyeIva);
  const venta = precioKardexSinIva(p.venta, p.ventaIncluyeIva);

  if (!costo || !venta) {
    throw new Error("Costo y venta deben ser mayores que cero.");
  }

  for (const ajuste of Object.values(p.costosMovimientos ?? {})) {
    if (!ajuste || typeof ajuste.costo !== "string" || typeof ajuste.incluyeIva !== "boolean" ||
      !precioKardexSinIva(ajuste.costo, ajuste.incluyeIva))
      throw new Error("El costo del movimiento debe ser positivo e indicar si incluye IVA.");
  }
  date(p.inicio);
  date(p.fin);

  if (p.fin < p.inicio) {
    throw new Error("El fin no puede ser anterior al inicio.");
  }

  if (!Number.isSafeInteger(p.inicial) || p.inicial < 0) {
    throw new Error(
      "El inventario inicial debe ser un número entero no negativo.",
    );
  }

  if (!Number.isSafeInteger(p.inicial * costo)) {
    throw new Error("El valor del inventario inicial es demasiado grande.");
  }

  return { costo, venta };
}

function guardarProductoKardex(s: LibroLocal, data: unknown) {
  const d = object(data);
  const cuentas = object(d.cuentas);

  if (
    typeof d.id !== "string" ||
    !d.id ||
    d.id.length > 100 ||
    typeof d.nombre !== "string" ||
    !d.nombre.trim() ||
    d.nombre.length > 120 ||
    typeof d.costo !== "string" ||
    typeof d.venta !== "string" ||
    typeof d.inicio !== "string" ||
    typeof d.fin !== "string" ||
    typeof d.inicial !== "number"
  ) {
    throw new Error("Completa los datos del producto.");
  }

  const p: KardexProducto = {
    id: d.id,
    nombre: d.nombre.trim(),
    costo: d.costo,
    venta: d.venta,
    costoIncluyeIva: d.costoIncluyeIva as boolean | undefined,
    ventaIncluyeIva: d.ventaIncluyeIva as boolean | undefined,
    costosMovimientos: d.costosMovimientos === undefined ? undefined :
      object(d.costosMovimientos) as KardexProducto["costosMovimientos"],
    inicio: d.inicio,
    fin: d.fin,
    inicial: d.inicial,
    cuentas: {
      compras: "",
      ventas: "",
      devolCompras: "",
      devolVentas: "",
    },
  };

  parametrosKardex(p);

  const usados = new Set<string>();

  for (const [rol, titulo] of rolesKardex) {
    const codigo = cuentas[rol];

    if (
      typeof codigo !== "string" ||
      (!codigo && (rol === "compras" || rol === "ventas"))
    ) {
      throw new Error(`Selecciona la cuenta de ${titulo}.`);
    }

    if (codigo) {
      const cuenta = s.cuentas.find(c => c.codigo === codigo);

      if (!cuenta || !/^\d{4,10}$/.test(codigo)) {
        throw new Error(
          `Cuenta inexistente o nivel incorrecto: ${codigo}.`,
        );
      }

      if (
        [
          s.configuracion.cuentaIvaCredito,
          s.configuracion.cuentaIvaDebito,
        ].includes(codigo) ||
        ["iva_credito", "iva_debito"].includes(cuenta.familia)
      ) {
        throw new Error("No asignes cuentas de IVA al Kardex.");
      }

      if (
        usados.has(codigo) ||
        (s.kardex ?? []).some(
          otro =>
            otro.id !== p.id &&
            Object.values(otro.cuentas).includes(codigo),
        )
      ) {
        throw new Error(
          `La cuenta ${codigo} ya está asignada. Usa una subcuenta distinta por producto.`,
        );
      }

      usados.add(codigo);
    }

    p.cuentas[rol] = codigo;
  }

  s.kardex = [
    ...(s.kardex ?? []).filter(otro => otro.id !== p.id),
    p,
  ];
}

export function calcularKardex(
  p: KardexProducto,
  asientos: Asiento[],
) {
  const { costo, venta } = parametrosKardex(p);
  const costoDe = (clave: string) => {
    const ajuste = p.costosMovimientos?.[clave];
    return ajuste ? precioKardexSinIva(ajuste.costo, ajuste.incluyeIva) : costo;
  };
  const costoInicial = costoDe("inicial");
  let existencias = p.inicial;
  let saldo = p.inicial * costoInicial;
  if (!Number.isSafeInteger(saldo)) throw new Error("El valor del inventario inicial es demasiado grande.");
  let valido = true;
  const avisos: string[] = [];

  const filas = [{
    id: "inicial",
    claveCosto: "inicial",
    costoUnitario: costoInicial,
    costoExistencia: costoInicial,
    fecha: p.inicio,
    concepto: "Inventario inicial",
    entrada: p.inicial,
    salida: 0,
    existencias,
    deudor: saldo,
    acreedor: 0,
    saldo,
  }];

  const movimientos = [...asientos]
    .filter(a => a.fecha >= p.inicio && a.fecha <= p.fin)
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) || a.numero - b.numero,
    );

  for (const a of movimientos) {
    // Los ajustes contables no son compras/ventas físicas adicionales.
    const origen = a.tipo === "reversion"
      ? asientos.find(original => original.id === a.reversaDe)
      : a;

    if (
      !origen ||
      origen.tipo !== "normal" ||
      origen.ajusteInventario
    ) {
      continue;
    }

    for (const [indice, d] of a.detalles.entries()) {
      const asignacion = rolesKardex.find(
        ([rol]) =>
          p.cuentas[rol] !== "" &&
          p.cuentas[rol] === d.codigoCuenta,
      );

      if (!asignacion) continue;

      const [rol, titulo] = asignacion;

      // Estos importes ya tienen separado el IVA.
      const neto = cents(d.debe) - cents(d.haber);
      if (!neto) continue;

      // La reversión conserva el costo del movimiento que está anulando.
      const claveCosto = `${origen.id}-${origen.detalles[indice].id}`;
      const costoUnitario = costoDe(claveCosto);
      const precio =
        rol === "ventas" || rol === "devolVentas"
          ? venta
          : costoUnitario;

      const unidades = Math.round(Math.abs(neto) / precio);
      const diferencia = unidades * precio - Math.abs(neto);

      if (diferencia) {
        avisos.push(
          `#${a.numero} · ${titulo}: ` +
          `${Math.abs(neto) / 100} / ${precio / 100} = ` +
          `${(Math.abs(neto) / precio).toFixed(4)} → ` +
          `${unidades} unidades. Diferencia: ` +
          `$${(diferencia / 100).toFixed(2)}.`,
        );
      }

      if (!unidades) {
        valido = false;
        avisos.push(
          `#${a.numero}: el importe equivale a menos de media unidad; revisa el precio.`,
        );
      }

      // Compra y devolución de venta: debe → entrada.
      // Venta y devolución de compra: haber → salida.
      // También permite invertir el movimiento en una reversión.
      const entrada = neto > 0 ? unidades : 0;
      const salida = neto < 0 ? unidades : 0;

      existencias += entrada - salida;

      const deudor = entrada * costoUnitario;
      const acreedor = salida * costoUnitario;
      saldo += deudor - acreedor;

      if (
        ![existencias, deudor, acreedor, saldo]
          .every(Number.isSafeInteger)
      ) {
        throw new Error("Los importes exceden la precisión permitida.");
      }

      if (existencias < 0) {
        valido = false;
        avisos.push(
          `#${a.numero}: salida superior a las existencias disponibles.`,
        );
      }

      if (saldo < 0 || (!existencias && saldo !== 0)) {
        valido = false;
        avisos.push(`#${a.numero}: el valor restante no corresponde a las existencias; revisa los costos unitarios.`);
      }
      filas.push({
        id: `${a.id}-${d.id}`,
        claveCosto,
        costoUnitario,
        costoExistencia: existencias ? saldo / existencias : 0,
        fecha: a.fecha,
        concepto:
          `#${a.numero} · ` +
          `${a.tipo === "reversion" ? "Reversión · " : ""}` +
          `${titulo} · ${a.concepto}`,
        entrada,
        salida,
        existencias,
        deudor,
        acreedor,
        saldo,
      });
    }
  }

  return {
    filas,
    costo,
    venta,
    avisos,
    valido,
    unidades: existencias,
    inventarioFinal: saldo,
  };
}

/** Existencia final valorada que suman todos los productos del Kardex.
 * Es el dato que el informe usa mientras no se registre un conteo físico
 * distinto; un producto mal parametrizado se omite en vez de romper todo. */
export function inventarioFinalKardex(
  kardex: KardexProducto[] | undefined,
  asientos: Asiento[],
) {
  let total = 0;
  for (const p of kardex ?? []) {
    try {
      const r = calcularKardex(p, asientos);
      if (r.valido) total += r.inventarioFinal;
    } catch {}
  }
  return total;
}

/** Importe del traslado inicial de un producto.
 *
 * Sale del saldo real de Inventarios, no de unidades × costo: con un costo
 * unitario de más de dos decimales —lo normal en un promedio ponderado— esos
 * dos números no coinciden nunca, y el traslado tiene que dejar la cuenta
 * exactamente en cero. Con varios productos se reparte a prorrata y el
 * último absorbe el redondeo, de modo que la suma siempre cuadre.
 */
function trasladoInicialKardex(
  s: LibroLocal,
  p: KardexProducto,
  inventario: LibroLocal["cuentas"][number],
) {
  const enLibros = saldoSubarbol(
    inventario,
    cuentasOperativas(s.cuentas, s.asientos),
    "deudora",
  );
  const productos = s.kardex ?? [];
  if (productos.length <= 1) return enLibros;

  const valor = (otro: KardexProducto) => {
    const inicial = otro.costosMovimientos?.inicial;
    return otro.inicial * (inicial ? precioKardexSinIva(inicial.costo, inicial.incluyeIva) : parametrosKardex(otro).costo);
  };
  const total = productos.reduce((t, otro) => t + valor(otro), 0);
  if (!total) return 0;

  const previos = productos.slice(
    0,
    productos.findIndex((otro) => otro.id === p.id),
  );
  const asignadoAntes = previos.reduce(
    (t, otro) => t + Math.round((valor(otro) * enLibros) / total),
    0,
  );
  const esUltimo = productos[productos.length - 1]?.id === p.id;
  return esUltimo
    ? enLibros - asignadoAntes
    : Math.round((valor(p) * enLibros) / total);
}

/** Referencia estable: identifica el traslado que gestiona el Kardex. */
export const referenciaTraslado = (
  p: KardexProducto,
  clase: "inicial" | "final",
) => `KARDEX-${clase === "inicial" ? "INI" : "FIN"}-${p.id}`;

/** Traslado vigente de cada clase para el producto, si ya está registrado. */
export function trasladosKardex(asientos: Asiento[], p: KardexProducto) {
  const del = (clase: "inicial" | "final") => {
    const todos = asientos.filter(
      a =>
        a.tipo === "ajuste" &&
        a.ajusteInventario === clase &&
        a.fecha.slice(0, 4) === p.inicio.slice(0, 4) &&
        a.detalles.some(d => d.codigoCuenta === p.cuentas.compras),
    );

    const vigentes = todos.filter(
      a => !asientos.some(r => r.reversaDe === a.id),
    );

    return {
      asiento: vigentes[0],
      duplicado: vigentes.length > 1,
      revertido: !vigentes.length && todos.length > 0,
    };
  };

  return { inicial: del("inicial"), final: del("final") };
}

/** Mantiene en el mayor los dos traslados del método de traspasos a Compras.
 * El Kardex es la fuente: el inventario inicial y el final calculados se
 * registran y se vuelven a cuadrar solos ante cualquier cambio del diario.
 * En modo estricto el problema se informa; en segundo plano no bloquea el
 * registro de otras operaciones.
 */
function sincronizarTrasladosKardex(
  s: LibroLocal,
  p: KardexProducto,
  uuid: () => string,
  estricto: boolean,
  rehacer: boolean,
) {
  if (s.configuracion.modoInventario !== "traslados_compras") return;
  if (!p.cuentas.compras) return;

  const fallo = (mensaje: string) => {
    if (estricto) throw new Error(mensaje);
  };

  const compras = s.cuentas.find(c => c.codigo === p.cuentas.compras);

  if (!compras || !canPost(compras, s.cuentas)) {
    return fallo(
      `La cuenta de Compras ${p.cuentas.compras} no admite movimientos.`,
    );
  }

  const inventario = resolverCuentaReporte(
    "inventarios",
    s.configuracion,
    s.cuentas,
  );

  if (!inventario) {
    return fallo(
      "No se reconoce la cuenta de Inventarios. Asígnala en " +
      "Configuración → Enlaces de cuentas y cierre.",
    );
  }

  if (Object.values(p.cuentas).includes(inventario.codigo)) {
    return fallo(
      `La cuenta de Inventarios ${inventario.codigo} no puede ser también ` +
      "una cuenta de movimiento del Kardex.",
    );
  }

  const resultado = calcularKardex(p, s.asientos);

  if (!resultado.valido) {
    return fallo(
      "Corrige las inconsistencias del Kardex antes de actualizar el mayor.",
    );
  }

  const registrados = trasladosKardex(s.asientos, p);
  const importes = {
    inicial: trasladoInicialKardex(s, p, inventario),
    final: resultado.inventarioFinal,
  };
  const fechas = { inicial: p.inicio, final: p.fin };

  for (const clase of ["inicial", "final"] as const) {
    const { asiento, duplicado, revertido } = registrados[clase];

    if (duplicado) {
      return fallo(
        `Hay varios traslados de inventario ${clase} para ${p.nombre}. ` +
        "Revierte los sobrantes en el Libro Diario.",
      );
    }

    // Un traslado revertido a propósito no se vuelve a crear solo, salvo al
    // volver al método de traspasos desde inventarios explícitos.
    if (revertido && !rehacer) continue;

    const importe = importes[clase];
    const fecha = fechas[clase];

    if (!importe) {
      if (asiento) {
        return fallo(
          `El inventario ${clase} de ${p.nombre} quedó en cero: revierte ` +
          `el asiento #${asiento.numero} en el Libro Diario.`,
        );
      }
      continue;
    }

    // El inicial sale de Inventarios hacia Compras; el final regresa.
    const cargo = clase === "final" ? inventario : compras;
    const abono = clase === "final" ? compras : inventario;
    const concepto =
      `Traslado de inventario ${clase} · ${p.nombre}`;

    if (asiento) {
      const lineaCargo = asiento.detalles.find(
        d => d.codigoCuenta === cargo.codigo,
      );
      const lineaAbono = asiento.detalles.find(
        d => d.codigoCuenta === abono.codigo,
      );

      if (
        asiento.detalles.length !== 2 ||
        !lineaCargo ||
        !lineaAbono ||
        cents(lineaCargo.haber.toFixed(2)) !== 0 ||
        cents(lineaAbono.debe.toFixed(2)) !== 0
      ) {
        return fallo(
          `El asiento #${asiento.numero} no tiene la forma Debe ` +
          `${cargo.codigo} / Haber ${abono.codigo}.`,
        );
      }

      // Guardar los mismos valores no modifica el asiento.
      if (
        cents(lineaCargo.debe.toFixed(2)) === importe &&
        asiento.fecha === fecha
      ) {
        continue;
      }

      requirePeriod(s, asiento.fecha);
      requirePeriod(s, fecha);
      // Comprueba el límite de importes permitido por el diario.
      cents((importe / 100).toFixed(2));

      asiento.fecha = fecha;
      asiento.concepto = concepto;
      lineaCargo.debe = importe / 100;
      lineaAbono.haber = importe / 100;
      continue;
    }

    requirePeriod(s, fecha);
    cents((importe / 100).toFixed(2));

    s.asientos.push({
      id: uuid(),
      referencia: referenciaTraslado(p, clase),
      numero: s.asientos.length + 1,
      fecha,
      concepto,
      tipo: "ajuste",
      modoIva: s.configuracion.modoIva,
      ajusteInventario: clase,
      cuadra: true,
      detalles: [
        { cuenta: cargo, debe: importe, haber: 0 },
        { cuenta: abono, debe: 0, haber: importe },
      ].map(l => ({
        id: uuid(),
        cuentaId: l.cuenta.id,
        codigoCuenta: l.cuenta.codigo,
        parcial: 0,
        debe: l.debe / 100,
        haber: l.haber / 100,
        descripcion: concepto,
      })),
    });
  }
}

function destinoLiquidacionIva(
  s: LibroLocal,
  diferencia: number,
  raices: string[],
) {
  if (!diferencia) return undefined;
  const tipo = diferencia > 0 ? "Pasivo" : "Activo";
  const nombre = diferencia > 0 ? "IVA a pagar" : "Remanente IVA a favor";
  const candidatos = s.cuentas.filter((c) => {
    const texto = c.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return canPost(c, s.cuentas) && c.tipo === tipo &&
      !raices.some((r) => c.codigo.startsWith(r) || r.startsWith(c.codigo)) &&
      /\biva\b/.test(texto) &&
      (diferencia > 0 ? /iva\s+(por|a)\s+pagar/.test(texto) : /remanente|a favor/.test(texto));
  });
  if (candidatos.length > 1)
    throw new Error(`Hay varias cuentas de ${nombre}. Conserva una cuenta activa con ese nombre para liquidar.`);
  if (candidatos[0]) return { cuenta: candidatos[0], crear: false };

  const padreCodigo = diferencia > 0 ? "21" : "11";
  for (let n = 99; n >= 1; n--) {
    const codigo = padreCodigo + String(n).padStart(2, "0");
    if (s.cuentas.some((c) => c.codigo.startsWith(codigo))) continue;
    const f = accountClassification(codigo)!;
    const cuenta = {
      id: "", codigo, nombre, padreCodigo, activa: true, movimiento: true,
      familia: f.id, tipo: f.grupo, naturaleza: f.naturaleza as "Deudora" | "Acreedora",
      rubro: f.rubro, debe: 0, haber: 0, saldo: 0,
    };
    if (canPost(cuenta, s.cuentas)) return { cuenta, crear: true };
  }
  throw new Error(`No hay un código disponible para crear ${nombre} en ${padreCodigo}.`);
}

export function calcularLiquidacionIva(
  s: LibroLocal,
  // El mes solo se conserva para validar liquidaciones antiguas.
  mes?: string,
) {
  if (mes !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    throw new Error("Selecciona un mes válido.");
  }

  if (mes) date(`${mes}-01`);

  const credito = resolveIvaAccount(
    "credito",
    s.configuracion,
    s.cuentas,
  );

  const debito = resolveIvaAccount(
    "debito",
    s.configuracion,
    s.cuentas,
  );

  if (!credito || !debito) {
    throw new Error(
      "Asigna IVA Crédito y Débito Fiscal en Configuración.",
    );
  }

  if (
    credito.codigo.startsWith(debito.codigo) ||
    debito.codigo.startsWith(credito.codigo)
  ) {
    throw new Error(
      "Las cuentas de IVA deben ser distintas y no contenerse entre sí.",
    );
  }

  const pertenece = (codigo: string, raiz: string) =>
    codigo.startsWith(raiz);

  let cf = 0;
  let df = 0;
  const saldos = new Map<string, number>();

  for (const a of s.asientos) {
    const origen = a.reversaDe
      ? s.asientos.find(x => x.id === a.reversaDe)
      : undefined;

    // El acumulado incluye las liquidaciones mensuales anteriores: solo
    // queda pendiente lo que aún tiene saldo. Omite su propia liquidación
    // y sus reversiones para poder mostrar y validar la partida registrada.
    const excluir = mes
      ? !a.fecha.startsWith(mes + "-") || a.liquidacionIva || origen?.liquidacionIva
      : a.liquidacionIva === "acumulada" || origen?.liquidacionIva === "acumulada";
    if (excluir) {
      continue;
    }

    for (const d of a.detalles) {
      if ([credito.codigo, debito.codigo].some((raiz) => pertenece(d.codigoCuenta, raiz))) {
        saldos.set(d.codigoCuenta, (saldos.get(d.codigoCuenta) ?? 0) + cents(d.debe) - cents(d.haber));
      }
      if (pertenece(d.codigoCuenta, credito.codigo)) {
        cf += cents(d.debe) - cents(d.haber);
      }

      if (pertenece(d.codigoCuenta, debito.codigo)) {
        df += cents(d.haber) - cents(d.debe);
      }
    }
  }

  if (![cf, df, df - cf, ...saldos.values()].every(Number.isSafeInteger)) {
    throw new Error("Los saldos exceden la precisión admitida.");
  }

  // Las reversiones pueden dejar saldos contrarios a su naturaleza.
  // Se cancelan por el lado correspondiente y la pantalla lo señala.
  const invertidos = cf < 0 || df < 0;

  const registradas = s.asientos.filter(
    a =>
      a.tipo === "ajuste" &&
      a.liquidacionIva === (mes ?? "acumulada") &&
      !s.asientos.some(r => r.reversaDe === a.id),
  );

  if (registradas.length > 1) {
    throw new Error(
      "Hay más de una liquidación de IVA activa para este cálculo.",
    );
  }

  const registrada = registradas[0];

  const cerradoCredito =
    registrada?.detalles.reduce(
      (n, d) =>
        n +
        (pertenece(d.codigoCuenta, credito.codigo)
          ? cents(d.haber) - cents(d.debe)
          : 0),
      0,
    ) ?? 0;

  const cerradoDebito =
    registrada?.detalles.reduce(
      (n, d) =>
        n +
        (pertenece(d.codigoCuenta, debito.codigo)
          ? cents(d.debe) - cents(d.haber)
          : 0),
      0,
    ) ?? 0;

  const saldosCancelados = new Map<string, number>();
  for (const d of registrada?.detalles ?? []) {
    if (![credito.codigo, debito.codigo].some((raiz) => pertenece(d.codigoCuenta, raiz))) continue;
    saldosCancelados.set(
      d.codigoCuenta,
      (saldosCancelados.get(d.codigoCuenta) ?? 0) + cents(d.haber) - cents(d.debe),
    );
  }
  const auxiliaresCambiaron = [...new Set([...saldos.keys(), ...saldosCancelados.keys()])]
    .some((codigo) => (saldos.get(codigo) ?? 0) !== (saldosCancelados.get(codigo) ?? 0));
  const desactualizada = !!registrada && (
    cf !== cerradoCredito || df !== cerradoDebito || (!mes && auxiliaresCambiaron)
  );

  const fecha = mes ? new Date(
    Date.UTC(
      Number(mes.slice(0, 4)),
      Number(mes.slice(5)),
      0,
    ),
  ).toISOString().slice(0, 10) :
    s.asientos.map((a) => a.fecha).sort().at(-1) ?? new Date().toISOString().slice(0, 10);

  const lineas = [...saldos].filter(([, saldo]) => saldo !== 0).map(([codigoCuenta, saldo]) => ({
    codigoCuenta, debe: Math.max(-saldo, 0), haber: Math.max(saldo, 0),
  }));

  return {
    credito,
    debito,
    cf,
    df,
    invertidos,
    diferencia: df - cf,
    registrada,
    desactualizada,
    fecha,
    lineas,
    destino: mes ? undefined : destinoLiquidacionIva(s, df - cf, [credito.codigo, debito.codigo]),
  };
}

function registrarLiquidacionIva(
  s: LibroLocal,
  data: unknown,
  uuid: () => string,
) {
  const d = object(data);

  if (d.mes !== undefined)
    throw new Error("La liquidación ahora acumula todo el IVA pendiente. Actualiza la pantalla para registrarla.");

  // Recalcula aquí: no confía en importes enviados por la pantalla.
  const r = calcularLiquidacionIva(s);

  if (r.registrada) {
    throw new Error(
      "Ya existe una liquidación acumulada. Reviértela antes de reemplazarla.",
    );
  }

  const fecha = d.fecha === undefined ? r.fecha : date(d.fecha);
  if (fecha < r.fecha)
    throw new Error("La fecha de liquidación no puede ser anterior al último asiento del diario.");
  requirePeriod(s, fecha);

  if (!r.lineas.length) {
    throw new Error("No hay saldos de IVA pendientes para liquidar.");
  }

  // Cancela cada auxiliar por su propio saldo, sin dejar movimientos
  // compensados únicamente en el mayor.
  const lineas = [...r.lineas];
  for (const l of lineas) {
    const cuenta = s.cuentas.find((c) => c.codigo === l.codigoCuenta);
    if (!cuenta || !canPost(cuenta, s.cuentas))
      throw new Error(`Activa la cuenta ${l.codigoCuenta} para saldar su IVA.`);
  }
  if (r.destino) {
    const destino = r.destino.cuenta;
    if (r.destino.crear) s.cuentas.push({ ...destino, id: uuid() });
    lineas.push({
      codigoCuenta: destino.codigo,
      debe: Math.max(-r.diferencia, 0),
      haber: Math.max(r.diferencia, 0),
    });
  }

  let cargos = 0,
    abonos = 0;

  for (const l of lineas) {
    if (l.debe > 0 === l.haber > 0) {
      throw new Error(
        "Cada línea de la liquidación debe tener importe en un solo lado.",
      );
    }
    cents((l.debe / 100).toFixed(2));
    cents((l.haber / 100).toFixed(2));
    cargos += l.debe;
    abonos += l.haber;
  }

  if (cargos !== abonos) {
    throw new Error(
      `La partida de liquidación no cuadra: Debe ${money(cargos)} / Haber ${money(abonos)}.`,
    );
  }

  const id = uuid();

  s.asientos.push({
    id,
    referencia: `LIQ-IVA-ACUMULADA-${id}`,
    numero: s.asientos.length + 1,
    fecha,
    concepto: "Liquidación acumulada de IVA",
    tipo: "ajuste",
    modoIva: s.configuracion.modoIva,
    ajusteInventario: null,
    liquidacionIva: "acumulada",
    cuadra: true,
    detalles: lineas.map(l => ({
      ...l,
      id: uuid(),
      cuentaId: s.cuentas.find(
        c => c.codigo === l.codigoCuenta,
      )!.id,
      parcial: 0,
      debe: l.debe / 100,
      haber: l.haber / 100,
      descripcion: "Liquidación acumulada de IVA",
    })),
  });
}
