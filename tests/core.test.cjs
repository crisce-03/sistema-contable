const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  familias,
  cents,
  money,
  parseCatalog,
  parseEntries,
  ledger,
  trial,
  canPost,
} = require("../.test-build/core.cjs");
const seed = require("../examples/catalogo.json");
const accounts = seed.cuentas.map((c) => {
  const f = familias.find((f) => f.id === c.familia);
  return {
    ...c,
    id: c.codigo,
    tipo: f.grupo,
    naturaleza: f.naturaleza,
    rubro: f.rubro,
    movimiento: true,
    debe: 0,
    haber: 0,
    saldo: 0,
  };
});
const entry = (extra = {}) => ({
  referencia: "T-1",
  fecha: "2026-01-01",
  concepto: "Aporte",
  tipo: "normal",
  detalles: [
    { codigoCuenta: "1101", debe: "0.30", haber: "0.00" },
    { codigoCuenta: "3101", debe: "0.00", haber: "0.30" },
  ],
  ...extra,
});
const wrap = (e) => ({ version: 1, asientos: [e] });
test("exactly 17 approved families and valid seed", () => {
  assert.equal(parseCatalog(seed).length, 17);
  assert.equal(familias.length, 17);
});
test("cent arithmetic accepts decimals and rejects lossy or invalid input", () => {
  assert.equal(cents("0.10") + cents("0.20"), 30);
  assert.equal(money(30), "0.30");
  for (const v of [-1, "1.001", Infinity, NaN, "1e3", "1,00", null, "", true])
    assert.throws(() => cents(v));
});
test("classification of returns and prepaid expenses is independent of normal balance", () => {
  assert.equal(
    accounts.find((c) => c.familia === "devol_ventas").tipo,
    "Ingresos",
  );
  assert.equal(
    accounts.find((c) => c.familia === "devol_ventas").naturaleza,
    "Deudora",
  );
  assert.equal(
    accounts.find((c) => c.familia === "devol_compras").tipo,
    "Costos",
  );
  assert.equal(
    accounts.find((c) => c.familia === "anticipados").tipo,
    "Activo",
  );
});
test("catalog rejects duplicates, foreign families, inconsistent parents and reclassification", () => {
  assert.throws(() =>
    parseCatalog({ ...seed, cuentas: [seed.cuentas[0], seed.cuentas[0]] }),
  );
  for (const change of [
    { familia: "ventas" },
    { codigo: "9999" },
    { codigo: "110101", padreCodigo: "3101" },
  ])
    assert.throws(() =>
      parseCatalog(
        { version: 1, cuentas: [{ ...seed.cuentas[0], ...change }] },
        accounts,
      ),
    );
});
test("catalog accepts unordered ancestors and children", () => {
  const root = seed.cuentas[0];
  assert.equal(
    parseCatalog({
      version: 1,
      cuentas: [
        { ...root, codigo: "110101", padreCodigo: "1101", nombre: "Caja" },
        root,
      ],
    })[0].codigo,
    "1101",
  );
});
test("journal rejects empty, zero, unknown account, double-sided and unbalanced entries", () => {
  assert.throws(() => parseEntries({ version: 1, asientos: [] }, accounts));
  for (const details of [
    [],
    [
      { codigoCuenta: "1101", debe: "0", haber: "0" },
      { codigoCuenta: "3101", debe: "0", haber: "0" },
    ],
    [
      { codigoCuenta: "NO", debe: "1", haber: "0" },
      { codigoCuenta: "3101", debe: "0", haber: "1" },
    ],
    [
      { codigoCuenta: "1101", debe: "1", haber: "1" },
      { codigoCuenta: "3101", debe: "1", haber: "1" },
    ],
    [
      { codigoCuenta: "1101", debe: "1", haber: "0" },
      { codigoCuenta: "3101", debe: "0", haber: "2" },
    ],
  ])
    assert.throws(() =>
      parseEntries(wrap(entry({ detalles: details })), accounts),
    );
});
test("journal rejects impossible dates, missing references, duplicated references and parcial", () => {
  for (const change of [
    { fecha: "2026-02-30" },
    { referencia: "" },
    { concepto: " " },
    { tipo: "cierre" },
  ])
    assert.throws(() => parseEntries(wrap(entry(change)), accounts));
  assert.throws(() =>
    parseEntries({ version: 1, asientos: [entry(), entry()] }, accounts),
  );
  assert.throws(() =>
    parseEntries(
      wrap(
        entry({
          detalles: [
            { codigoCuenta: "1101", debe: "1", haber: "0", parcial: 1 },
            { codigoCuenta: "3101", debe: "0", haber: "1" },
          ],
        }),
      ),
      accounts,
    ),
  );
});
test("posting blocks inactive parents and grouping accounts", () => {
  assert.equal(canPost({ ...accounts[0], movimiento: false }, accounts), false);
  const child = {
    ...accounts[0],
    id: "child",
    codigo: "110101",
    padreCodigo: "1101",
  };
  assert.equal(
    canPost(child, [{ ...accounts[0], activa: false }, child]),
    false,
  );
});
test("ledger and trial balance preserve abnormal debit/credit balances", () => {
  const a = parseEntries(
    wrap(
      entry({
        detalles: [
          { codigoCuenta: "1101", debe: "0", haber: "0.30" },
          { codigoCuenta: "3101", debe: "0.30", haber: "0" },
        ],
      }),
    ),
    accounts,
  )[0];
  const saved = {
    ...a,
    id: "1",
    numero: 1,
    cuadra: true,
    detalles: a.detalles.map((d, i) => ({
      ...d,
      id: String(i),
      cuentaId: d.codigoCuenta,
      debe: Number(d.debe),
      haber: Number(d.haber),
      parcial: 0,
    })),
  };
  const rows = trial(ledger(accounts, [saved]));
  assert.equal(rows.find((c) => c.codigo === "1101").acreedor, 0.3);
  assert.equal(rows.find((c) => c.codigo === "3101").deudor, 0.3);
});
