const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  localCommand,
  emptyBook,
  calcularLiquidacionIva,
  inventarioFinalKardex,
} = require("../.test-build/local.cjs");
const {
  estadoResultados,
  balanceGeneral,
  asientoCierre,
  cierreRegistrado,
  resolverEnlaces,
} = require("../.test-build/reports.cjs");
const catalogo = require("../examples/analitico-catalogo.json");
const diario = require("../examples/analitico-asientos.json");

const apply = (s, a, d) => localCommand(s, a, d).estado;
const base = () => {
  let s = apply(emptyBook(2026), "settings", {
    modoIva: "incluido",
    modoInventario: "traslados_compras",
  });
  s = apply(s, "catalog", catalogo);
  return apply(s, "entries", diario);
};
const conInventario = (s, inventarioFinalFisico) =>
  apply(s, "settings", { ...s.configuracion, inventarioFinalFisico });

test("report roles are recognised from the catalog without hardcoded codes", () => {
  const s = base();
  const enlaces = resolverEnlaces(s.configuracion, s.cuentas);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(enlaces).map(([rol, c]) => [rol, c.codigo]),
    ),
    {
      inventarios: "1102",
      compras: "4101",
      gastosCompra: "4106",
      devolCompras: "5102",
      ventas: "5101",
      devolVentas: "4102",
      utilidad: "3201",
    },
  );
});

test("the analytic income statement follows purchases, returns and the physical count", () => {
  const s = conInventario(base(), "9000.00");
  const r = estadoResultados(s.configuracion, s.cuentas, s.asientos);
  assert.equal(r.ventas, 5000000);
  assert.equal(r.devolVentas, 400000);
  assert.equal(r.ventasNetas, 4600000);
  assert.equal(r.comprasTotales, 3150000);
  assert.equal(r.devolCompras, 250000);
  assert.equal(r.comprasNetas, 2900000);
  assert.equal(r.inventarioInicial, 1200000);
  assert.equal(r.mercaderiaDisponible, 4100000);
  assert.equal(r.inventarioFinal, 900000);
  assert.equal(r.costoVentas, 3200000);
  assert.equal(r.utilidadBruta, 1400000);
  assert.deepEqual(
    r.gastosOperacion.map((l) => [l.codigo, l.importe]),
    [
      ["4103", 120000],
      ["4107", 600000],
      ["4108", 400000],
    ],
  );
  assert.equal(r.totalGastos, 1120000);
  assert.equal(r.totalOtros, 0);
  assert.equal(r.utilidadNeta, 280000);
});

test("the balance sheet carries the final inventory and stays square to the cent", () => {
  const s = conInventario(base(), "9000.00");
  const b = balanceGeneral(estadoResultados(s.configuracion, s.cuentas, s.asientos));
  assert.equal(b.activo.find((l) => l.codigo === "1102").importe, 900000);
  assert.equal(b.totalActivo, 8985500);
  assert.equal(b.totalPasivo, 4705500);
  assert.equal(b.totalPatrimonio, 4280000);
  assert.equal(b.diferencia, 0);
  assert.ok(b.cuadra);
});

test("any physical count keeps the balance square, because cost of sales absorbs it", () => {
  for (const conteo of ["0.00", "1234.56", "9000.00", "41000.00", "50000.00"]) {
    const s = conInventario(base(), conteo);
    const r = estadoResultados(s.configuracion, s.cuentas, s.asientos);
    const b = balanceGeneral(r);
    assert.equal(b.diferencia, 0, `descuadre con inventario final ${conteo}`);
    assert.equal(r.utilidadBruta - r.totalGastos + r.totalOtros, r.utilidadNeta);
  }
});

test("closing zeroes every result account, restates inventory and credits the profit", () => {
  const s = conInventario(base(), "9000.00");
  const partida = asientoCierre(s.configuracion, s.cuentas, s.asientos, 2026);
  assert.equal(partida.referencia, "CIERRE-2026");
  assert.equal(partida.fecha, "2026-12-31");
  const total = (lado) =>
    partida.detalles.reduce((t, d) => t + Math.round(Number(d[lado]) * 100), 0);
  assert.equal(total("debe"), total("haber"));
  const utilidad = partida.detalles.find((d) => d.codigoCuenta === "3201");
  assert.equal(utilidad.haber, "2800.00");
  assert.equal(utilidad.debe, "0.00");

  const cerrado = apply(s, "entries", {
    version: 1,
    modoIva: "incluido",
    asientos: [partida],
  });
  assert.ok(cerrado.asientos.some((a) => a.referencia === "CIERRE-2026"));
  assert.ok(cierreRegistrado(2026, cerrado.asientos));
  const saldo = (codigo) =>
    cerrado.cuentas.find((c) => c.codigo === codigo).saldo;
  for (const codigo of ["4101", "410201", "4106", "4107", "4108", "5101", "510201"])
    assert.equal(saldo(codigo), 0, `${codigo} quedó con saldo tras el cierre`);
  assert.equal(saldo("1102"), 9000);
  assert.equal(saldo("3201"), 2800);

  // El informe se mide antes del cierre, de modo que no cambia al registrarlo.
  const antes = estadoResultados(s.configuracion, s.cuentas, s.asientos);
  const despues = estadoResultados(
    cerrado.configuracion,
    cerrado.cuentas,
    cerrado.asientos,
  );
  assert.equal(despues.utilidadNeta, antes.utilidadNeta);
  assert.equal(despues.costoVentas, antes.costoVentas);
  assert.ok(balanceGeneral(despues).cuadra);
});

const producto = {
  id: "laptop",
  nombre: "Laptop",
  costo: "20.00",
  venta: "40.00",
  inicial: 600,
  inicio: "2026-01-01",
  fin: "2026-12-31",
  cuentas: {
    compras: "4101",
    ventas: "5101",
    devolCompras: "510201",
    devolVentas: "410201",
  },
};
const conKardex = (s = base()) => apply(s, "kardex", producto);
const saldoDe = (s, codigo) =>
  s.cuentas.find((c) => c.codigo === codigo).saldo;

test("saving the kardex posts both inventory transfers into the ledger", () => {
  const s = conKardex();
  const inicial = s.asientos.find((a) => a.ajusteInventario === "inicial");
  const final = s.asientos.find((a) => a.ajusteInventario === "final");

  assert.ok(inicial, "no se creó el traslado inicial");
  assert.ok(final, "no se creó el traslado final");
  assert.equal(inicial.referencia, "KARDEX-INI-laptop");
  assert.equal(final.referencia, "KARDEX-FIN-laptop");
  assert.equal(inicial.fecha, "2026-01-01");
  assert.equal(final.fecha, "2026-12-31");

  // El inicial sale de Inventarios hacia Compras; el final regresa.
  const linea = (a, codigo) => a.detalles.find((d) => d.codigoCuenta === codigo);
  assert.deepEqual(
    [linea(inicial, "4101").debe, linea(inicial, "1102").haber],
    [12000, 12000],
  );
  assert.deepEqual(
    [linea(final, "1102").debe, linea(final, "4101").haber],
    [16500, 16500],
  );

  // Es lo que el usuario ve en la Mayorización.
  assert.equal(saldoDe(s, "1102"), 16500);
  assert.equal(saldoDe(s, "4101"), 25500);
});

test("the transfers follow the journal and the parameters without duplicating", () => {
  let s = conKardex();
  const asientos = s.asientos.length;

  // Guardar otra vez no crea un segundo par de traslados.
  s = apply(s, "kardex", producto);
  assert.equal(s.asientos.length, asientos);
  assert.equal(saldoDe(s, "1102"), 16500);

  // Una venta nueva reduce la existencia y el traslado final se recalcula.
  s = apply(s, "entries", {
    version: 1,
    modoIva: "incluido",
    asientos: [
      {
        referencia: "AN-2026-014",
        fecha: "2026-09-10",
        concepto: "Venta adicional",
        tipo: "normal",
        ajusteInventario: null,
        detalles: [
          { codigoCuenta: "110401", debe: "11300.00", haber: "0.00" },
          { codigoCuenta: "5101", debe: "0.00", haber: "10000.00" },
          { codigoCuenta: "2102", debe: "0.00", haber: "1300.00" },
        ],
      },
    ],
  });
  assert.equal(s.asientos.length, asientos + 1);
  // 825 − 10000/40 = 575 unidades · $20
  assert.equal(saldoDe(s, "1102"), 11500);
  assert.equal(saldoDe(s, "4101"), 30500);

  // El traslado inicial mueve el saldo real de Inventarios, no unidades ×
  // costo, así que declarar otras unidades nunca descuadra el mayor: la
  // cuenta se vacía y recibe la existencia final que calcula el Kardex.
  s = apply(s, "kardex", { ...producto, inicial: 700 });
  assert.equal(s.asientos.length, asientos + 1);
  // 700 + 1500 − 100 − 1250 − 250 + 75 = 675 unidades · $20
  assert.equal(saldoDe(s, "1102"), 13500);
  assert.equal(saldoDe(s, "4101"), 28500);
});

test("a transfer reverted on purpose is not recreated behind the user's back", () => {
  let s = conKardex();
  const final = s.asientos.find((a) => a.ajusteInventario === "final");
  s = apply(s, "reverse", {
    id: final.id,
    fecha: "2026-12-31",
    motivo: "Ajuste manual del cierre",
  });
  s = apply(s, "kardex", producto);
  const vigentes = s.asientos.filter(
    (a) => a.ajusteInventario === "final" && a.tipo === "ajuste",
  );
  assert.equal(vigentes.length, 1);
  assert.ok(s.asientos.some((r) => r.reversaDe === final.id));
  assert.equal(saldoDe(s, "1102"), 0);
});

test("the income statement ignores the transfers, so the result never doubles", () => {
  const sinKardex = conInventario(base(), "16500.00");
  const conTraslados = conInventario(conKardex(), "16500.00");
  const medir = (s) => estadoResultados(s.configuracion, s.cuentas, s.asientos);
  const a = medir(sinKardex),
    b = medir(conTraslados);

  assert.equal(b.inventarioInicial, 1200000);
  assert.equal(b.compras, 3000000);
  assert.equal(b.costoVentas, 2450000);
  assert.equal(b.utilidadNeta, 1030000);
  assert.deepEqual(
    [b.inventarioInicial, b.compras, b.costoVentas, b.utilidadNeta],
    [a.inventarioInicial, a.compras, a.costoVentas, a.utilidadNeta],
  );
  assert.ok(balanceGeneral(b).cuadra);
});

test("closing still zeroes the ledger when the kardex already moved inventory", () => {
  const s = conInventario(conKardex(), "16500.00");
  const partida = asientoCierre(s.configuracion, s.cuentas, s.asientos, 2026);
  // La existencia en libros ya es la del conteo: no se ajusta otra vez.
  assert.ok(!partida.detalles.some((d) => d.codigoCuenta === "1102"));

  const cerrado = apply(s, "entries", {
    version: 1,
    modoIva: "incluido",
    asientos: [partida],
  });
  for (const codigo of ["4101", "4106", "410201", "4107", "4108", "5101", "510201"])
    assert.equal(saldoDe(cerrado, codigo), 0, `${codigo} no quedó saldado`);
  assert.equal(saldoDe(cerrado, "1102"), 16500);
  assert.equal(saldoDe(cerrado, "3201"), 10300);
});

test("configuring the kardex reports why the transfer cannot be posted", () => {
  let s = base();
  s = apply(s, "settings", {
    ...s.configuracion,
    cuentasReporte: { inventarios: "4101" },
  });
  assert.throws(() => apply(s, "kardex", producto), /Inventarios/);
});

test("switching to explicit inventories reverses the transfers and leaves the ledger raw", () => {
  const conTraslados = conKardex();
  assert.equal(saldoDe(conTraslados, "1102"), 16500);
  assert.equal(saldoDe(conTraslados, "4101"), 25500);

  const explicitos = apply(conTraslados, "settings", {
    ...conTraslados.configuracion,
    modoInventario: "inventarios_explicitos",
  });

  // Inventarios conserva su apertura y Compras queda en bruto.
  assert.equal(saldoDe(explicitos, "1102"), 12000);
  assert.equal(saldoDe(explicitos, "4101"), 30000);
  assert.equal(
    explicitos.asientos.filter(
      (a) =>
        a.tipo === "ajuste" &&
        a.ajusteInventario &&
        !explicitos.asientos.some((r) => r.reversaDe === a.id),
    ).length,
    0,
  );
  // Se revierten, nunca se borran.
  assert.equal(
    explicitos.asientos.filter((a) => a.tipo === "reversion").length,
    2,
  );

  // Guardar el Kardex ya no registra traslados.
  const otra = apply(explicitos, "kardex", producto);
  assert.equal(saldoDe(otra, "1102"), 12000);
  assert.equal(saldoDe(otra, "4101"), 30000);
});

test("the income statement and the closing agree under both inventory methods", () => {
  const traslados = conInventario(conKardex(), "16500.00");
  const explicitos = conInventario(
    apply(conKardex(), "settings", {
      ...conKardex().configuracion,
      modoInventario: "inventarios_explicitos",
    }),
    "16500.00",
  );
  const medir = (s) => estadoResultados(s.configuracion, s.cuentas, s.asientos);
  const a = medir(traslados),
    b = medir(explicitos);

  assert.deepEqual(
    [b.inventarioInicial, b.compras, b.costoVentas, b.utilidadNeta],
    [1200000, 3000000, 2450000, 1030000],
  );
  assert.deepEqual(
    [a.inventarioInicial, a.compras, a.costoVentas, a.utilidadNeta],
    [b.inventarioInicial, b.compras, b.costoVentas, b.utilidadNeta],
  );
  assert.ok(balanceGeneral(b).cuadra);

  // Con inventarios explícitos el cierre sí traslada la existencia.
  const partida = asientoCierre(
    explicitos.configuracion,
    explicitos.cuentas,
    explicitos.asientos,
    2026,
  );
  const cerrado = apply(explicitos, "entries", {
    version: 1,
    modoIva: "incluido",
    asientos: [partida],
  });
  assert.equal(saldoDe(cerrado, "1102"), 16500);
  assert.equal(saldoDe(cerrado, "3201"), 10300);
  assert.equal(saldoDe(cerrado, "4101"), 0);
});

test("switching back to transfers always moves inventory, even with an odd unit cost", () => {
  let s = apply(base(), "settings", {
    ...base().configuracion,
    modoInventario: "inventarios_explicitos",
  });
  // Un costo unitario que no cuadra al centavo con la apertura: 700 × $20 =
  // $14,000 frente a los $12,000 que tiene la cuenta. Es lo que ocurre con
  // cualquier promedio ponderado real.
  s = apply(s, "kardex", { ...producto, inicial: 700 });
  assert.equal(saldoDe(s, "1102"), 12000);

  s = apply(s, "settings", {
    ...s.configuracion,
    modoInventario: "traslados_compras",
  });
  // El traslado inicial vacía la cuenta por su saldo real y el final trae la
  // existencia del Kardex: 925 unidades · $20.
  assert.equal(saldoDe(s, "1102"), 18500);
  assert.equal(saldoDe(s, "4101"), 23500);
});

test("returning to the transfer method registers the transfers again", () => {
  let s = conKardex();
  s = apply(s, "settings", {
    ...s.configuracion,
    modoInventario: "inventarios_explicitos",
  });
  s = apply(s, "settings", {
    ...s.configuracion,
    modoInventario: "traslados_compras",
  });
  assert.equal(saldoDe(s, "1102"), 16500);
  assert.equal(saldoDe(s, "4101"), 25500);
});

test("closing refuses to run without a physical count or a kardex", () => {
  const s = base();
  assert.throws(
    () => asientoCierre(s.configuracion, s.cuentas, s.asientos, 2026),
    /inventario final físico/,
  );
});

test("the kardex supplies the final inventory when no count was typed in", () => {
  const s = conKardex();
  const existencia = inventarioFinalKardex(s.kardex, s.asientos);
  assert.equal(existencia, 1650000);

  // Sin conteo físico, el informe ya no cae a cero: usa el Kardex.
  const sinDato = estadoResultados(s.configuracion, s.cuentas, s.asientos);
  assert.equal(sinDato.inventarioFinal, 0);
  assert.equal(sinDato.inventarioFinalOrigen, "sin-dato");

  const r = estadoResultados(s.configuracion, s.cuentas, s.asientos, existencia);
  assert.equal(r.inventarioFinal, 1650000);
  assert.equal(r.inventarioFinalOrigen, "kardex");
  assert.equal(r.costoVentas, 2450000);
  assert.equal(r.utilidadNeta, 1030000);
  assert.ok(balanceGeneral(r).cuadra);

  // El cierre se puede ejecutar solo con el Kardex.
  const partida = asientoCierre(
    s.configuracion,
    s.cuentas,
    s.asientos,
    2026,
    existencia,
  );
  const cerrado = apply(s, "entries", {
    version: 1,
    modoIva: "incluido",
    asientos: [partida],
  });
  assert.equal(saldoDe(cerrado, "3201"), 10300);
  assert.equal(saldoDe(cerrado, "1102"), 16500);
});

test("a typed physical count overrides the kardex and absorbs the difference", () => {
  const s = conInventario(conKardex(), "15000.00");
  const existencia = inventarioFinalKardex(s.kardex, s.asientos);
  const r = estadoResultados(s.configuracion, s.cuentas, s.asientos, existencia);

  assert.equal(r.inventarioFinalOrigen, "conteo");
  assert.equal(r.inventarioFinal, 1500000);
  assert.equal(r.inventarioFinalKardex, 1650000);
  // El faltante de 1500 engorda el costo de ventas y reduce la utilidad.
  assert.equal(r.costoVentas, 2600000);
  assert.equal(r.utilidadNeta, 880000);
  assert.ok(balanceGeneral(r).cuadra);
});

test("VAT settles a month whose balance turned the other way after a reversal", () => {
  let s = base();
  const venta = s.asientos.find((a) => a.referencia === "AN-2026-006");
  s = apply(s, "reverse", {
    id: venta.id,
    fecha: "2026-04-15",
    motivo: "Anulación del cliente",
  });

  const r = calcularLiquidacionIva(s, "2026-04");
  assert.equal(r.df, -650000);
  assert.equal(r.cf, 78000);
  assert.ok(r.invertidos);

  // Antes esto era imposible: el mes quedaba sin poder liquidarse nunca.
  s = apply(s, "liquidacion-iva", { mes: "2026-04", destino: "1106" });
  const partida = s.asientos.at(-1);
  const total = (lado) =>
    partida.detalles.reduce((t, d) => t + Math.round(d[lado] * 100), 0);
  assert.equal(total("debe"), total("haber"));
  // El débito fiscal se cancela por el haber, al revés de lo habitual.
  const debito = partida.detalles.find((d) => d.codigoCuenta === "2102");
  assert.equal(debito.haber, 6500);
  assert.equal(debito.debe, 0);
  assert.equal(saldoDe(s, "1106"), 7280);
  // Solo se cancela el mes liquidado: marzo sigue pendiente.
  assert.equal(saldoDe(s, "2102"), 5980);
});

test("an unusable VAT account no longer blocks every later command", () => {
  let s = apply(base(), "liquidacion-iva", {
    mes: "2026-02",
    destino: "1106",
  });
  // Febrero queda saldado; abril y mayo siguen pendientes.
  assert.equal(saldoDe(s, "1103"), 1300);

  // Desactivar la cuenta impide recalcular el mes ya liquidado.
  s = apply(s, "catalog", {
    version: 1,
    cuentas: [
      {
        codigo: "1103",
        nombre: "IVA - Crédito fiscal",
        padreCodigo: "11",
        activa: false,
      },
    ],
  });
  assert.throws(() => calcularLiquidacionIva(s, "2026-02"), /Asigna IVA/);

  // El libro sigue operable: se puede reactivar la cuenta y seguir.
  const periodo = apply(s, "period", { anio: 2027, cerrado: false });
  assert.ok(periodo.periodos.some((p) => p.anio === 2027));
});

test("settings reject an unknown role and a malformed physical count", () => {
  const s = base();
  assert.throws(
    () => apply(s, "settings", { ...s.configuracion, cuentasReporte: { fantasia: "1102" } }),
    /Rol de informe desconocido/,
  );
  assert.throws(
    () => apply(s, "settings", { ...s.configuracion, cuentasReporte: { inventarios: "9999" } }),
    /cuenta activa/,
  );
  assert.throws(() => conInventario(s, "1.234,50"), /Importe inválido/);
  const enlazado = apply(s, "settings", {
    ...s.configuracion,
    cuentasReporte: { inventarios: "1102", ventas: "5101" },
  });
  assert.equal(enlazado.configuracion.cuentasReporte.inventarios, "1102");
});
