import type {
  Asiento,
  AsientoInput,
  ConfiguracionLibro,
  Cuenta,
  RolReporte,
} from "../types";
import { accountClassification, canPost, cents, ledger, money } from "./core";

export const PREFIJO_CIERRE = "CIERRE-";

type Signo = "deudora" | "acreedora";

interface DefinicionRol {
  rol: RolReporte;
  titulo: string;
  signo: Signo;
  /** Familia declarada por el catálogo de clasificación, cuando coincide. */
  familias: string[];
  /** El nombre debe contener todas estas raíces. */
  incluye: string[];
  /** El nombre no debe contener ninguna de estas raíces. */
  excluye: string[];
}

export const rolesReporte: DefinicionRol[] = [
  {
    rol: "inventarios",
    titulo: "Inventarios",
    signo: "deudora",
    familias: ["inventarios"],
    incluye: ["inventario"],
    excluye: ["gasto", "costo"],
  },
  {
    rol: "compras",
    titulo: "Compras",
    signo: "deudora",
    familias: ["compras"],
    incluye: ["compra"],
    excluye: ["devolucion", "rebaja", "gasto", "descuento"],
  },
  {
    rol: "gastosCompra",
    titulo: "Gastos sobre compras",
    signo: "deudora",
    familias: [],
    incluye: ["gasto", "compra"],
    excluye: ["devolucion", "rebaja"],
  },
  {
    rol: "devolCompras",
    titulo: "Devoluciones y rebajas sobre compras",
    signo: "acreedora",
    familias: ["devol_compras"],
    incluye: ["compra"],
    excluye: ["gasto"],
  },
  {
    rol: "ventas",
    titulo: "Ventas",
    signo: "acreedora",
    familias: ["ventas"],
    incluye: ["venta"],
    excluye: ["devolucion", "rebaja", "gasto", "costo", "descuento"],
  },
  {
    rol: "devolVentas",
    titulo: "Devoluciones y rebajas sobre ventas",
    signo: "deudora",
    familias: ["devol_ventas"],
    incluye: ["venta"],
    excluye: ["gasto", "costo"],
  },
  {
    rol: "utilidad",
    titulo: "Utilidad del ejercicio",
    signo: "acreedora",
    familias: [],
    incluye: ["utilidad"],
    excluye: [],
  },
];

const palabras = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Se compara por palabra y no por subcadena: "inventarios" contiene "venta"
 * y confundiría la cuenta de existencias con la de ingresos. El prefijo
 * admite el plural y el femenino de cada raíz. */
const nombra = (nombre: string[], raiz: string) =>
  nombre.some((palabra) => palabra.startsWith(raiz));

/** Los roles de devolución exigen además una palabra de contrapartida. */
const contrarias = ["devolucion", "rebaja", "descuento"];

function detectar(def: DefinicionRol, cuentas: Cuenta[]) {
  const candidatos = cuentas.filter((c) => {
    if (!canPost(c, cuentas)) return false;
    const nombre = palabras(c.nombre);
    if (def.familias.includes(c.familia)) return true;
    if (!def.incluye.every((raiz) => nombra(nombre, raiz))) return false;
    if (def.excluye.some((raiz) => nombra(nombre, raiz))) return false;
    const esContraria =
      def.rol === "devolCompras" || def.rol === "devolVentas";
    return esContraria === contrarias.some((raiz) => nombra(nombre, raiz));
  });
  // Se prefiere el mayor nombrado sobre sus auxiliares; un catálogo ambiguo
  // exige la asignación manual y nunca un prefijo de código adivinado.
  const mayores = candidatos.filter((c) => c.codigo.length === 4);
  if (
    mayores.length === 1 &&
    candidatos.every((c) => c.codigo.startsWith(mayores[0].codigo))
  )
    return mayores[0];
  return candidatos.length === 1 ? candidatos[0] : undefined;
}

export function resolverCuentaReporte(
  rol: RolReporte,
  config: ConfiguracionLibro,
  cuentas: Cuenta[],
) {
  const asignada = config.cuentasReporte?.[rol];
  if (asignada)
    return cuentas.find((c) => c.codigo === asignada && canPost(c, cuentas));
  const def = rolesReporte.find((d) => d.rol === rol);
  return def && detectar(def, cuentas);
}

export type EnlacesReporte = Partial<Record<RolReporte, Cuenta>>;

export function resolverEnlaces(
  config: ConfiguracionLibro,
  cuentas: Cuenta[],
): EnlacesReporte {
  const enlaces: EnlacesReporte = {};
  for (const { rol } of rolesReporte) {
    const cuenta = resolverCuentaReporte(rol, config, cuentas);
    if (cuenta) enlaces[rol] = cuenta;
  }
  return enlaces;
}

/** La cuenta y toda su descendencia según la jerarquía real del catálogo.
 * La raíz se vuelve a buscar en la lista recibida: sus importes deben salir
 * de ese mayor y no del ejemplar con que se la nombró. */
export function subarbol(raiz: Cuenta, cuentas: Cuenta[]): Cuenta[] {
  const resultado = [cuentas.find((c) => c.codigo === raiz.codigo) ?? raiz];
  const vistos = new Set([raiz.codigo]);
  for (let i = 0; i < resultado.length; i++) {
    for (const c of cuentas) {
      if (c.padreCodigo !== resultado[i].codigo || vistos.has(c.codigo))
        continue;
      vistos.add(c.codigo);
      resultado.push(c);
    }
  }
  return resultado;
}

export interface TotalesSubarbol {
  debe: number;
  haber: number;
}

/** Totales en centavos del subárbol, sin aplicar todavía ningún signo. */
export function totalesSubarbol(
  raiz: Cuenta | undefined,
  cuentas: Cuenta[],
): TotalesSubarbol {
  const totales = { debe: 0, haber: 0 };
  if (!raiz) return totales;
  for (const c of subarbol(raiz, cuentas)) {
    totales.debe += cents(c.debe.toFixed(2));
    totales.haber += cents(c.haber.toFixed(2));
  }
  return totales;
}

const aplicarSigno = (t: TotalesSubarbol, signo: Signo) =>
  signo === "deudora" ? t.debe - t.haber : t.haber - t.debe;

/** Suma en centavos del subárbol, con el signo natural que se le indique. */
export function saldoSubarbol(
  raiz: Cuenta | undefined,
  cuentas: Cuenta[],
  signo: Signo,
): number {
  return aplicarSigno(totalesSubarbol(raiz, cuentas), signo);
}

export const esAsientoCierre = (a: Asiento, asientos: Asiento[]) => {
  if (a.referencia.startsWith(PREFIJO_CIERRE)) return true;
  if (!a.reversaDe) return false;
  const origen = asientos.find((o) => o.id === a.reversaDe);
  return Boolean(origen?.referencia.startsWith(PREFIJO_CIERRE));
};

export const referenciaCierre = (anio: number) => `${PREFIJO_CIERRE}${anio}`;

export function cierreRegistrado(anio: number, asientos: Asiento[]) {
  return asientos.find(
    (a) => a.tipo === "ajuste" &&
      (a.referencia === referenciaCierre(anio) ||
        a.referencia.startsWith(`${referenciaCierre(anio)}-RESULTADOS-`)) &&
      !asientos.some((r) => r.reversaDe === a.id),
  );
}

/** Las partidas automáticas se revierten como un solo grupo. */
export function grupoSaldoResultados(a: Pick<Asiento, "referencia">) {
  return /^CIERRE-\d{4}-RESULTADOS-.+-\d+$/.test(a.referencia)
    ? a.referencia.slice(0, a.referencia.lastIndexOf("-"))
    : undefined;
}

export interface LineaReporte {
  codigo: string;
  nombre: string;
  importe: number;
}

/** El ejercicio se mide siempre antes del asiento de cierre, de modo que el
 * informe no cambia al registrarlo ni al revertirlo. Los traslados entre
 * Compras e Inventarios también se excluyen: el informe aplica el inventario
 * inicial y el final por su cuenta y volvería a contarlos. */
export function cuentasOperativas(cuentas: Cuenta[], asientos: Asiento[]) {
  return ledger(
    cuentas,
    asientos.filter(
      (a) => !a.ajusteInventario && !esAsientoCierre(a, asientos),
    ),
  );
}

export function estadoResultados(
  config: ConfiguracionLibro,
  cuentas: Cuenta[],
  asientos: Asiento[],
  /** Existencia valorada por el Kardex, en centavos. */
  inventarioKardex = 0,
) {
  const libro = cuentasOperativas(cuentas, asientos);
  const enlaces = resolverEnlaces(config, libro);
  const saldo = (rol: RolReporte) => {
    const def = rolesReporte.find((d) => d.rol === rol)!;
    return saldoSubarbol(enlaces[rol], libro, def.signo);
  };

  const ventas = saldo("ventas"),
    devolVentas = saldo("devolVentas"),
    comprasOperativas = saldo("compras"),
    gastosCompra = saldo("gastosCompra"),
    devolCompras = saldo("devolCompras");

  const enlazadas = Object.values(enlaces);
  // Lo ya presentado en el costo de ventas se descuenta de su propio mayor,
  // aunque el enlace apunte a una subcuenta: así ningún saldo se cuenta dos
  // veces y el resto del mayor sigue siendo gasto de operación u otro ingreso.
  const restante = (mayor: Cuenta, signo: Signo) => {
    const propias = subarbol(mayor, libro).map((c) => c.codigo);
    const total = totalesSubarbol(mayor, libro);
    for (const enlace of enlazadas) {
      if (!propias.includes(enlace.codigo)) continue;
      const usado = totalesSubarbol(enlace, libro);
      total.debe -= usado.debe;
      total.haber -= usado.haber;
    }
    return aplicarSigno(total, signo);
  };
  const resto = (clase: string, signo: Signo): LineaReporte[] =>
    libro
      .filter((c) => c.codigo.length === 4 && c.codigo.startsWith(clase))
      .map((c) => ({
        codigo: c.codigo,
        nombre: c.nombre,
        importe: restante(c, signo),
      }))
      .filter((l) => l.importe !== 0)
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

  const gastosOperacion = resto("4", "deudora"),
    otrosIngresos = resto("5", "acreedora");
  const totalGastos = gastosOperacion.reduce((t, l) => t + l.importe, 0),
    totalOtros = otrosIngresos.reduce((t, l) => t + l.importe, 0);

  const inventarioInicial = saldo("inventarios"),
    // El conteo físico manda; mientras no se registre, vale la existencia
    // que el Kardex ya calculó a partir del diario.
    inventarioFinal = config.inventarioFinalFisico
      ? cents(config.inventarioFinalFisico)
      : inventarioKardex;

  const revertidos = new Set(asientos.map((a) => a.reversaDe).filter(Boolean));
  const trasladosVigentes = asientos.filter(
    (a) => a.tipo === "ajuste" && !revertidos.has(a.id),
  );
  const inventariosEnCompras =
    config.modoInventario === "traslados_compras" &&
    trasladosVigentes.some((a) => a.ajusteInventario === "inicial") &&
    trasladosVigentes.some((a) => a.ajusteInventario === "final");

  // Agrupar los inventarios en Compras conserva el costo y la prioridad del
  // conteo físico. Sus valores originales siguen disponibles para el balance
  // y el cierre; no se vuelven a sumar ni restar en esta presentación.
  const compras = comprasOperativas +
    (inventariosEnCompras ? inventarioInicial - inventarioFinal : 0);
  const ventasNetas = ventas - devolVentas,
    comprasTotales = compras + gastosCompra,
    comprasNetas = comprasTotales - devolCompras,
    mercaderiaDisponible =
      inventarioInicial + comprasOperativas + gastosCompra - devolCompras,
    costoVentas = inventariosEnCompras
      ? comprasNetas
      : mercaderiaDisponible - inventarioFinal,
    utilidadBruta = ventasNetas - costoVentas,
    utilidadNeta = utilidadBruta - totalGastos + totalOtros;

  return {
    enlaces,
    libro,
    ventas,
    devolVentas,
    ventasNetas,
    inventariosEnCompras,
    compras,
    gastosCompra,
    comprasTotales,
    devolCompras,
    comprasNetas,
    inventarioInicial,
    mercaderiaDisponible,
    inventarioFinal,
    inventarioFinalOrigen: config.inventarioFinalFisico
      ? ("conteo" as const)
      : inventarioKardex
        ? ("kardex" as const)
        : ("sin-dato" as const),
    inventarioFinalKardex: inventarioKardex,
    inventarioFinalDeclarado: Boolean(
      config.inventarioFinalFisico || inventarioKardex,
    ),
    costoVentas,
    utilidadBruta,
    gastosOperacion,
    totalGastos,
    otrosIngresos,
    totalOtros,
    utilidadNeta,
  };
}

export type EstadoResultados = ReturnType<typeof estadoResultados>;

export function balanceGeneral(resultado: EstadoResultados) {
  const { libro, enlaces } = resultado;
  const inventario = enlaces.inventarios;
  const bloque = (clase: string, signo: Signo): LineaReporte[] =>
    libro
      .filter((c) => c.codigo.length === 4 && c.codigo.startsWith(clase))
      .map((c) => {
        const saldo = saldoSubarbol(c, libro, signo);
        // El activo presenta la existencia final, nunca la inicial.
        const sustituye =
          inventario &&
          subarbol(c, libro).some((x) => x.codigo === inventario.codigo);
        return {
          codigo: c.codigo,
          nombre: c.nombre,
          importe: sustituye
            ? saldo - resultado.inventarioInicial + resultado.inventarioFinal
            : saldo,
        };
      })
      .filter((l) => l.importe !== 0)
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

  const activo = bloque("1", "deudora"),
    pasivo = bloque("2", "acreedora"),
    patrimonio = bloque("3", "acreedora");
  // El catálogo separa lo corriente de lo no corriente en el segundo dígito:
  // 11 y 21 son corrientes, 12 y 22 no lo son.
  const corriente = (l: LineaReporte) => l.codigo[1] === "1";
  const seccion = (lineas: LineaReporte[]) => ({
    corriente: lineas.filter(corriente),
    noCorriente: lineas.filter((l) => !corriente(l)),
  });
  const totalActivo = activo.reduce((t, l) => t + l.importe, 0),
    totalPasivo = pasivo.reduce((t, l) => t + l.importe, 0),
    totalPatrimonio =
      patrimonio.reduce((t, l) => t + l.importe, 0) + resultado.utilidadNeta;

  return {
    activo,
    pasivo,
    patrimonio,
    activoPorPlazo: seccion(activo),
    pasivoPorPlazo: seccion(pasivo),
    totalActivo,
    totalPasivo,
    totalPatrimonio,
    totalPasivoPatrimonio: totalPasivo + totalPatrimonio,
    diferencia: totalActivo - (totalPasivo + totalPatrimonio),
    cuadra: totalActivo === totalPasivo + totalPatrimonio,
  };
}

export interface LineaCierre {
  codigoCuenta: string;
  debe: string;
  haber: string;
  descripcion: string;
}

/** Partida de cierre del método analítico, lista para la acción "entries". */
export function asientoCierre(
  config: ConfiguracionLibro,
  cuentas: Cuenta[],
  asientos: Asiento[],
  anio: number,
  inventarioKardex = 0,
): AsientoInput {
  const resultado = estadoResultados(
    config,
    cuentas,
    asientos,
    inventarioKardex,
  );
  const { enlaces } = resultado;
  // El cierre salda el mayor tal como está, con los traslados del Kardex ya
  // aplicados; el informe, en cambio, los excluye para presentar el ejercicio.
  const libro = ledger(
    cuentas,
    asientos.filter((a) => !esAsientoCierre(a, asientos)),
  );

  if (!resultado.inventarioFinalDeclarado)
    throw new Error(
      "Registra el inventario final físico, o configura el Kardex, antes de ejecutar el cierre.",
    );
  const inventario = enlaces.inventarios;
  if (!inventario)
    throw new Error("Enlaza la cuenta de Inventarios antes del cierre.");
  const utilidad = enlaces.utilidad;
  if (!utilidad)
    throw new Error(
      "Enlaza la cuenta de Utilidad del ejercicio antes del cierre.",
    );
  if (subarbol(inventario, libro).some((c) => c.codigo === utilidad.codigo))
    throw new Error("Inventarios y Utilidad deben ser cuentas distintas.");

  const detalles: LineaCierre[] = [];
  const agregar = (codigoCuenta: string, importe: number, texto: string) => {
    if (!importe) return;
    detalles.push({
      codigoCuenta,
      debe: importe > 0 ? money(importe) : "0.00",
      haber: importe < 0 ? money(-importe) : "0.00",
      descripcion: texto,
    });
  };

  // Cada cuenta de resultado se salda por su propio importe: las de ingreso
  // se cargan y las de costo y gasto se abonan, cualquiera sea su clase.
  const resultadoCuentas = libro
    .filter(
      (c) =>
        (c.codigo.startsWith("4") || c.codigo.startsWith("5")) &&
        canPost(c, libro),
    )
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  for (const c of resultadoCuentas) {
    const neto = cents(c.debe.toFixed(2)) - cents(c.haber.toFixed(2));
    agregar(c.codigo, -neto, "Liquidación de cuentas de resultado");
  }

  // La existencia en libros se sustituye por la del conteo físico. Si el
  // Kardex ya trasladó el inventario final, ambas coinciden y no hay nada
  // que ajustar aquí.
  const enLibros = saldoSubarbol(inventario, libro, "deudora");
  if (enLibros !== resultado.inventarioFinal) {
    agregar(
      inventario.codigo,
      resultado.inventarioFinal,
      "Inventario final según conteo físico",
    );
    agregar(
      inventario.codigo,
      -enLibros,
      "Cancelación de la existencia en libros",
    );
  }

  // El patrimonio recibe la diferencia: se abona la utilidad y se carga la
  // pérdida, de modo que la partida quede cuadrada al centavo.
  const cuadre =
    detalles.reduce((t, d) => t + cents(d.haber), 0) -
    detalles.reduce((t, d) => t + cents(d.debe), 0);
  agregar(
    utilidad.codigo,
    cuadre,
    cuadre < 0 ? "Utilidad del ejercicio" : "Pérdida del ejercicio",
  );

  if (detalles.length < 2)
    throw new Error("El ejercicio no tiene movimientos que cerrar.");
  const totalDebe = detalles.reduce((t, d) => t + cents(d.debe), 0),
    totalHaber = detalles.reduce((t, d) => t + cents(d.haber), 0);
  if (totalDebe !== totalHaber)
    throw new Error(
      `La partida de cierre no cuadra: Debe ${money(totalDebe)} / Haber ${money(totalHaber)}.`,
    );

  return {
    referencia: referenciaCierre(anio),
    fecha: `${anio}-12-31`,
    concepto: `Cierre del ejercicio ${anio} · método analítico`,
    tipo: "ajuste",
    modoIva: config.modoIva,
    ajusteInventario: null,
    detalles,
  };
}

/** Desglosa el cierre en partidas balanceadas por cuenta y un traslado final. */
export function prepararSaldoResultados(
  config: ConfiguracionLibro,
  cuentas: Cuenta[],
  asientos: Asiento[],
  anio: number,
  inventarioKardex = 0,
) {
  if (!Number.isInteger(anio) || anio < 1900 || anio > 2200)
    throw new Error("Selecciona un ejercicio válido.");
  if (cierreRegistrado(anio, asientos))
    throw new Error("Las cuentas de este ejercicio ya fueron saldadas. Revierte el cierre para recalcularlas.");
  if (asientos.some((a) => Number(a.fecha.slice(0, 4)) !== anio))
    throw new Error("Selecciona el ejercicio del diario. Para saldar resultados, el libro debe contener un solo ejercicio.");

  const catalogo = ledger(cuentas, asientos);
  const cuentasNuevas: Cuenta[] = [];
  const crear = (prefijo: string, nombre: string) => {
    for (let n = 1; n <= 99; n++) {
      const codigo = prefijo + String(n).padStart(2, "0");
      if (catalogo.some((c) => c.codigo.startsWith(codigo))) continue;
      const f = accountClassification(codigo)!;
      const cuenta: Cuenta = {
        id: `nueva-${codigo}`, codigo, nombre, padreCodigo: prefijo,
        familia: f.id, tipo: f.grupo, naturaleza: f.naturaleza as Cuenta["naturaleza"],
        rubro: f.rubro, activa: true, movimiento: true, debe: 0, haber: 0, saldo: 0,
      };
      if (!canPost(cuenta, catalogo)) break;
      catalogo.push(cuenta);
      cuentasNuevas.push(cuenta);
      return cuenta;
    }
    throw new Error(`No se puede crear la cuenta ${nombre} en ${prefijo}.`);
  };
  let utilidad = resolverCuentaReporte("utilidad", config, catalogo);
  if (!utilidad) {
    if (config.cuentasReporte?.utilidad || catalogo.some((c) => palabras(c.nombre).includes("utilidad")))
      throw new Error("Enlaza una cuenta activa de utilidad en Configuración.");
    utilidad = crear("32", "Utilidad neta antes de impuestos");
  }
  if (utilidad.tipo !== "Patrimonio")
    throw new Error("La cuenta de utilidad debe pertenecer al Patrimonio.");

  const candidatas = catalogo.filter((c) => c.codigo.startsWith("61") &&
    canPost(c, catalogo) && nombra(palabras(c.nombre), "perdida") && nombra(palabras(c.nombre), "ganancia"));
  if (candidatas.length > 1)
    throw new Error("Hay varias cuentas de Pérdidas y ganancias. Conserva una cuenta activa para el cierre.");
  const liquidadora = candidatas[0] ?? crear("61", "Pérdidas y ganancias");
  if (saldoSubarbol(liquidadora, catalogo, "deudora") !== 0)
    throw new Error("La cuenta de Pérdidas y ganancias debe estar saldada antes de comenzar.");
  const configuracion = {
    ...config,
    cuentasReporte: { ...config.cuentasReporte, utilidad: utilidad.codigo },
  };
  const cierre = asientoCierre(configuracion, catalogo, asientos, anio, inventarioKardex);
  // No se omiten cuentas inactivas con saldo: hacerlo dejaría un cierre parcial.
  if (catalogo.some((c) => /^[45]/.test(c.codigo) && c.debe !== c.haber && !canPost(c, catalogo)))
    throw new Error("Activa las cuentas de resultados con saldo antes de saldarlas.");
  const netos = new Map<string, number>();
  for (const d of cierre.detalles)
    netos.set(d.codigoCuenta, (netos.get(d.codigoCuenta) ?? 0) + cents(d.debe) - cents(d.haber));
  const netoUtilidad = netos.get(utilidad.codigo) ?? 0;
  netos.delete(utilidad.codigo);
  const linea = (codigoCuenta: string, neto: number) => ({
    codigoCuenta, debe: money(Math.max(neto, 0)), haber: money(Math.max(-neto, 0)),
  });
  const partidas: AsientoInput[] = [];
  const agregar = (codigo: string, neto: number, concepto: string) => {
    if (!neto) return;
    partidas.push({
      ...cierre,
      referencia: `${referenciaCierre(anio)}-RESULTADOS-VISTA-${partidas.length + 1}`,
      concepto,
      detalles: [linea(codigo, neto), linea(liquidadora.codigo, -neto)],
    });
  };
  for (const [codigo, neto] of netos) {
    const cuenta = catalogo.find((c) => c.codigo === codigo)!;
    agregar(codigo, neto, `${/^[45]/.test(codigo) ? "Saldar" : "Ajustar"} ${cuenta.nombre} contra Pérdidas y ganancias`);
  }
  agregar(utilidad.codigo, netoUtilidad, "Traslado del resultado neto antes de impuestos");
  if (!partidas.length) throw new Error("No hay cuentas de resultados con saldo para liquidar.");
  return { partidas, cuentasNuevas, configuracion, utilidad, liquidadora };
}
