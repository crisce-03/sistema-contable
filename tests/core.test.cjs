const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  familias,
  baseAccounts,
  accountClassification,
  majorAccount,
  majorLedger,
  cents,
  money,
  parseCatalog,
  parseEntries,
  ledger,
  trial,
  canPost,
} = require("../.test-build/core.cjs");
const seed = require("../examples/catalogo.json");
const accounts = [...parseCatalog(seed).map((c) => {
  const f = accountClassification(c.codigo);
  return {
    ...c,
    id: c.codigo,
    tipo: f.grupo,
    naturaleza: f.naturaleza,
    rubro: f.rubro,
    movimiento: !seed.cuentas.some((a) => a.padreCodigo === c.codigo),
    debe: 0,
    haber: 0,
    saldo: 0,
  };
}), ...baseAccounts()];
const entry = (extra = {}) => ({
  referencia: "T-1",
  fecha: "2026-01-01",
  concepto: "Aporte",
  tipo: "normal",
  detalles: [
    { codigoCuenta: "110101", debe: "0.30", haber: "0.00" },
    { codigoCuenta: "3101", debe: "0.00", haber: "0.30" },
  ],
  ...extra,
});
const wrap = (e) => ({ version: 1, asientos: [e] });
test("only one- and two-digit accounts are predefined; examples supply the rest", () => {
  assert.equal(parseCatalog(seed).length, 20);
  assert.equal(familias.length, 20);
  assert.ok(baseAccounts().every((c) => c.codigo.length <= 2 && !c.movimiento));
});
test("catalog accepts arbitrary majors, infers parents, and rejects skipped or unsupported levels", () => {
  const custom = { codigo: "1199", nombre: "Otra cuenta", activa: true };
  assert.equal(parseCatalog({ version: 1, cuentas: [custom] })[0].padreCodigo, "11");
  for (const codigo of ["1", "11", "111", "11999", "1199999", "119999999", "11999999999", "119999999999", "9901"])
    assert.throws(() => parseCatalog({ version: 1, cuentas: [{ ...custom, codigo }] }));
  for (const cuentas of [
    [{ ...custom, codigo: "119901" }],
    [custom, { ...custom, codigo: "11990101" }],
    [custom, { ...custom, codigo: "11990101", padreCodigo: "1199" }],
  ]) assert.throws(() => parseCatalog({ version: 1, cuentas }));
  const parsed = parseCatalog({ version: 1, cuentas: [
    { ...custom, codigo: "11990101" }, { ...custom, codigo: "119901" }, custom,
  ] });
  assert.deepEqual(parsed.map((c) => c.codigo), ["1199", "119901", "11990101"]);
});
test("ten-digit catalog accounts require their immediate eight-digit parent", () => {
  const account = (codigo) => ({ codigo, nombre: `Cuenta ${codigo}`, activa: true });
  const chain = ["1199", "119901", "11990101", "1199010101"].map(account);
  const parsed = parseCatalog({ version: 1, cuentas: [...chain].reverse() });
  assert.equal(parsed.at(-1).codigo, "1199010101");
  assert.equal(parsed.at(-1).padreCodigo, "11990101");
  assert.throws(() => parseCatalog({ version: 1, cuentas: chain.filter((c) => c.codigo !== "11990101") }), /Padre/);
  assert.throws(() => parseCatalog({ version: 1, cuentas: [
    ...chain.slice(0, -1), { ...chain.at(-1), padreCodigo: "119901" },
  ] }), /Padre/);
});
test("four-digit ledger combines different classifications and nested details exactly once", () => {
  const journal = [{ detalles: [
    { cuentaId: "510101", codigoCuenta: "510101", debe: 0, haber: 100 },
    { cuentaId: "51010402", codigoCuenta: "51010402", debe: 20, haber: 0 },
    { cuentaId: "110101", codigoCuenta: "110101", debe: 80, haber: 0 },
  ] }];
  const rows = majorLedger(accounts, journal);
  assert.ok(rows.every((c) => c.codigo.length === 4));
  const sale = rows.find((c) => c.codigo === "5101");
  assert.equal(sale.debe, 20);
  assert.equal(sale.haber, 100);
  assert.equal(sale.saldo, 80);
  assert.equal(majorAccount(accounts.find((c) => c.codigo === "51010402"), accounts).codigo, "5101");
  assert.equal(rows.reduce((n, c) => n + cents(c.debe), 0), 10000);
  assert.equal(rows.reduce((n, c) => n + cents(c.haber), 0), 10000);
  assert.throws(() => majorLedger(accounts.filter((c) => c.codigo !== "510104"), journal), /mayor/);
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
      { codigoCuenta: "110101", debe: "0", haber: "0" },
      { codigoCuenta: "3101", debe: "0", haber: "0" },
    ],
    [
      { codigoCuenta: "NO", debe: "1", haber: "0" },
      { codigoCuenta: "3101", debe: "0", haber: "1" },
    ],
    [
      { codigoCuenta: "110101", debe: "1", haber: "1" },
      { codigoCuenta: "3101", debe: "1", haber: "1" },
    ],
    [
      { codigoCuenta: "110101", debe: "1", haber: "0" },
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
            { codigoCuenta: "110101", debe: "1", haber: "0", parcial: 1 },
            { codigoCuenta: "3101", debe: "0", haber: "1" },
          ],
        }),
      ),
      accounts,
    ),
  );
});
test("posting allows majors with children but rejects inactive or incomplete ancestry", () => {
  assert.equal(canPost({ ...accounts[0], movimiento: false }, accounts), true);
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
  for (const codigo of ["1", "11", "1101"])
    assert.equal(canPost(child, accounts.filter((c) => c.codigo !== codigo)), false);
  assert.equal(canPost({ ...child, padreCodigo: "11" }, accounts), false);
  assert.equal(canPost({ ...accounts[0], padreCodigo: null }, accounts), false);
  assert.equal(canPost({ ...child, activa: false }, accounts), false);
  for (const codigo of ["1", "11", "1101"])
    assert.equal(canPost(child, accounts.map((c) => c.codigo === codigo
      ? { ...c, activa: false } : c)), false);
});
test("ledger and trial balance preserve abnormal debit/credit balances", () => {
  const a = parseEntries(
    wrap(
      entry({
        detalles: [
          { codigoCuenta: "110101", debe: "0", haber: "0.30" },
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
  assert.equal(rows.find((c) => c.codigo === "110101").acreedor, 0.3);
  assert.equal(rows.find((c) => c.codigo === "3101").deudor, 0.3);
});
