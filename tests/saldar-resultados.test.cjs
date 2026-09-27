const { test } = require("node:test");
const assert = require("node:assert/strict");
const { emptyBook, localCommand, inventarioFinalKardex } = require("../.test-build/local.cjs");
const { estadoResultados, balanceGeneral, prepararSaldoResultados, cierreRegistrado, asientoCierre } = require("../.test-build/reports.cjs");
const catalogo = require("../examples/analitico-catalogo.json");
const apply = (s, a, d) => localCommand(s, a, d).estado;
function base({ utilidad = true, inventario = "9000.00", modo = "inventarios_explicitos" } = {}) {
  let s = apply(emptyBook(2026), "catalog", { ...catalogo, cuentas: catalogo.cuentas.filter((c) => utilidad || c.codigo !== "3201") });
  s = apply(s, "settings", { modoIva: "incluido", modoInventario: modo, inventarioFinalFisico: inventario });
  return apply(s, "entries", require("../examples/analitico-asientos.json"));
}
const medir = (s) => estadoResultados(s.configuracion, s.cuentas, s.asientos, inventarioFinalKardex(s.kardex, s.asientos));
const saldo = (s, codigo) => s.cuentas.find((c) => c.codigo === codigo).saldo;

test("each result account is settled through profit and loss in balanced entries", () => {
  const s = base();
  const antes = medir(s);
  const plan = prepararSaldoResultados(s.configuracion, s.cuentas, s.asientos, 2026);
  const r = localCommand(s, "saldar-resultados", { anio: 2026 });
  const cerrado = r.estado;
  assert.equal(r.insertados, plan.partidas.length);
  assert.ok(r.insertados > 2);
  for (const a of cerrado.asientos.slice(s.asientos.length)) {
    assert.equal(a.detalles.length, 2);
    assert.equal(a.fecha, "2026-12-31");
    const total = (lado) => a.detalles.reduce((n, d) => n + Math.round(d[lado] * 100), 0);
    assert.equal(total("debe"), total("haber"));
    assert.ok(a.detalles.some((d) => d.codigoCuenta === plan.liquidadora.codigo));
  }
  for (const c of cerrado.cuentas.filter((c) => /^[45]/.test(c.codigo)))
    assert.equal(c.saldo, 0, c.codigo);
  assert.equal(saldo(cerrado, plan.liquidadora.codigo), 0);
  assert.equal(saldo(cerrado, plan.utilidad.codigo), antes.utilidadNeta / 100);
  assert.equal(saldo(cerrado, "1102"), 9000);
  assert.equal(medir(cerrado).utilidadNeta, antes.utilidadNeta);
  assert.deepEqual(balanceGeneral(medir(cerrado)), balanceGeneral(antes));
  assert.ok(cierreRegistrado(2026, cerrado.asientos));
  assert.throws(() => apply(cerrado, "saldar-resultados", { anio: 2026 }), /ya fueron saldadas/);
  assert.throws(() => apply(cerrado, "entries", { version: 1, asientos: [asientoCierre(s.configuracion, s.cuentas, s.asientos, 2026)] }), /ya tiene un cierre/);
});

test("missing closing accounts are created and losses and zero profit are transferred correctly", () => {
  for (const [inventario, esperado] of [["0.00", -6200], ["6200.00", 0], ["9000.00", 2800]]) {
    const s = base({ utilidad: false, inventario });
    const cerrado = apply(s, "saldar-resultados", { anio: 2026 });
    const utilidad = cerrado.cuentas.find((c) => c.codigo === cerrado.configuracion.cuentasReporte.utilidad);
    assert.equal(utilidad.nombre, "Utilidad neta antes de impuestos");
    assert.equal(utilidad.saldo, esperado);
    assert.equal(saldo(cerrado, "6101"), 0);
    assert.equal(cerrado.cuentas.length, s.cuentas.length + 2);
    assert.ok(balanceGeneral(medir(cerrado)).cuadra);
  }
});

test("existing inventory transfers and VAT settlement stay intact when results are settled", () => {
  let s = base({ modo: "traslados_compras", inventario: "16500.00" });
  s = apply(s, "kardex", {
    id: "laptop", nombre: "Laptop", costo: "20.00", venta: "40.00", inicial: 600,
    inicio: "2026-01-01", fin: "2026-12-31",
    cuentas: { compras: "4101", ventas: "5101", devolCompras: "510201", devolVentas: "410201" },
  });
  s = apply(s, "liquidacion-iva", {});
  const cerrado = apply(s, "saldar-resultados", { anio: 2026 });
  assert.deepEqual(cerrado.asientos.slice(0, s.asientos.length), s.asientos);
  assert.equal(saldo(cerrado, "3201"), 10300);
  assert.equal(saldo(cerrado, "1102"), 16500);
  assert.equal(saldo(cerrado, "1103"), 0);
  assert.equal(saldo(cerrado, "2102"), 0);
  assert.equal(saldo(cerrado, "6101"), 0);
  assert.equal(medir(cerrado).compras, medir(s).compras);
});

test("reversing one closing entry reverses the entire group and permits a fresh closure", () => {
  const s = base();
  const cerrado = apply(s, "saldar-resultados", { anio: 2026 });
  const partida = cerrado.asientos.at(-1);
  const r = localCommand(cerrado, "reverse", { id: partida.id, fecha: "2026-12-31", motivo: "Corregir resultados" });
  assert.equal(r.insertados, cerrado.asientos.length - s.asientos.length);
  assert.equal(cierreRegistrado(2026, r.estado.asientos), undefined);
  for (const c of s.cuentas) assert.equal(saldo(r.estado, c.codigo), c.saldo, c.codigo);
  assert.equal(saldo(r.estado, "6101"), 0);
  const nuevo = apply(r.estado, "saldar-resultados", { anio: 2026 });
  assert.equal(saldo(nuevo, "3201"), 2800);
  assert.equal(nuevo.cuentas.length, cerrado.cuentas.length);
  assert.ok(cierreRegistrado(2026, nuevo.asientos));
});

test("changes that would invalidate a registered closing are rejected atomically", () => {
  const cerrado = apply(base(), "saldar-resultados", { anio: 2026 });
  const antes = structuredClone(cerrado);
  assert.throws(() => apply(cerrado, "settings", { ...cerrado.configuracion, inventarioFinalFisico: "8000.00" }), /Revierte primero el cierre/);
  assert.throws(() => apply(cerrado, "entries", { version: 1, asientos: [{
    referencia: "GASTO-NUEVO", fecha: "2026-12-31", concepto: "Gasto adicional", tipo: "normal",
    detalles: [
      { codigoCuenta: "4107", debe: "10.00", haber: "0.00" },
      { codigoCuenta: "110101", debe: "0.00", haber: "10.00" },
    ],
  }] }), /Revierte primero el cierre/);
  assert.deepEqual(cerrado, antes);
});

test("a closed period or missing inventory cannot leave partial closing entries or accounts", () => {
  for (const s of [
    apply(base({ utilidad: false }), "period", { anio: 2026, cerrado: true }),
    base({ utilidad: false, inventario: "" }),
  ]) {
    const antes = structuredClone(s);
    assert.throws(() => apply(s, "saldar-resultados", { anio: 2026 }), /bloqueado|inventario final/);
    assert.deepEqual(s, antes);
  }
});

test("the reports page previews closing entries and disables the button once settled", () => {
  const fs = require("node:fs");
  const vm = require("node:vm");
  const ts = require("typescript");
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const source = ts.transpileModule(fs.readFileSync("app/reportes/page.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const render = (s) => {
    const exports = {};
    vm.runInNewContext(source, { exports, require: (name) => {
      if (name === "@/lib/store/accountingStore")
        return { useAccountingStore: () => ({ ...s, listo: true, ocupado: false }) };
      if (name.startsWith("@/lib/accounting/"))
        return require(`../.test-build/${name.split("/").at(-1)}.cjs`);
      return require(name);
    } });
    return renderToStaticMarkup(React.createElement(exports.default));
  };
  const s = base({ utilidad: false });
  const antes = structuredClone(s);
  const html = render(s);
  assert.match(html, /<button[^>]*>Saldar cuentas de resultados<\/button>/);
  assert.doesNotMatch(html, /<button[^>]*disabled[^>]*>Saldar cuentas de resultados/);
  assert.match(html, /Ver asientos a generar/);
  assert.match(html, /Pérdidas y ganancias/);
  assert.deepEqual(s, antes);
  const cerrado = apply(s, "saldar-resultados", { anio: 2026 });
  assert.match(render(cerrado), /<button[^>]*disabled[^>]*>Cuentas de resultados saldadas/);
  assert.match(render(cerrado), /2800\.00/);
});
