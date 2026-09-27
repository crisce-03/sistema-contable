const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const bases = read("lib/accounting/families.json").map((cuenta) => ({
  codigo: cuenta.codigo,
  nombre: cuenta.nombre,
  padreCodigo: cuenta.codigo.length === 1 ? null : cuenta.codigo[0],
}));
const cuentas = [...bases, ...read("examples/catalogo-para-asientosguia1.json").cuentas]
  .sort((a, b) => a.codigo.length - b.codigo.length || a.codigo.localeCompare(b.codigo));
const codigos = new Set(cuentas.map((cuenta) => cuenta.codigo));
if (codigos.size !== cuentas.length || cuentas.length !== 43)
  throw new Error("La plantilla de la guía debe tener 43 códigos únicos.");
for (const cuenta of cuentas) {
  if (cuenta.padreCodigo !== null && !codigos.has(cuenta.padreCodigo))
    throw new Error(`Falta el padre de ${cuenta.codigo}.`);
}
const sql = (value) => value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
const content = `-- Catálogo inicial de la guía asientosguia1: 20 grupos/rubros y 23 cuentas.
-- Generado por: node scripts/generate-catalog.cjs
-- Fuentes: lib/accounting/families.json y examples/catalogo-para-asientosguia1.json.
-- Ejecutar después de schema.sql, antes de crear el primer libro.
-- Solo actualiza la plantilla de libros futuros; no modifica cuentas ni asientos existentes.
-- No combinar con el catálogo comercial: varios códigos tienen significados distintos.
-- Repetir el script restablece los nombres y padres de estos 43 códigos de la plantilla.

BEGIN;

INSERT INTO public.catalogo_base (codigo, nombre, padre_codigo)
VALUES
${cuentas.map((c) => `  (${sql(c.codigo)}, ${sql(c.nombre)}, ${sql(c.padreCodigo)})`).join(",\n")}
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  padre_codigo = EXCLUDED.padre_codigo;

COMMIT;
`;
fs.mkdirSync(path.join(root, "supabase"), { recursive: true });
fs.writeFileSync(path.join(root, "supabase/data.sql"), content, "utf8");
console.log(`supabase/data.sql: ${cuentas.length} cuentas.`);
