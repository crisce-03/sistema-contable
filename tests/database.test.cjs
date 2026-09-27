const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const ts = require("typescript");

// Compila el motor real en memoria: este archivo tambien se ejecuta solo con
// node --test tests/database.test.cjs, sin depender de .test-build.
const previousLoader = require.extensions[".ts"];
require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
};
const { localCommand, emptyBook } = require("../lib/accounting/local.ts");
if (previousLoader) require.extensions[".ts"] = previousLoader;
else delete require.extensions[".ts"];

let db;
const apply = (s, action, data) => localCommand(s, action, data).estado;
const root = path.resolve(__dirname, "..");
before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  await db.exec(fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8"));
});
after(async () => { if (db) await db.close(); });

async function user() {
  const id = randomUUID();
  await db.query("insert into auth.users(id) values ($1)", [id]);
  return id;
}
async function asRole(role, userId, work) {
  assert.ok(["anon", "authenticated", "service_role"].includes(role));
  return db.transaction(async tx => {
    await tx.exec(`set local role ${role}`);
    if (userId) await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    return work(tx);
  });
}
async function commit(userId, current, estado, action = "save", target = null) {
  return asRole("service_role", null, async tx => {
    const result = await tx.query(
      "select public.accounting_commit($1::uuid,$2::uuid,$3::bigint,$4::jsonb,$5::text,$6::uuid) as value",
      [userId, current?.id ?? null, current?.revision ?? null, estado ? JSON.stringify(estado) : null, action, target],
    );
    return result.rows[0].value;
  });
}
async function load(userId, bookId = null) {
  return asRole("service_role", null, async tx => (await tx.query(
    "select public.accounting_load($1::uuid,$2::uuid) as value", [userId, bookId],
  )).rows[0].value);
}
async function archives(userId) {
  return asRole("service_role", null, async tx => (await tx.query(
    "select public.accounting_archives($1::uuid) as value", [userId],
  )).rows[0].value);
}
function fixture() {
  let state = apply(emptyBook(2026), "catalog", require("../examples/catalogo.json"));
  state = apply(state, "settings", {
    modoIva: "mas_iva", modoInventario: "inventarios_explicitos",
    cuentaIvaCredito: "1109", cuentaIvaDebito: "2108", inventarioFinalFisico: "123.40",
    cuentasReporte: { inventarios: "1105", compras: "4104", ventas: "5101" },
  });
  state = apply(state, "entries", require("../examples/asientos-ejemplo.json"));
  state = apply(state, "reverse", { id: state.asientos[0].id, fecha: "2026-02-01", motivo: "Prueba de persistencia" });
  state = apply(state, "kardex", {
    id: "producto-no-uuid", nombre: "Mercaderia", costo: "20", venta: "40.00", inicial: 12,
    inicio: "2026-01-01", fin: "2026-12-31", costoIncluyeIva: false, ventaIncluyeIva: true,
    cuentas: { compras: "4104", ventas: "5101", devolCompras: "", devolVentas: "" },
    costosMovimientos: { inicial: { costo: "18.00", incluyeIva: false }, historico: { costo: "20.34", incluyeIva: true } },
  });
  state = apply(state, "period", { anio: 2025, cerrado: true });
  state = apply(state, "period", { anio: 2026, cerrado: true });
  state.asientos[0].reversaDe = null;
  state.asientos[0].liquidacionIva = "2026-01";
  state.asientos[0].detalles[0].parcial = 2.25;
  delete state.asientos[0].detalles[0].descripcion;
  // Orden de las cuentas independiente de sus padres; las FK son diferidas.
  state.cuentas.reverse();
  return JSON.parse(JSON.stringify(state));
}

test("SQL preserves the full real accounting engine state, order, nulls, flags and closed periods", async () => {
  const uid = await user();
  assert.equal(await load(uid), null);
  const source = fixture();
  const created = await commit(uid, null, source, "new");
  assert.equal(created.revision, 1);
  assert.match(created.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(apply(created.estado, "init", {}), source);
  assert.deepEqual(await load(uid), created);
  const saved = await commit(uid, created, source);
  assert.equal(saved.revision, 2);
  assert.deepEqual(apply(saved.estado, "init", {}), source);
  const counts = await db.query("select count(*)::integer as n from public.detalles_asiento where libro_id = $1", [saved.id]);
  assert.equal(counts.rows[0].n, source.asientos.flatMap(a => a.detalles).length);
});

test("SQL preserves omitted optional configuration and optional empty maps", async () => {
  const uid = await user();
  const state = emptyBook(2026);
  delete state.kardex;
  let current = await commit(uid, null, state, "new");
  assert.deepEqual(current.estado, state);
  state.kardex = [];
  state.configuracion.cuentaIvaCredito = "";
  state.configuracion.cuentaIvaDebito = "";
  state.configuracion.cuentasReporte = {};
  state.configuracion.inventarioFinalFisico = "";
  current = await commit(uid, current, state);
  assert.deepEqual(current.estado, state);
});

test("RLS isolates owners on every table and clients cannot write or invoke service RPCs", async () => {
  const first = await user();
  const second = await user();
  const firstBook = await commit(first, null, fixture(), "new");
  const secondBook = await commit(second, null, fixture(), "new");
  await asRole("authenticated", first, async tx => {
    const own = await tx.query("select id from public.libros");
    assert.deepEqual(own.rows.map(r => r.id), [firstBook.id]);
    for (const table of ["cuentas", "periodos", "configuracion_libro", "cuentas_reporte", "asientos", "detalles_asiento", "kardex_productos", "kardex_cuentas", "kardex_costos_movimiento"]) {
      const rows = await tx.query(`select distinct libro_id from public.${table}`);
      assert.deepEqual(rows.rows.map(r => r.libro_id), [firstBook.id], table);
    }
  });
  assert.equal(await load(first, secondBook.id), null);
  for (const role of ["anon", "authenticated"]) {
    for (const query of [
      "select public.accounting_load($1::uuid)",
      "select public.accounting_archives($1::uuid)",
      "select public.accounting_commit($1::uuid,null,null,null,'new')",
    ]) await assert.rejects(asRole(role, first, tx => tx.query(query, [first])), { code: "42501" });
    await assert.rejects(asRole(role, first, tx => tx.query("delete from public.libros where usuario_id = $1", [first])), { code: "42501" });
  }
  await assert.rejects(asRole("authenticated", first, tx => tx.exec("select accounting_private.estado_libro(null)")), { code: "42501" });
  assert.deepEqual(await load(first), firstBook);
});

test("optimistic concurrency rejects stale save, new and switch without altering data", async () => {
  const uid = await user();
  const first = await commit(uid, null, emptyBook(2026), "new");
  const nextState = apply(first.estado, "period", { anio: 2027, cerrado: false });
  const winner = await commit(uid, first, nextState);
  for (const action of ["save", "new", "switch"]) {
    await assert.rejects(commit(uid, first, emptyBook(2028), action, first.id), { code: "40001" });
  }
  assert.deepEqual(await load(uid), winner);
  assert.deepEqual(await archives(uid), []);
});

test("concurrent requests using the same revision have exactly one winner", async () => {
  const uid = await user();
  const current = await commit(uid, null, emptyBook(2026), "new");
  const attempts = await Promise.allSettled([
    commit(uid, current, apply(current.estado, "period", { anio: 2027, cerrado: false })),
    commit(uid, current, apply(current.estado, "period", { anio: 2028, cerrado: false })),
  ]);
  assert.equal(attempts.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(attempts.find(r => r.status === "rejected").reason.code, "40001");
  assert.equal((await load(uid)).revision, 2);
});

test("new books archive the previous state; switching is owner-scoped and retains exact contents", async () => {
  const uid = await user();
  const other = await user();
  const first = await commit(uid, null, fixture(), "new");
  const second = await commit(uid, first, emptyBook(2027), "new");
  const foreign = await commit(other, null, emptyBook(2026), "new");
  assert.notEqual(first.id, second.id);
  assert.deepEqual(await archives(uid), [{ key: first.id, book: first.estado }]);
  await assert.rejects(commit(uid, second, null, "switch", foreign.id), { code: "22023" });
  assert.deepEqual(await load(uid), second);
  const restored = await commit(uid, second, { malicious: "ignored" }, "switch", first.id);
  assert.equal(restored.id, first.id);
  assert.deepEqual(restored.estado, first.estado);
  assert.ok(restored.revision > first.revision);
  assert.deepEqual(await archives(uid), [{ key: second.id, book: second.estado }]);
});

test("failed balance, FK or duplicate validations roll back all changes and revisions", async () => {
  const uid = await user();
  const original = await commit(uid, null, fixture(), "new");
  const mutations = [
    state => { state.asientos[0].detalles[0].debe += 1; },
    state => { state.asientos[0].detalles[0].cuentaId = "does-not-exist"; },
    state => { state.asientos[1].referencia = state.asientos[0].referencia; },
    state => { state.asientos[0].detalles = []; },
    state => { state.cuentas.find(c => c.codigo === "110101").padreCodigo = "11"; },
  ];
  for (const mutate of mutations) {
    const broken = structuredClone(original.estado);
    mutate(broken);
    await assert.rejects(commit(uid, original, broken), e => ["23514", "23503", "23505"].includes(e.code));
    assert.deepEqual(await load(uid), original);
  }
  const brokenNew = fixture();
  brokenNew.asientos[0].detalles[0].debe += 1;
  await assert.rejects(commit(uid, original, brokenNew, "new"), { code: "23514" });
  assert.deepEqual(await load(uid), original);
  assert.deepEqual(await archives(uid), []);
});

test("composite foreign keys reject account IDs from a different book even for service writes", async () => {
  const uid = await user();
  const other = await user();
  const first = await commit(uid, null, fixture(), "new");
  const foreign = await commit(other, null, fixture(), "new");
  const state = structuredClone(first.estado);
  const detail = state.asientos[0].detalles[0];
  detail.cuentaId = foreign.estado.cuentas.find(c => c.codigo === detail.codigoCuenta).id;
  await assert.rejects(commit(uid, first, state), { code: "23503" });
  assert.deepEqual(await load(uid), first);
});

test("first creation rejects duplicates, invalid actions, missing users and missing state", async () => {
  const uid = await user();
  await assert.rejects(commit(uid, null, emptyBook(2026)), { code: "40001" });
  await assert.rejects(commit(uid, null, emptyBook(2026), "unknown"), { code: "22023" });
  await assert.rejects(commit(uid, null, null, "new"), { code: "22023" });
  await assert.rejects(commit(null, null, emptyBook(2026), "new"), { code: "22023" });
  const current = await commit(uid, null, emptyBook(2026), "new");
  await assert.rejects(commit(uid, null, emptyBook(2026), "new"), { code: "40001" });
  assert.deepEqual(await load(uid), current);
});

test("seed catalog installs transactionally, has valid parents and imports through the real engine", async () => {
  await db.exec(fs.readFileSync(path.join(root, "supabase/data.sql"), "utf8"));
  const result = await asRole("authenticated", await user(), tx => tx.query("select codigo,nombre,padre_codigo from public.catalogo_base order by codigo"));
  assert.ok(result.rows.length >= 40);
  const catalog = { version: 1, cuentas: result.rows.filter(r => r.codigo.length >= 4).map(r => ({
    codigo: r.codigo, nombre: r.nombre, padreCodigo: r.padre_codigo, activa: true,
  })) };
  let state = apply(emptyBook(2026), "catalog", catalog);
  state = apply(state, "settings", require("../lib/supabase/default-config.json"));
  state = apply(state, "entries", require("../examples/asientos-guia1-personalizado.json"));
  assert.equal(state.asientos.length, 13);
  const uid = await user();
  const saved = await commit(uid, null, state, "new");
  assert.deepEqual(apply(saved.estado, "init", {}), state);
  // La semilla es repetible sin duplicar cuentas ni modificar libros existentes.
  await db.exec(fs.readFileSync(path.join(root, "supabase/data.sql"), "utf8"));
  assert.deepEqual(await load(uid), saved);
});
