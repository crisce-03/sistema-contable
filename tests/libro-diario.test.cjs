const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { emptyBook, localCommand } = require("../.test-build/local.cjs");

const source = ts.transpileModule(
  fs.readFileSync("components/accounting/libro-diario.tsx", "utf8"),
  { compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  } },
).outputText;

function renderDiario(libro) {
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: (name) => {
      if (name === "@/lib/store/accountingStore")
        return { useAccountingStore: () => ({ ...libro, ocupado: false }) };
      if (name === "@/lib/accounting/core") return require("../.test-build/core.cjs");
      if (name === "@/lib/accounting/local") return require("../.test-build/local.cjs");
      if (name === "@/lib/accounting/reports") return require("../.test-build/reports.cjs");
      if (name === "./json-import" || name === "./journal-account-selector")
        return { __esModule: true, default: () => null };
      return require(name);
    },
  });
  return renderToStaticMarkup(React.createElement(exports.default));
}

test("the journal renders a newly registered accumulated VAT settlement", () => {
  let s = localCommand(emptyBook(2026), "catalog", require("../examples/analitico-catalogo.json")).estado;
  s = localCommand(s, "settings", { ...s.configuracion, modoIva: "incluido" }).estado;
  s = localCommand(s, "entries", require("../examples/analitico-asientos.json")).estado;
  s = localCommand(s, "liquidacion-iva", {}).estado;
  assert.match(renderDiario(s), /Liquidación acumulada de IVA/);
});

test("the journal keeps monthly labels and safely renders reversals and invalid month metadata", () => {
  for (const [liquidacionIva, tipo, expected] of [
    ["2026-01", "ajuste", /Liquidación IVA · enero de 2026/],
    ["acumulada", "reversion", /REV-IVA · Reversión de liquidación/],
    ["2026-13", "ajuste", /REV-IVA · Reversión de liquidación/],
  ]) {
    const s = emptyBook(2026);
    s.asientos = [{
      id: "iva", numero: 1, referencia: "REV-IVA", concepto: "Reversión de liquidación",
      fecha: "2026-01-31", tipo, liquidacionIva, cuadra: true, detalles: [],
    }];
    assert.match(renderDiario(s), expected);
  }
});
