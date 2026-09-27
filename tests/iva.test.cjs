const { test } = require("node:test");
const assert = require("node:assert/strict");
const { localCommand, emptyBook, calcularLiquidacionIva } = require("../.test-build/local.cjs");
const catalogo = require("../examples/analitico-catalogo.json");
const apply = (s, a, d) => localCommand(s, a, d).estado;
const saldo = (s, codigo) => s.cuentas.find((c) => c.codigo === codigo).saldo;
const movimiento = (referencia, fecha, codigo, debe, haber) => ({
  referencia, fecha, concepto: "Movimiento de IVA", tipo: "normal",
  detalles: [
    { codigoCuenta: codigo, debe, haber },
    { codigoCuenta: "110101", debe: haber, haber: debe },
  ],
});
function libro(cf = "100.00", df = "150.00", destinos = true) {
  let s = apply(emptyBook(2026), "catalog", {
    ...catalogo,
    cuentas: catalogo.cuentas.filter((c) => destinos || !["1106", "2103"].includes(c.codigo)),
  });
  return apply(s, "entries", { version: 1, asientos: [
    movimiento("CF-ENE", "2026-01-10", "1103", cf, "0.00"),
    movimiento("DF-MAR", "2026-03-10", "2102", "0.00", df),
  ] });
}

test("one accumulated entry settles different months and reuses the payable account", () => {
  const s = libro();
  const r = calcularLiquidacionIva(s);
  assert.deepEqual([r.cf, r.df, r.diferencia], [10000, 15000, 5000]);
  assert.equal(r.destino.cuenta.codigo, "2103");
  assert.equal(r.destino.crear, false);
  const cerrado = apply(s, "liquidacion-iva", { fecha: "2026-03-31" });
  assert.equal(cerrado.asientos.length, s.asientos.length + 1);
  assert.equal(cerrado.cuentas.length, s.cuentas.length);
  assert.deepEqual([saldo(cerrado, "1103"), saldo(cerrado, "2102"), saldo(cerrado, "2103")], [0, 0, 50]);
  assert.equal(calcularLiquidacionIva(cerrado).desactualizada, false);
  assert.equal(calcularLiquidacionIva(cerrado).registrada.id, cerrado.asientos.at(-1).id);
  assert.throws(() => apply(cerrado, "liquidacion-iva", {}), /Ya existe/);
});

test("the missing payable or carryforward account is created atomically with the entry", () => {
  for (const [cf, df, nombre, tipo] of [
    ["100.00", "150.00", "IVA a pagar", "Pasivo"],
    ["150.00", "100.00", "Remanente IVA a favor", "Activo"],
  ]) {
    const s = libro(cf, df, false);
    const r = calcularLiquidacionIva(s);
    assert.equal(r.destino.crear, true);
    assert.ok(!s.cuentas.some((c) => c.codigo === r.destino.cuenta.codigo));
    const cerrado = apply(s, "liquidacion-iva", {});
    const cuenta = cerrado.cuentas.find((c) => c.codigo === r.destino.cuenta.codigo);
    assert.equal(cuenta.nombre, nombre);
    assert.equal(cuenta.tipo, tipo);
    assert.equal(cuenta.saldo, 50);
    assert.equal(cerrado.cuentas.length, s.cuentas.length + 1);
    assert.equal(saldo(cerrado, "1103"), 0);
    assert.equal(saldo(cerrado, "2102"), 0);
  }
});

test("equal credit and debit need no destination account", () => {
  const s = libro("100.01", "100.01", false);
  assert.equal(calcularLiquidacionIva(s).destino, undefined);
  const cerrado = apply(s, "liquidacion-iva", {});
  assert.equal(cerrado.cuentas.length, s.cuentas.length);
  assert.equal(cerrado.asientos.at(-1).detalles.length, 2);
  assert.equal(saldo(cerrado, "1103"), 0);
  assert.equal(saldo(cerrado, "2102"), 0);
});

test("every VAT auxiliary is zeroed even when opposite balances cancel within a major", () => {
  let s = apply(libro(), "catalog", { version: 1, cuentas: [
    { codigo: "110301", nombre: "IVA crédito fiscal auxiliar", activa: true },
    { codigo: "210201", nombre: "IVA débito fiscal auxiliar", activa: true },
  ] });
  s = apply(s, "entries", { version: 1, asientos: [
    movimiento("CF-AUX", "2026-04-10", "110301", "0.00", "100.00"),
    movimiento("DF-AUX", "2026-04-10", "210201", "150.00", "0.00"),
  ] });
  const r = calcularLiquidacionIva(s);
  assert.deepEqual([r.cf, r.df], [0, 0]);
  assert.equal(r.lineas.length, 4);
  const cerrado = apply(s, "liquidacion-iva", {});
  for (const codigo of ["1103", "110301", "2102", "210201"])
    assert.equal(saldo(cerrado, codigo), 0, codigo);
});

test("reversing the accumulated settlement permits recalculation and reuses its account", () => {
  const s = libro("150.00", "100.00", false);
  let cerrado = apply(s, "liquidacion-iva", {});
  const partida = cerrado.asientos.at(-1);
  const nueva = { version: 1, asientos: [movimiento("CF-ABR", "2026-04-10", "1103", "20.00", "0.00")] };
  assert.throws(() => apply(cerrado, "entries", nueva), /Revierte primero/);
  cerrado = apply(cerrado, "reverse", { id: partida.id, fecha: "2026-04-01", motivo: "Actualizar IVA" });
  cerrado = apply(cerrado, "entries", nueva);
  assert.equal(calcularLiquidacionIva(cerrado).destino.crear, false);
  cerrado = apply(cerrado, "liquidacion-iva", {});
  assert.equal(cerrado.cuentas.length, s.cuentas.length + 1);
  assert.equal(saldo(cerrado, "1103"), 0);
  assert.equal(saldo(cerrado, "2102"), 0);
  assert.equal(saldo(cerrado, calcularLiquidacionIva(cerrado).destino.cuenta.codigo), 70);
});

test("existing monthly settlements are deducted from the accumulated pending VAT", () => {
  let s = libro();
  s = apply(s, "entries", { version: 1, asientos: [{
    referencia: "LIQ-ANTERIOR", fecha: "2026-01-31", concepto: "Liquidación anterior", tipo: "ajuste",
    detalles: [
      { codigoCuenta: "1103", debe: "0.00", haber: "100.00" },
      { codigoCuenta: "1106", debe: "100.00", haber: "0.00" },
    ],
  }] });
  s.asientos.at(-1).liquidacionIva = "2026-01";
  const r = calcularLiquidacionIva(s);
  assert.deepEqual([r.cf, r.df], [0, 15000]);
  const cerrado = apply(s, "liquidacion-iva", {});
  assert.equal(saldo(cerrado, "1103"), 0);
  assert.equal(saldo(cerrado, "2102"), 0);
  assert.equal(saldo(cerrado, "1106"), 100);
  assert.equal(saldo(cerrado, "2103"), 150);
});

test("invalid dates, closed periods and missing balances do not mutate the book", () => {
  const s = libro("100.00", "150.00", false);
  const antes = structuredClone(s);
  assert.throws(() => apply(s, "liquidacion-iva", { fecha: "2026-01-01" }), /último asiento/);
  assert.throws(() => apply(s, "liquidacion-iva", { fecha: "2026-02-30" }), /Fecha inválida/);
  const cerrado = apply(s, "period", { anio: 2026, cerrado: true });
  assert.throws(() => apply(cerrado, "liquidacion-iva", {}), /bloqueado/);
  assert.deepEqual(s, antes);
  const vacio = apply(emptyBook(2026), "catalog", catalogo);
  assert.throws(() => apply(vacio, "liquidacion-iva", { fecha: "2026-12-31" }), /No hay saldos/);
});
