const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { loadTs } = require("./helpers/load-ts.cjs");
const { accountingCommand, AccountingError } = loadTs("lib/accounting/service.ts");
const { localCommand, emptyBook } = loadTs("lib/accounting/local.ts");
const { restoreBook } = loadTs("lib/accounting/restore.ts");
const catalog = require("../examples/catalogo-para-asientosguia1.json");
const config = require("../lib/supabase/default-config.json");
const guide = require("../examples/asientos-guia1-personalizado.json");
function fixture() {
  let book = localCommand(emptyBook(2026), "catalog", catalog).estado;
  book = localCommand(book, "settings", config).estado;
  return localCommand(book, "entries", guide).estado;
}
function repository(initial = null) {
  let current = initial;
  let writes = 0;
  return {
    load: async () => structuredClone(current),
    catalog: async () => catalog.cuentas.map(c => ({ ...c, padre_codigo: c.padreCodigo })),
    commit: async (version, estado, action) => {
      if (current && (version.bookId !== current.id || version.revision !== current.revision)) throw new AccountingError("conflict", 409);
      current = { id: action === "new" ? randomUUID() : current.id, revision: action === "new" ? 1 : current.revision + 1, estado: structuredClone(estado) };
      writes++;
      return structuredClone(current);
    },
    writes: () => writes,
  };
}
test("first open seeds guide accounts/settings once; reads never rewrite the book", async () => {
  const repo = repository();
  const initial = await accountingCommand(repo, "init", {});
  assert.equal(initial.estado.cuentas.length, 43);
  assert.equal(initial.estado.configuracion.cuentaIvaDebito, "2102");
  assert.deepEqual(await accountingCommand(repo, "init", {}), initial);
  assert.equal(repo.writes(), 1);
});
test("service preserves guide amounts and rejects stale or invalid commands before persistence", async () => {
  const repo = repository({ id: randomUUID(), revision: 1, estado: fixture() });
  const current = await accountingCommand(repo, "init", {});
  const version = { bookId: current.id, revision: current.revision };
  const result = await accountingCommand(repo, "period", { anio: 2027, cerrado: false }, version);
  assert.equal(result.estado.asientos.length, 13);
  assert.deepEqual(result.estado.asientos, current.estado.asientos);
  await assert.rejects(accountingCommand(repo, "newExercise", {}, version), e => e.status === 409);
  await assert.rejects(accountingCommand(repo, "deleteEverything", {}, { ...version, revision: 2 }), /no permitida/);
  assert.equal(repo.writes(), 1);
});
test("restore keeps IDs, reversals, closed years, Kardex settings and account balances", () => {
  let book = fixture();
  book = localCommand(book, "reverse", { id: book.asientos[0].id, fecha: "2026-12-31", motivo: "Prueba" }).estado;
  book = localCommand(book, "kardex", { id: "producto", nombre: "Prueba", costo: "1", venta: "2", inicial: 10,
    inicio: "2026-01-01", fin: "2026-12-31", costoIncluyeIva: false, ventaIncluyeIva: true,
    costosMovimientos: { inicial: { costo: "1.00", incluyeIva: false } },
    cuentas: { compras: "4101", ventas: "5101", devolCompras: "5102", devolVentas: "4102" } }).estado;
  book = localCommand(book, "period", { anio: 2026, cerrado: true }).estado;
  const serialized = JSON.parse(JSON.stringify(book));
  assert.deepEqual(restoreBook(serialized), serialized);
  const audit = { ...serialized, versionAuditoria: 2 }; delete audit.versionLocal;
  assert.deepEqual(restoreBook(audit), serialized);
});
test("restore rejects mismatched IDs, unbalanced entries, duplicate references and corrupt reversals", () => {
  const original = fixture();
  for (const corrupt of [
    b => { b.asientos[0].detalles[0].debe += 1; },
    b => { b.asientos[0].detalles[0].cuentaId = "otro"; },
    b => { b.asientos[1].referencia = b.asientos[0].referencia; },
    b => { b.asientos[0].tipo = "reversion"; b.asientos[0].reversaDe = "inexistente"; },
  ]) {
    const changed = structuredClone(original); corrupt(changed);
    assert.throws(() => restoreBook(changed));
  }
  assert.equal(original.asientos.length, 13);
});
test("restore always creates a separate book and rejects invalid files without saving", async () => {
  const repo = repository({ id: randomUUID(), revision: 1, estado: fixture() });
  const before = await repo.load(); const version = { bookId: before.id, revision: 1 };
  await assert.rejects(accountingCommand(repo, "restore", { versionLocal: 3 }, version));
  assert.equal(repo.writes(), 0);
  const after = await accountingCommand(repo, "restore", fixture(), version);
  assert.notEqual(before.id, after.id);
  assert.equal(after.estado.asientos.length, 13);
});
