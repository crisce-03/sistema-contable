const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  localCommand,
  emptyBook,
  taxBreakdown,
} = require("../.test-build/local.cjs");
const { cents, trial } = require("../.test-build/core.cjs");
const catalog = require("../examples/catalogo.json");
const partialCatalog = require("../examples/catalogo-parcial.json");
const partial = require("../examples/parcial-con-traspasos.json");
const noTransfer = require("../examples/parcial-sin-traspasos.json");
const apply = (s, a, d) => localCommand(s, a, d).estado;
const init = () => apply(emptyBook(2026), "catalog", catalog);
test("default settings and corrected account", () => {
  const s = init();
  assert.equal(s.configuracion.modoIva, "mas_iva");
  assert.equal(s.configuracion.modoInventario, "traslados_compras");
  assert.equal(s.cuentas.length, 17);
  assert.equal(
    s.cuentas.find((c) => c.codigo === "4103").familia,
    "gastos_venta",
  );
  assert.equal(
    s.cuentas.some((c) => c.codigo === "4101"),
    false,
  );
});
test("IVA 13% added or included with exact cents and expense rounding", () => {
  assert.deepEqual(taxBreakdown("100", "mas_iva"), {
    base: 10000,
    iva: 1300,
    total: 11300,
  });
  assert.deepEqual(taxBreakdown("113", "incluido"), {
    base: 10000,
    iva: 1300,
    total: 11300,
  });
  assert.deepEqual(taxBreakdown("75.50", "mas_iva"), {
    base: 7550,
    iva: 982,
    total: 8532,
  });
  assert.throws(() => taxBreakdown("0", "mas_iva"));
});
test("full partial matches reviewed ledger and both sides of accounting equation", () => {
  let s = apply(emptyBook(2026), "catalog", partialCatalog);
  s = apply(s, "entries", partial);
  const sum = (f) =>
    s.cuentas.filter((c) => c.familia === f).reduce((t, c) => t + c.saldo, 0);
  assert.equal(sum("efectivo"), 73961.13);
  assert.equal(sum("compras"), 15600);
  assert.equal(sum("inventarios"), 13194);
  assert.equal(sum("ppe"), 23094);
  assert.equal(sum("iva_credito"), 1277.32);
  const profit =
    Math.round(
      (sum("ventas") -
        sum("compras") -
        sum("gastos_venta") -
        sum("financieros")) *
        100,
    ) / 100;
  assert.equal(profit, 1874.5);
  const assets = s.cuentas
    .filter((c) => c.tipo === "Activo")
    .reduce((t, c) => t + Math.round(c.saldo * 100), 0);
  const other = s.cuentas
    .filter((c) => c.tipo === "Pasivo" || c.tipo === "Patrimonio")
    .reduce((t, c) => t + Math.round(c.saldo * 100), 0);
  assert.equal(assets, 11152645);
  assert.equal(assets, other + Math.round(profit * 100));
  const rows = trial(s.cuentas);
  assert.equal(
    rows.reduce((t, c) => t + cents(c.deudor), 0),
    rows.reduce((t, c) => t + cents(c.acreedor), 0),
  );
});
test("import idempotency and batch rollback without input mutation", () => {
  let s = apply(emptyBook(2026), "catalog", partialCatalog);
  s = apply(s, "entries", partial);
  const before = JSON.stringify(s);
  const r = localCommand(s, "entries", partial);
  assert.equal(r.insertados, 0);
  assert.equal(r.omitidos, 9);
  const bad = structuredClone(partial);
  bad.asientos[0].concepto = "changed";
  assert.throws(() => localCommand(s, "entries", bad));
  assert.equal(JSON.stringify(s), before);
  let base = apply(emptyBook(2026), "catalog", partialCatalog);
  const mixed = structuredClone(partial);
  mixed.asientos[2].detalles[0].debe = "9999.00";
  assert.throws(() => localCommand(base, "entries", mixed));
  assert.equal(base.asientos.length, 0);
});
test("explicit inventories accept raw entries and reject duplicate inventory pathways", () => {
  let s = apply(emptyBook(2026), "catalog", partialCatalog);
  s = apply(s, "settings", {
    modoIva: "mas_iva",
    modoInventario: "inventarios_explicitos",
  });
  s = apply(s, "entries", noTransfer);
  assert.equal(s.cuentas.find((c) => c.familia === "compras").saldo, 7500);
  assert.throws(
    () =>
      localCommand(s, "entries", {
        version: 1,
        asientos: partial.asientos.slice(7),
      }),
    /no permite/,
  );
  assert.equal(21294 + 7500 - 13194, 15600);
});
test("settings cannot change retroactively; mixed VAT import rejected even if balanced", () => {
  let s = init();
  assert.throws(
    () =>
      localCommand(
        s,
        "entries",
        require("../examples/venta-iva-incluido.json"),
      ),
    /IVA/,
  );
  s = apply(s, "entries", require("../examples/asientos-ejemplo.json"));
  assert.throws(() =>
    localCommand(s, "settings", {
      modoIva: "incluido",
      modoInventario: "traslados_compras",
    }),
  );
});
test("unmarked or incorrect inventory adjustments rejected; duplicates blocked", () => {
  let s = apply(emptyBook(2026), "catalog", partialCatalog);
  const item = structuredClone(partial.asientos[7]);
  item.ajusteInventario = null;
  assert.throws(() =>
    localCommand(s, "entries", { version: 1, asientos: [item] }),
  );
  item.ajusteInventario = "final";
  assert.throws(() =>
    localCommand(s, "entries", { version: 1, asientos: [item] }),
  );
  s = apply(s, "entries", partial);
  assert.throws(() =>
    localCommand(s, "entries", {
      version: 1,
      asientos: [{ ...partial.asientos[7], referencia: "OTRA" }],
    }),
  );
});
test("local periods, reversals, hierarchy safeguards and inactive accounts", () => {
  let s = apply(emptyBook(2026), "catalog", partialCatalog);
  s = apply(s, "entries", noTransfer);
  const original = s.asientos[0];
  s = apply(s, "period", { anio: 2026, cerrado: true });
  assert.throws(() =>
    localCommand(s, "reverse", {
      id: original.id,
      fecha: "2026-01-31",
      motivo: "Corrección",
    }),
  );
  s = apply(s, "period", { anio: 2026, cerrado: false });
  s = apply(s, "reverse", {
    id: original.id,
    fecha: "2026-01-31",
    motivo: "Corrección",
  });
  assert.equal(s.asientos.at(-1).detalles[0].haber, 42588);
  assert.throws(() =>
    localCommand(s, "reverse", {
      id: original.id,
      fecha: "2026-01-31",
      motivo: "Otra",
    }),
  );
  assert.throws(() =>
    localCommand(s, "catalog", {
      version: 1,
      cuentas: [
        {
          codigo: "11010201",
          nombre: "Cuenta banco",
          familia: "efectivo",
          padreCodigo: "110102",
          activa: true,
        },
      ],
    }),
  );
});
