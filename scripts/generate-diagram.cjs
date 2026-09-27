const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "supabase/script.sql"), "utf8");

// Read complete table definitions without interpreting function bodies or
// splitting numeric(12, 2), CHECK expressions, and quoted strings at commas.
function tableDefinitions(sql) {
  const definitions = [];
  const pattern = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(public\.[a-z_][a-z_0-9]*)\s*\(/gi;
  for (const match of sql.matchAll(pattern)) {
    let depth = 1;
    let quoted = null;
    let lineComment = false;
    let blockComment = false;
    let index = match.index + match[0].length;
    for (; index < sql.length && depth; index++) {
      const character = sql[index];
      const next = sql[index + 1];
      if (lineComment) {
        if (character === "\n") lineComment = false;
      } else if (blockComment) {
        if (character === "*" && next === "/") { blockComment = false; index++; }
      } else if (quoted) {
        if (character === quoted && next === quoted) index++;
        else if (character === quoted) quoted = null;
      } else if (character === "-" && next === "-") {
        lineComment = true; index++;
      } else if (character === "/" && next === "*") {
        blockComment = true; index++;
      } else if (character === "'" || character === '"') quoted = character;
      else if (character === "(") depth++;
      else if (character === ")") depth--;
    }
    if (depth) throw new Error(`Definición SQL incompleta: ${match[1]}.`);
    definitions.push({ name: match[1], sql: sql.slice(match.index, index) + ";" });
  }
  if (!definitions.length) throw new Error("No se encontraron tablas public en script.sql.");
  return definitions;
}

const identifier = (value) => '"' + value.replaceAll('"', '""') + '"';
const displayName = (schema, table) => schema === "auth" ? "users" : table;
const actions = { a: "no action", r: "restrict", c: "cascade", n: "set null", d: "set default" };
const columnsList = (columns) => columns.map(identifier).join(", ");
const xml = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&apos;");

async function main() {
  const definitions = tableDefinitions(source);
  const database = new PGlite();
  try {
    // Supabase owns this table. This fixture only supplies its referenced PK;
    // no generated diagram file is part of the production installation.
    await database.exec("CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);");
    for (const definition of definitions) await database.exec(definition.sql);
    const { rows: columns } = await database.query(`
      SELECT n.nspname AS table_schema, c.relname AS table_name,
        a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS data_type,
        a.attnotnull AS not_null
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'auth') AND c.relkind = 'r'
        AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY n.nspname, c.relname, a.attnum
    `);
    const { rows: constraints } = await database.query(`
      SELECT n.nspname AS table_schema, c.relname AS table_name,
        k.conname AS name, k.contype AS kind,
        ARRAY(SELECT a.attname FROM unnest(k.conkey) WITH ORDINALITY AS x(attnum, position)
          JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = x.attnum
          ORDER BY x.position) AS columns,
        rn.nspname AS referenced_schema, rc.relname AS referenced_table,
        ARRAY(SELECT a.attname FROM unnest(k.confkey) WITH ORDINALITY AS x(attnum, position)
          JOIN pg_attribute a ON a.attrelid = rc.oid AND a.attnum = x.attnum
          ORDER BY x.position) AS referenced_columns,
        k.confdeltype AS delete_action, k.confupdtype AS update_action
      FROM pg_constraint k
      JOIN pg_class c ON c.oid = k.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_class rc ON rc.oid = k.confrelid
      LEFT JOIN pg_namespace rn ON rn.oid = rc.relnamespace
      WHERE n.nspname IN ('public', 'auth') AND k.contype IN ('p', 'u', 'f')
      ORDER BY n.nspname, c.relname, k.contype, k.conname
    `);
    const order = ["auth.users", ...definitions.map((definition) => definition.name)];
    const tables = order.map((qualified) => {
      const [schema, name] = qualified.split(".");
      return {
        name: displayName(schema, name),
        original: qualified,
        columns: columns.filter((column) => column.table_schema === schema && column.table_name === name),
        constraints: constraints.filter((constraint) => constraint.table_schema === schema && constraint.table_name === name),
      };
    });
    const sqlHeader = `-- DER PostgreSQL para importar en dbdiagram.io.
-- Generado desde supabase/script.sql por node scripts/generate-diagram.cjs.
-- SOLO DIAGRAMA: no ejecutar este archivo en Supabase.
-- users representa únicamente la PK de auth.users, administrada por Supabase.
-- Omite CHECK, valores por defecto, índices secundarios, funciones, triggers y RLS.
-- Las reglas ejecutables completas están en script.sql.
\n`;
    const diagramSql = tables.map((table) => {
      const lines = table.columns.map((column) =>
        `  ${identifier(column.column_name)} ${column.data_type}${column.not_null ? " NOT NULL" : ""}`);
      for (const constraint of table.constraints) {
        const prefix = `  CONSTRAINT ${identifier(constraint.name)} `;
        if (constraint.kind === "p") lines.push(prefix + `PRIMARY KEY (${columnsList(constraint.columns)})`);
        if (constraint.kind === "u") lines.push(prefix + `UNIQUE (${columnsList(constraint.columns)})`);
        if (constraint.kind === "f") lines.push(prefix +
          `FOREIGN KEY (${columnsList(constraint.columns)}) REFERENCES ` +
          `${identifier(displayName(constraint.referenced_schema, constraint.referenced_table))} ` +
          `(${columnsList(constraint.referenced_columns)}) ON DELETE ${actions[constraint.delete_action].toUpperCase()}`);
      }
      return `CREATE TABLE ${identifier(table.name)} (\n${lines.join(",\n")}\n);`;
    }).join("\n\n");
    fs.writeFileSync(path.join(root, "supabase/diagram.sql"), sqlHeader + diagramSql + "\n");

    const dbmlType = (type) => type.includes(" ") ? identifier(type) : type;
    const refColumns = (name, values) => values.length === 1
      ? `${name}.${values[0]}` : `${name}.(${values.join(", ")})`;
    const diagramDbml = tables.map((table) => {
      const primary = table.constraints.find((constraint) => constraint.kind === "p");
      const lines = table.columns.map((column) => {
        const attributes = [];
        if (primary?.columns.length === 1 && primary.columns[0] === column.column_name) attributes.push("pk");
        if (column.not_null) attributes.push("not null");
        return `  ${column.column_name} ${dbmlType(column.data_type)}${attributes.length ? ` [${attributes.join(", ")}]` : ""}`;
      });
      const indexes = table.constraints.filter((constraint) =>
        constraint.kind === "u" || (constraint.kind === "p" && constraint.columns.length > 1));
      if (indexes.length) lines.push("", "  indexes {", ...indexes.map((constraint) =>
        `    (${constraint.columns.join(", ")}) [${constraint.kind === "p" ? "pk" : "unique"}]`), "  }");
      if (table.original === "auth.users") lines.push("", "  Note: 'Referencia a auth.users; administrada por Supabase Auth.'");
      return `Table ${table.name} {\n${lines.join("\n")}\n}`;
    }).join("\n\n");
    const references = constraints.filter((constraint) => constraint.kind === "f").map((constraint) =>
      `Ref ${constraint.name}: ${refColumns(displayName(constraint.table_schema, constraint.table_name), constraint.columns)}` +
      ` > ${refColumns(displayName(constraint.referenced_schema, constraint.referenced_table), constraint.referenced_columns)}` +
      ` [delete: ${actions[constraint.delete_action]}]`);
    fs.writeFileSync(path.join(root, "supabase/diagram.dbml"),
      "// Generado desde script.sql; solo documentación. users representa auth.users.\n\n" +
      diagramDbml + "\n\n" + references.join("\n") + "\n");

    // An uncompressed diagrams.net document can be opened without SQL plugins.
    const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
    const positions = new Map();
    const rowHeights = [];
    for (let i = 0; i < tables.length; i++) {
      const row = Math.floor(i / 3);
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, 68 + tables[i].columns.length * 24);
    }
    for (const [index, table] of tables.entries()) {
      const row = Math.floor(index / 3);
      const x = 70 + (index % 3) * 460;
      const y = 100 + rowHeights.slice(0, row).reduce((total, height) => total + height + 120, 0);
      const height = 68 + table.columns.length * 24;
      positions.set(table.name, `table-${index}`);
      const details = table.columns.map((column) => {
        const isPrimary = table.constraints.some((constraint) => constraint.kind === "p" && constraint.columns.includes(column.column_name));
        const isForeign = table.constraints.some((constraint) => constraint.kind === "f" && constraint.columns.includes(column.column_name));
        const markers = [isPrimary ? "PK" : "", isForeign ? "FK" : ""].filter(Boolean).join("/");
        return `<div style="padding:3px 8px;font-size:12px">${markers ? `<b>${markers}</b> ` : ""}${column.column_name}` +
          ` <span style="color:#555">${column.data_type}${column.not_null ? "" : " · NULL"}</span></div>`;
      });
      const label = `<div style="font-size:16px;background:#dae8fc;padding:10px"><b>${table.name}</b></div>` +
        (table.original === "auth.users" ? '<div style="padding:4px 8px;color:#555">Supabase Auth · referencia</div>' : "") + details.join("");
      cells.push(`<mxCell id="table-${index}" value="${xml(label)}" style="rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacing=0;fillColor=#ffffff;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="360" height="${height}" as="geometry"/></mxCell>`);
    }
    constraints.filter((constraint) => constraint.kind === "f").forEach((constraint, index) => {
      const from = positions.get(displayName(constraint.table_schema, constraint.table_name));
      const to = positions.get(displayName(constraint.referenced_schema, constraint.referenced_table));
      cells.push(`<mxCell id="fk-${index}" value="${xml(constraint.columns.join(", "))}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;startArrow=ERmany;endArrow=ERone;strokeColor=#64748b;fontSize=10;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="${from}" target="${to}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
    });
    fs.writeFileSync(path.join(root, "supabase/diagram.drawio"),
      `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net"><diagram id="sistema-contable" name="DER"><mxGraphModel grid="1" gridSize="10" page="0"><root>${cells.join("\n")}</root></mxGraphModel></diagram></mxfile>\n`);
    console.log(`DER generado: ${tables.length} tablas (${tables.length - 1} propias y auth.users), ${references.length} relaciones.`);
  } finally {
    await database.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
