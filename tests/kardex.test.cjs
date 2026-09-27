const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { localCommand, emptyBook, calcularKardex } = require("../.test-build/local.cjs");

test("Kardex lets the user open a movement cost, enter VAT-inclusive cost and save it", async () => {
  const apply = (s, a, d) => localCommand(s, a, d).estado;
  let libro = apply(emptyBook(2026), "catalog", require("../examples/analitico-catalogo.json"));
  libro = apply(libro, "settings", { ...libro.configuracion, modoIva: "incluido" });
  libro = apply(libro, "entries", require("../examples/analitico-asientos.json"));
  libro = apply(libro, "kardex", {
    id: "producto", nombre: "Producto", costo: "20.00", venta: "40.00", inicial: 600,
    inicio: "2026-01-01", fin: "2026-12-31",
    cuentas: { compras: "4101", ventas: "5101", devolCompras: "510201", devolVentas: "410201" },
  });
  const estados = [];
  let cursor = 0;
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("app/kardex/page.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, {
    exports,
    require: name => {
      if (name === "react") return { ...React, useState: initial => {
        const i = cursor++;
        if (!(i in estados)) estados[i] = initial;
        return [estados[i], value => { estados[i] = value; }];
      } };
      if (name === "@/lib/store/accountingStore") return { useAccountingStore: () => ({
        ...libro, ocupado: false, ejecutar: async (action, data) => { libro = apply(libro, action, data); },
      }) };
      if (name.startsWith("@/lib/accounting/")) return require(`../.test-build/${name.split("/").at(-1)}.cjs`);
      return require(name);
    },
  });
  const render = () => { cursor = 0; return exports.default(); };
  const nodes = tree => {
    if (!tree || typeof tree !== "object") return [];
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    return [tree, ...nodes(tree.props?.children)];
  };
  const find = predicate => {
    const result = nodes(render()).find(predicate);
    assert.ok(result, "Expected control to be present");
    return result;
  };
  const markup = renderToStaticMarkup(render());
  assert.match(markup, /El costo ingresado incluye IVA/);
  assert.match(markup, /El precio de venta ingresado incluye IVA/);
  assert.match(markup, /Editar costo unitario: Inventario inicial/);
  find(n => n.type === "button" && n.props["aria-label"]?.includes("Ventas ·")).props.onClick();
  const editor = () => find(n => n.type === "form" && nodes(n).some(c => c.type === "button" && c.props.children === "Guardar costo"));
  nodes(editor()).find(n => n.type === "input" && n.props.inputMode === "decimal")
    .props.onChange({ target: { value: "20.34" } });
  nodes(editor()).find(n => n.type === "input" && n.props.type === "checkbox")
    .props.onChange({ target: { checked: true } });
  await editor().props.onSubmit({ preventDefault() {} });
  const ajustes = Object.values(libro.kardex[0].costosMovimientos);
  assert.equal(ajustes.length, 1);
  assert.equal(ajustes[0].costo, "20.34");
  assert.equal(ajustes[0].incluyeIva, true);
  const venta = calcularKardex(libro.kardex[0], libro.asientos).filas.find(f => f.concepto.includes("Ventas ·"));
  assert.equal(venta.costoUnitario, 1800);
  assert.match(renderToStaticMarkup(render()), /Costo guardado/);
});
