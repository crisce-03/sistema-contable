const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  localCommand,
  emptyBook,
  taxBreakdown,
  draftLineDetails,
  resolveIvaAccount,
} = require("../.test-build/local.cjs");
const { cents, trial, canPost, majorLedger, parseEntries } = require("../.test-build/core.cjs");
const catalog = require("../examples/catalogo.json");
const partialCatalog = require("../examples/catalogo-parcial.json");
const partial = require("../examples/parcial-con-traspasos.json");
const noTransfer = require("../examples/parcial-sin-traspasos.json");
const apply = (s, a, d) => localCommand(s, a, d).estado;
const init = () => apply(emptyBook(2026), "catalog", catalog);
const ivaBook = () => apply(emptyBook(2026), "catalog", require("../examples/catalogo-para-asientosguia1.json"));
const ivaConfig = (modoIva = "incluido") => ({ ...ivaBook().configuracion, modoIva });
const calculate = (line, modoIva = "incluido") => draftLineDetails(line, ivaConfig(modoIva), ivaBook().cuentas);
test("line VAT separates included totals or adds tax to an entered base without mutating input", () => {
  const base = { codigoCuenta: "4101", debe: "8849.56", haber: "0.00", descripcion: "Queso",
    iva: { tipo: "credito" } };
  const snapshot = structuredClone(base);
  const calculated = calculate(base, "mas_iva");
  assert.deepEqual(calculated.desglose, { base: 884956, iva: 115044, total: 1000000 });
  assert.deepEqual(calculated.detalles, [
    { codigoCuenta: "4101", debe: "8849.56", haber: "0.00", descripcion: "Queso" },
    { codigoCuenta: "1103", debe: "1150.44", haber: "0.00", descripcion: "IVA 13% de 4101" },
  ]);
  const included = { ...base, debe: "10000.00" };
  assert.deepEqual(calculate(included), calculated);
  assert.deepEqual(base, snapshot);
  assert.equal(included.debe, "10000.00");
  // An already calculated base must not silently be treated as a gross total.
  assert.equal(calculate(base).detalles[0].debe, "7831.47");
  assert.equal(calculate({ ...base, debe: "100.00" }, "mas_iva").detalles[1].debe, "13.00");
  assert.deepEqual(calculate(base, "mas_iva"), calculated);
});

test("tax lines follow their source independently and disappear when disabled or removed", () => {
  const debit = { codigoCuenta: "4101", debe: "113.00", haber: "0.00", descripcion: "Compra",
    iva: { tipo: "credito" } };
  const credit = { codigoCuenta: "5101", debe: "0.00", haber: "226.00", descripcion: "Venta",
    iva: { tipo: "debito" } };
  const expand = (lines) => lines.flatMap((line) => calculate(line).detalles);
  const both = expand([debit, credit]);
  assert.equal(both.length, 4);
  assert.equal(both[1].debe, "13.00");
  assert.equal(both[3].haber, "26.00");
  assert.equal(both[3].debe, "0.00");
  const disabled = expand([{ ...debit, iva: undefined }, credit]);
  assert.equal(disabled.length, 3);
  assert.equal(disabled[0].debe, "113.00");
  assert.ok(disabled.every((line) => line.codigoCuenta !== "1103"));
  assert.deepEqual(expand([credit]), both.slice(2));
  const transfer = [
    { codigoCuenta: "110102", debe: "20000.00", haber: "0.00", descripcion: "Depósito" },
    { codigoCuenta: "110101", debe: "0.00", haber: "20000.00", descripcion: "Salida de caja" },
  ];
  assert.deepEqual(expand(transfer), transfer);
  assert.deepEqual(expand([debit, credit]), both);
});

test("calculated VAT saves final amounts once with custom account codes and survives JSON import", () => {
  let s = apply(emptyBook(2026), "catalog", require("../examples/catalogo-para-asientosguia1.json"));
  s = apply(s, "settings", { ...s.configuracion, modoIva: "incluido" });
  const source = { codigoCuenta: "4101", debe: "10000.00", haber: "0.00", descripcion: "Compra",
    iva: { tipo: "credito" } };
  const build = (line) => ({ version: 1, asientos: [{ referencia: "IVA-LINEA", fecha: "2026-01-05",
    concepto: "Compra de queso", tipo: "normal", modoIva: "incluido", detalles: [
      ...draftLineDetails(line, s.configuracion, s.cuentas).detalles,
      { codigoCuenta: "210101", debe: "0.00", haber: "10000.00", descripcion: "Proveedor" },
    ],
  }] });
  const data = build(source);
  const saved = apply(s, "entries", data);
  assert.equal(saved.asientos[0].detalles.length, 3);
  assert.deepEqual(saved.asientos[0].detalles.map((d) => [d.codigoCuenta, d.debe, d.haber]), [
    ["4101", 8849.56, 0], ["1103", 1150.44, 0], ["210101", 0, 10000],
  ]);
  assert.ok(data.asientos[0].detalles.every((d) => !("iva" in d)));
  assert.deepEqual(apply(saved, "init", {}), saved);
  assert.equal(localCommand(saved, "entries", data).omitidos, 1);
  assert.equal(majorLedger(saved.cuentas, saved.asientos).find((c) => c.codigo === "1103").debe, 1150.44);
  assert.throws(() => apply(s, "entries", build({ ...source, iva: { tipo: "" } })));
  const inactive = { ...s, cuentas: s.cuentas.map((c) => c.codigo === "1103" ? { ...c, activa: false } : c) };
  assert.throws(() => apply(inactive, "entries", data), /inactiva/);
});

test("VAT draft rejects invalid amounts, double-sided values and tax on the same account", () => {
  const line = { codigoCuenta: "4101", debe: "100.00", haber: "0.00", descripcion: "",
    iva: { tipo: "credito" } };
  for (const debe of ["", "0", "-1", "1.001", "1,000", "abc"])
    assert.throws(() => calculate({ ...line, debe }));
  assert.throws(() => calculate({ ...line, haber: "1.00" }), /un solo lado/);
  assert.throws(() => calculate({ ...line, iva: { tipo: "otro" } }), /Selecciona IVA/);
  assert.throws(() => calculate({ ...line, codigoCuenta: "1103" }), /distinta/);
  const small = calculate({ ...line, debe: "0.01" });
  assert.equal(small.detalles.length, 1);
  assert.deepEqual(small.desglose, { base: 1, iva: 0, total: 1 });
});

test("VAT type selects the account while the entered amount alone determines the side", () => {
  for (const modo of ["incluido", "mas_iva"]) {
    for (const tipo of ["credito", "debito"]) {
      for (const lado of ["debe", "haber"]) {
        const opposite = lado === "debe" ? "haber" : "debe";
        const line = { codigoCuenta: "4101", debe: "0.00", haber: "0.00", descripcion: "",
          [lado]: modo === "incluido" ? "113.00" : "100.00", iva: { tipo } };
        const { detalles, desglose } = calculate(line, modo);
        assert.deepEqual(desglose, { base: 10000, iva: 1300, total: 11300 });
        assert.equal(detalles[0][lado], "100.00");
        assert.equal(detalles[1][lado], "13.00");
        assert.equal(detalles[1][opposite], "0.00");
        assert.equal(detalles[1].codigoCuenta, tipo === "credito" ? "1103" : "2102");
      }
    }
  }
});

test("VAT accounts resolve from custom or PDF names and require assignment when ambiguous", () => {
  const custom = ivaBook();
  const pdf = apply(emptyBook(2026), "catalog", require("../examples/catalogo-pdf-importable.json"));
  for (const [book, credito, debito] of [[custom, "1103", "2102"], [pdf, "1109", "2108"]]) {
    assert.equal(resolveIvaAccount("credito", book.configuracion, book.cuentas).codigo, credito);
    assert.equal(resolveIvaAccount("debito", book.configuracion, book.cuentas).codigo, debito);
  }
  const ambiguous = custom.cuentas.map((c) => c.codigo === "1104" ? { ...c, nombre: "IVA crédito fiscal" } : c);
  assert.equal(resolveIvaAccount("credito", custom.configuracion, ambiguous), undefined);
  assert.equal(resolveIvaAccount("credito", { ...custom.configuracion, cuentaIvaCredito: "1103" }, ambiguous).codigo, "1103");
  const inactive = custom.cuentas.map((c) => c.codigo === "1103" ? { ...c, activa: false } : c);
  assert.equal(resolveIvaAccount("credito", { ...custom.configuracion, cuentaIvaCredito: "1103" }, inactive), undefined);
  assert.throws(() => draftLineDetails({ codigoCuenta: "4101", debe: "100", haber: "0", descripcion: "", iva: { tipo: "credito" } }, custom.configuracion, ambiguous), /Configuración/);
});

test("VAT account settings persist, validate postable accounts and allow returning to automatic selection", () => {
  const original = ivaBook();
  const updated = apply(original, "settings", { ...original.configuracion, cuentaIvaCredito: "1103", cuentaIvaDebito: "2102" });
  assert.deepEqual(apply(updated, "init", {}), updated);
  const changed = apply(updated, "settings", { modoIva: "incluido", modoInventario: updated.configuracion.modoInventario });
  assert.equal(changed.configuracion.cuentaIvaCredito, "1103");
  assert.equal(changed.configuracion.cuentaIvaDebito, "2102");
  for (const code of ["1", "11", "9999", null, 1103])
    assert.throws(() => apply(updated, "settings", { ...updated.configuracion, cuentaIvaCredito: code }));
  assert.throws(() => apply(updated, "settings", { ...updated.configuracion, cuentaIvaDebito: "1103" }), /distintas/);
  const inactive = { ...updated, cuentas: updated.cuentas.map((c) => c.codigo === "1103" ? { ...c, activa: false } : c) };
  assert.throws(() => apply(inactive, "settings", updated.configuracion), /activa/);
  const automatic = apply(updated, "settings", { ...updated.configuracion, cuentaIvaCredito: "", cuentaIvaDebito: "" });
  assert.equal(resolveIvaAccount("credito", automatic.configuracion, automatic.cuentas).codigo, "1103");
});

test("Guia 1 imports only with included VAT active, including validation again after preview", () => {
  const guide = require("../examples/asientos-guia-1.json");
  const pdf = require("../examples/catalogo-pdf-importable.json");
  const pdfCodes = new Set(pdf.cuentas.map((c) => c.codigo));
  assert.ok(guide.asientos.every((a) => a.detalles.every((d) => pdfCodes.has(d.codigoCuenta))));
  for (const modoIva of ["mas_iva", "incluido"]) {
    let s = apply(emptyBook(2026), "catalog", pdf);
    s = apply(s, "settings", { ...s.configuracion, modoIva });
    if (modoIva === "mas_iva") {
      const before = JSON.stringify(s);
      assert.throws(() => parseEntries(guide, s.cuentas, s.configuracion, true), /Configuración/);
      assert.throws(() => apply(s, "entries", guide), /Configuración/);
      assert.equal(JSON.stringify(s), before);
      continue;
    }
    const preview = { version: 1, asientos: parseEntries(guide, s.cuentas, s.configuracion, true) };
    const changed = apply(s, "settings", { ...s.configuracion, modoIva: "mas_iva" });
    assert.throws(() => apply(changed, "entries", preview), /Configuración/);
    const undeclared = { version: 1, asientos: guide.asientos };
    assert.throws(() => parseEntries(undeclared, s.cuentas, s.configuracion, true), /declarar modoIva/);
    assert.ok(preview.asientos.every((a) => a.modoIva === "incluido"));
    assert.ok(parseEntries(guide, s.cuentas).every((a) => a.modoIva === "incluido"));
    const result = localCommand(s, "entries", preview);
    assert.equal(result.insertados, 11);
    assert.equal(result.estado.configuracion.modoIva, modoIva);
    result.estado.asientos.forEach((a, i) => {
      assert.equal(a.modoIva, "incluido");
      assert.equal(a.detalles.length, guide.asientos[i].detalles.length);
      a.detalles.forEach((d, j) => {
        const original = guide.asientos[i].detalles[j];
        assert.equal(d.codigoCuenta, original.codigoCuenta);
        assert.equal(cents(d.debe), cents(original.debe));
        assert.equal(cents(d.haber), cents(original.haber));
      });
    });
    const total = result.estado.asientos.flatMap((a) => a.detalles);
    assert.equal(total.reduce((n, d) => n + cents(d.debe), 0), 13488000);
    assert.equal(total.reduce((n, d) => n + cents(d.haber), 0), 13488000);
    assert.equal(localCommand(result.estado, "entries", guide).omitidos, 11);
    assert.throws(() => apply(s, "entries", { ...guide, modoIva: "otro" }), /IVA/);
    const closed = apply(s, "period", { anio: 2026, cerrado: true });
    assert.throws(() => apply(closed, "entries", guide), /bloqueado/);
    const missing = { ...s, cuentas: s.cuentas.filter((c) => c.codigo !== "11010201") };
    assert.throws(() => apply(missing, "entries", guide), /11010201/);
  }
});
test("journal can stop at four, six, eight or ten digits without duplicating major totals", () => {
  let s = apply(emptyBook(2026), "catalog", require("../examples/catalogo-pdf-importable.json"));
  const codes = ["1101", "110102", "11010201", "1101020101"];
  const entry = (codigoCuenta) => ({ version: 1, asientos: [{
    referencia: `NIVEL-${codigoCuenta}`, fecha: "2026-01-01", concepto: "Aporte", tipo: "normal",
    detalles: [
      { codigoCuenta, debe: "0.10", haber: "0" },
      { codigoCuenta: "3101", debe: "0", haber: "0.10" },
    ],
  }] });
  for (const code of codes) {
    s = apply(s, "entries", entry(code));
    const line = s.asientos.at(-1).detalles[0];
    assert.equal(line.codigoCuenta, code);
    assert.equal(s.asientos.at(-1).detalles.length, 2);
    assert.equal(s.cuentas.find((c) => c.codigo === code).debe, 0.10);
  }
  const majors = majorLedger(s.cuentas, s.asientos);
  assert.equal(majors.find((c) => c.codigo === "1101").debe, 0.40);
  assert.equal(majors.find((c) => c.codigo === "3101").haber, 0.40);
  for (const code of ["", "1", "11"])
    assert.throws(() => apply(s, "entries", entry(code)));
  // Previously stored grouping flags must not prevent selecting a major.
  const old = { ...s, cuentas: s.cuentas.map((c) => ({ ...c, movimiento: false })) };
  const reopened = apply(old, "init", {});
  assert.deepEqual(reopened, s);
  const inactive = { ...s, cuentas: s.cuentas.map((c) => c.codigo === "1101"
    ? { ...c, activa: false } : c) };
  for (const code of codes)
    assert.throws(() => apply(inactive, "entries", entry(code)), /inactiva/);
});
test("PDF ten-digit accounts import, post and consolidate with historical eight-digit movements", () => {
  const pdf = require("../examples/catalogo-pdf-importable.json");
  const complete = require("../examples/catalogo-pdf-completo.json");
  const ten = pdf.cuentas.filter((c) => c.codigo.length === 10);
  assert.equal(pdf.cuentas.length, 461);
  assert.equal(ten.length, 24);
  assert.deepEqual(ten, complete.cuentas.filter((c) => c.codigo.length === 10));
  const bank = pdf.cuentas.find((c) => c.codigo === "1101020101");
  assert.equal(bank.nombre, "Banco de América Central, S.A.");
  assert.equal(bank.padreCodigo, "11010201");
  assert.equal(pdf.cuentas.find((c) => c.codigo === bank.padreCodigo).padreCodigo, "110102");
  assert.equal(pdf.cuentas.find((c) => c.codigo === "110102").padreCodigo, "1101");
  assert.ok(pdf.cuentas.every((c) => !c.nombre.includes("?") && !c.nombre.includes("\uFFFD")));
  let s = apply(emptyBook(2026), "catalog", {
    ...pdf, cuentas: pdf.cuentas.filter((c) => c.codigo.length <= 8),
  });
  const entry = (ref, codigoCuenta, debe) => ({ version: 1, asientos: [{
    referencia: ref, fecha: "2026-01-01", concepto: "Aporte bancario", tipo: "normal",
    detalles: [
      { codigoCuenta, debe, haber: "0" },
      { codigoCuenta: "31010101", debe: "0", haber: debe },
    ],
  }] });
  s = apply(s, "entries", entry("OCHO", "11010201", "10"));
  const expanded = localCommand(s, "catalog", pdf);
  assert.equal(expanded.insertados, 24);
  assert.deepEqual(expanded.estado.asientos, s.asientos);
  s = expanded.estado;
  assert.equal(s.cuentas.find((c) => c.codigo === bank.codigo).nombre, bank.nombre);
  assert.equal(canPost(s.cuentas.find((c) => c.codigo === "11010201"), s.cuentas), true);
  assert.equal(canPost(s.cuentas.find((c) => c.codigo === "1101020101"), s.cuentas), true);
  assert.doesNotThrow(() => apply(s, "entries", entry("PADRE", "11010201", "1")));
  s = apply(s, "entries", entry("DIEZ", "1101020101", "20.30"));
  const major = () => majorLedger(s.cuentas, s.asientos);
  assert.equal(major().find((c) => c.codigo === "1101").debe, 30.30);
  assert.ok(major().every((c) => c.codigo.length === 4));
  assert.deepEqual(apply(s, "init", {}), s);
  assert.equal(localCommand(s, "catalog", pdf).insertados, 0);
  const exported = { version: 1, cuentas: s.cuentas.filter((c) => c.codigo.length >= 4)
    .map(({ codigo, nombre, padreCodigo, activa }) => ({ codigo, nombre, padreCodigo, activa })) };
  const imported = apply(emptyBook(2026), "catalog", exported);
  assert.equal(imported.cuentas.filter((c) => c.codigo.length === 10).length, 24);
  s = apply(s, "catalog", { version: 1, cuentas: [{ ...pdf.cuentas.find((c) => c.codigo === "11010201"), activa: false }] });
  assert.throws(() => apply(s, "entries", entry("INACTIVA", "1101020101", "1")), /inactiva/);
  s = apply(s, "reverse", { id: s.asientos[1].id, fecha: "2026-01-02", motivo: "Corrección" });
  assert.equal(major().find((c) => c.codigo === "1101").saldo, 10);
});
test("a new exercise contains only the immutable base structure", () => {
  const s = emptyBook(2026);
  assert.equal(s.versionLocal, 3);
  assert.equal(s.cuentas.length, 20);
  assert.ok(s.cuentas.every((c) => c.codigo.length <= 2 && !canPost(c, s.cuentas)));
  const before = JSON.stringify(s);
  for (const codigo of ["1", "11"])
    assert.throws(() => apply(s, "catalog", { version: 1, cuentas: [{ codigo, nombre: "Cambio", activa: false }] }));
  assert.equal(JSON.stringify(s), before);
});
test("six- and eight-digit entries consolidate into one major and retain historical parent movements", () => {
  const wrap = (cuentas) => ({ version: 1, cuentas });
  const account = (codigo) => ({ codigo, nombre: `Cuenta ${codigo}`, activa: true });
  let s = apply(emptyBook(2026), "catalog", wrap([account("1199"), account("3101")]));
  const entry = (referencia, codigoCuenta, amount) => ({ version: 1, asientos: [{
    referencia, fecha: "2026-01-01", concepto: "Aporte", tipo: "normal", detalles: [
      { codigoCuenta, debe: amount, haber: "0" },
      { codigoCuenta: "3101", debe: "0", haber: amount },
    ],
  }] });
  s = apply(s, "entries", entry("PADRE", "1199", "0.10"));
  s = apply(s, "catalog", wrap([account("119901"), account("119902"), account("11990201")]));
  assert.doesNotThrow(() => apply(s, "entries", entry("AGRUPADOR", "1199", "0.10")));
  s = apply(s, "entries", entry("SEIS", "119901", "0.20"));
  s = apply(s, "entries", entry("OCHO", "11990201", "0.30"));
  const total = (book) => majorLedger(book.cuentas, book.asientos).find((c) => c.codigo === "1199");
  assert.equal(total(s).debe, 0.60);
  assert.equal(s.asientos[2].detalles[0].codigoCuenta, "11990201");
  s = apply(s, "reverse", { id: s.asientos[0].id, fecha: "2026-01-02", motivo: "Corrección" });
  assert.equal(total(s).saldo, 0.50);
  const before = JSON.stringify(s);
  assert.throws(() => apply(s, "catalog", wrap([account("119903"), account("11990401")])));
  assert.equal(JSON.stringify(s), before);
  s = apply(s, "catalog", wrap([{ ...account("119902"), activa: false }]));
  assert.throws(() => apply(s, "entries", entry("INACTIVA", "11990201", "1")), /inactiva/);
  assert.equal(total(s).saldo, 0.50);
});
test("legacy books gain base accounts and missing sales ancestors without changing IDs or entries", () => {
  let original = apply(init(), "entries", require("../examples/asientos-ejemplo.json"));
  original = {
    ...original,
    versionLocal: 2,
    cuentas: original.cuentas.filter((c) => c.codigo.length >= 4 && !["5101", "510104"].includes(c.codigo))
      .map((c) => ({ ...c, padreCodigo: null })),
  };
  const before = JSON.stringify(original);
  const migrated = apply(original, "init", {});
  assert.equal(JSON.stringify(original), before);
  assert.equal(migrated.versionLocal, 3);
  assert.deepEqual(migrated.asientos, original.asientos);
  for (const c of original.cuentas) {
    const next = migrated.cuentas.find((a) => a.codigo === c.codigo);
    assert.equal(next.id, c.id);
    assert.equal(next.saldo, c.saldo);
    assert.equal(next.padreCodigo, c.codigo.slice(0, -2));
  }
  assert.equal(migrated.cuentas.find((c) => c.codigo === "510104").padreCodigo, "5101");
  assert.ok(majorLedger(migrated.cuentas, migrated.asientos).some((c) => c.codigo === "5101"));
  assert.deepEqual(apply(migrated, "init", {}), migrated);
  const exported = { version: 1, cuentas: migrated.cuentas.filter((c) => c.codigo.length >= 4)
    .map(({ codigo, nombre, padreCodigo, activa }) => ({ codigo, nombre, padreCodigo, activa })) };
  const imported = apply(emptyBook(2026), "catalog", exported);
  assert.deepEqual(imported.cuentas.map((c) => c.codigo).sort(), migrated.cuentas.map((c) => c.codigo).sort());
});
test("default settings and corrected account", () => {
  const s = init();
  assert.equal(s.configuracion.modoIva, "mas_iva");
  assert.equal(s.configuracion.modoInventario, "traslados_compras");
  assert.equal(s.cuentas.length, 40);
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
test("VAT settings can change both ways without changing historical entries or balances", () => {
  let s = init();
  assert.throws(() => apply(s, "entries", require("../examples/venta-iva-incluido.json")), /Configuración/);
  s = apply(s, "entries", require("../examples/asientos-ejemplo.json"));
  const previous = structuredClone(s);
  s = apply(s, "settings", { ...s.configuracion, modoIva: "incluido" });
  assert.equal(s.configuracion.modoIva, "incluido");
  assert.throws(() => apply(s, "entries", require("../examples/asientos-ejemplo.json")), /Configuración/);
  assert.deepEqual(s.asientos, previous.asientos);
  assert.deepEqual(s.cuentas, previous.cuentas);
  assert.deepEqual(apply(s, "init", {}), s);
  s = apply(s, "entries", require("../examples/venta-iva-incluido.json"));
  assert.equal(s.asientos.at(-1).modoIva, "incluido");
  assert.equal(s.asientos[0].modoIva, "mas_iva");
  const mixed = structuredClone(s);
  s = apply(s, "settings", { ...s.configuracion, modoIva: "mas_iva" });
  assert.deepEqual(s.asientos, mixed.asientos);
  assert.deepEqual(s.cuentas, mixed.cuentas);
  assert.equal(s.configuracion.modoIva, "mas_iva");
  const next = structuredClone(require("../examples/asientos-ejemplo.json").asientos[0]);
  next.referencia = "NUEVO-MODO";
  s = apply(s, "entries", { version: 1, asientos: [next] });
  assert.equal(s.asientos.at(-1).modoIva, "mas_iva");
  const exported = { version: 1, asientos: s.asientos.map((a) => ({
    referencia: a.referencia, fecha: a.fecha, concepto: a.concepto, tipo: a.tipo,
    modoIva: a.modoIva, ajusteInventario: a.ajusteInventario,
    detalles: a.detalles.map((d) => ({ codigoCuenta: d.codigoCuenta,
      debe: d.debe.toFixed(2), haber: d.haber.toFixed(2), descripcion: d.descripcion })),
  })) };
  assert.throws(() => apply(s, "entries", exported), /Configuración/);
  let imported = init();
  for (const modoIva of ["mas_iva", "incluido"]) {
    const batch = { ...exported, modoIva, asientos: exported.asientos.filter((a) => a.modoIva === modoIva) };
    imported = apply(imported, "settings", { ...imported.configuracion, modoIva });
    imported = apply(imported, "entries", batch);
    assert.equal(localCommand(imported, "entries", batch).insertados, 0);
  }
  for (const a of imported.asientos)
    assert.equal(a.modoIva, s.asientos.find((p) => p.referencia === a.referencia).modoIva);
  assert.deepEqual(imported.cuentas.map((c) => c.saldo), s.cuentas.map((c) => c.saldo));
  const reversed = apply(s, "reverse", { id: s.asientos[5].id, fecha: "2026-01-02", motivo: "Prueba" });
  assert.equal(reversed.asientos.at(-1).modoIva, "incluido");
  assert.equal(reversed.configuracion.modoIva, "mas_iva");
  // El tratamiento de inventarios ya se puede cambiar sobre un libro con
  // asientos: no altera los importes ya registrados.
  const explicitos = apply(s, "settings", { ...s.configuracion, modoInventario: "inventarios_explicitos" });
  assert.equal(explicitos.configuracion.modoInventario, "inventarios_explicitos");
  assert.deepEqual(explicitos.cuentas.map((c) => c.saldo), s.cuentas.map((c) => c.saldo));
  const before = JSON.stringify(s);
  assert.throws(() => apply(s, "settings", { ...s.configuracion, modoIva: "otro" }), /inválida/);
  assert.throws(() => apply(s, "entries", { version: 1, asientos: [{ ...next, modoIva: "otro" }] }), /IVA/);
  assert.throws(() => apply(s, "entries", { version: 1, modoIva: "mas_iva", asientos: [{ ...next, modoIva: "incluido" }] }), /IVA/);
  assert.equal(JSON.stringify(s), before);
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
  const expanded = localCommand(s, "catalog", {
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
    }).estado;
  assert.deepEqual(expanded.asientos, s.asientos);
  assert.equal(canPost(expanded.cuentas.find((c) => c.codigo === "110102"), expanded.cuentas), true);
  assert.equal(canPost(expanded.cuentas.find((c) => c.codigo === "11010201"), expanded.cuentas), true);
});
test("example cash entries use Caja 110101 and consolidate in Efectivo 1101", () => {
  const entries = require("../examples/asientos-ejemplo.json");
  for (const model of [catalog, partialCatalog, require("../lib/accounting/seed.json")]) {
    let s = apply(emptyBook(2026), "catalog", model);
    const cash = s.cuentas.find((c) => c.codigo === "110101");
    const major = s.cuentas.find((c) => c.codigo === "1101");
    assert.equal(cash.nombre, "Caja");
    assert.equal(cash.padreCodigo, major.codigo);
    assert.equal(major.nombre, "Efectivo y equivalentes de efectivo");
    assert.equal(canPost(major, s.cuentas), true);
    assert.equal(canPost(cash, s.cuentas), true);
    s = apply(s, "entries", entries);
    const details = s.asientos.flatMap((a) => a.detalles);
    assert.ok(details.some((d) => d.codigoCuenta === "110101"));
    assert.ok(details.every((d) => d.codigoCuenta !== "1101"));
    const mayor = majorLedger(s.cuentas, s.asientos);
    assert.equal(mayor.find((c) => c.codigo === "1101").saldo, 11017);
    assert.ok(mayor.every((c) => c.codigo !== "110101"));
  }
  let s = apply(init(), "settings", { modoIva: "incluido", modoInventario: "traslados_compras" });
  s = apply(s, "entries", require("../examples/venta-iva-incluido.json"));
  assert.equal(s.asientos[0].detalles[0].codigoCuenta, "110101");
});
