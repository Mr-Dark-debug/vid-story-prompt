import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";

// Additive generation from an ACTUALLY migrated local PostgreSQL database.
// Preserve the existing live-schema snapshot for unrelated tables: the isolated
// contract fixture intentionally does not contain every production migration.
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
}
const binary = join(
  option("--postgres-bin", "C:/Program Files/PostgreSQL/17/bin"),
  process.platform === "win32" ? "psql.exe" : "psql",
);
const connection = [
  "-h",
  "127.0.0.1",
  "-p",
  option("--port", "5432"),
  "-U",
  option("--user", "motion_test"),
  "-d",
  option("--database", "postgres"),
  "-X",
  "-A",
  "-t",
  "-v",
  "ON_ERROR_STOP=1",
];
function query(sql) {
  const result = spawnSync(binary, [...connection, "-c", sql], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error("PostgreSQL type introspection failed; no generated files were written.");
  return JSON.parse(result.stdout.trim());
}
const columns = query(
  `select coalesce(json_agg(c order by table_name,ordinal_position),'[]'::json) from (select table_name,column_name,data_type,udt_name,is_nullable,column_default,ordinal_position from information_schema.columns where table_schema='public' and (table_name like 'motion_%' or table_name='approved_motion_prompts' or (table_name='plans' and (column_name like '%motion%')))) c`,
);
if (
  !columns.some(
    (column) => column.table_name === "motion_renders" && column.column_name === "render_manifest",
  )
)
  throw new Error("Apply the complete Motion Studio migration before generating types.");
const functions = query(
  `select coalesce(json_agg(f),'[]'::json) from (select p.proname as name,pg_get_function_result(p.oid) as returns,(select coalesce(json_agg(json_build_object('name',a.name,'type',format_type(a.type,null),'optional',a.ordinality>p.pronargs-p.pronargdefaults) order by a.ordinality),'[]'::json) from unnest(p.proargnames,p.proargtypes::oid[]) with ordinality a(name,type,ordinality)) as args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%motion%' and p.proname not in('motion_assert_editor','motion_validate_spec','motion_version_immutable','motion_render_immutable') order by p.proname) f`,
);
function typeFor(value) {
  if (value.data_type === "ARRAY")
    return value.udt_name === "_uuid" || value.udt_name === "_text" ? "string[]" : "Json[]";
  const type = value.udt_name ?? value.type ?? value;
  if (
    [
      "uuid",
      "text",
      "character varying",
      "varchar",
      "timestamp with time zone",
      "timestamptz",
      "date",
    ].includes(type)
  )
    return "string";
  if (
    [
      "smallint",
      "integer",
      "bigint",
      "numeric",
      "real",
      "double precision",
      "int2",
      "int4",
      "int8",
      "float4",
      "float8",
    ].includes(type)
  )
    return "number";
  if (type === "bool" || type === "boolean") return "boolean";
  if (type === "text[]" || type === "uuid[]") return "string[]";
  if (type === "void") return "undefined";
  return "Json";
}
const groups = Object.groupBy(columns, (column) => column.table_name);
function fieldsFor(table, mode) {
  return groups[table]
    .map(
      (column) =>
        `${JSON.stringify(column.column_name)}${mode === "Update" || (mode === "Insert" && (column.column_default != null || column.is_nullable === "YES")) ? "?" : ""}: ${typeFor(column)}${column.is_nullable === "YES" ? " | null" : ""};`,
    )
    .join("\n");
}
function tableFor(name) {
  return `${JSON.stringify(name)}: { Row: {${fieldsFor(name, "Row")}}; Insert: {${fieldsFor(name, "Insert")}}; Update: {${fieldsFor(name, "Update")}}; Relationships: []; };`;
}
const file = "src/lib/supabase/database.types.ts";
const original = await readFile(file, "utf8");
const ast = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const database = ast.statements.find(
  (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === "Database",
);
function member(type, name) {
  return type?.members?.find((item) => item.name?.getText(ast).replaceAll('"', "") === name);
}
const publicType = member(database?.type, "public")?.type;
if (!publicType) throw new Error("Generated Database type not found.");
const edits = [];
function patch(node, text) {
  edits.push({ start: node.getStart(ast), end: node.end, text });
}
const tables = member(publicType, "Tables");
for (const name of Object.keys(groups)
  .filter((name) => name.startsWith("motion_"))
  .sort()) {
  const existing = member(tables.type, name);
  if (existing) patch(existing, tableFor(name));
  else
    edits.push({
      start: tables.type.end - 1,
      end: tables.type.end - 1,
      text: `\n${tableFor(name)}\n`,
    });
}
const plans = member(tables.type, "plans");
if (!plans) throw new Error("Plans table not found in existing generated snapshot.");
for (const mode of ["Row", "Insert", "Update"]) {
  const fields = member(plans.type, mode);
  for (const column of groups.plans) {
    const existing = member(fields.type, column.column_name);
    const text = `${JSON.stringify(column.column_name)}${mode === "Row" ? "" : "?"}: ${typeFor(column)};`;
    if (existing) patch(existing, text);
    else edits.push({ start: fields.type.end - 1, end: fields.type.end - 1, text: `\n${text}\n` });
  }
}
const views = member(publicType, "Views");
const viewText = `"approved_motion_prompts": { Row: {${fieldsFor("approved_motion_prompts", "Row")}}; Relationships: []; };`;
if (ts.isTypeLiteralNode(views.type)) {
  const existing = member(views.type, "approved_motion_prompts");
  if (existing) patch(existing, viewText);
  else edits.push({ start: views.type.end - 1, end: views.type.end - 1, text: `\n${viewText}\n` });
} else patch(views, `Views: { ${viewText} };`);
const rpc = member(publicType, "Functions");
for (const fn of functions) {
  const parameters = fn.args.length
    ? `{${fn.args.map((arg) => `${JSON.stringify(arg.name)}${arg.optional ? "?" : ""}: ${typeFor(arg)};`).join("\n")}}`
    : "Record<string, never>";
  const text = `${JSON.stringify(fn.name)}: { Args: ${parameters}; Returns: ${typeFor(fn.returns)}; };`;
  const existing = member(rpc.type, fn.name);
  if (existing) patch(existing, text);
  else edits.push({ start: rpc.type.end - 1, end: rpc.type.end - 1, text: `\n${text}\n` });
}
let output = original;
for (const edit of edits.sort((a, b) => b.start - a.start))
  output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
output = output.replace(
  /^\/\/ Generated[^\n]*\n(?:\/\/ Refresh additions[^\n]*\n)*/,
  "// Generated from Supabase PostgREST; Motion Studio additions introspected from migrated local PostgreSQL.\n// Refresh additions with scripts/generate-motion-database-types.mjs; full hosted regeneration remains a release gate.\n",
);
output = output.replace(/[ \t]+$/gm, "");
await writeFile(file, output, "utf8");
console.log(
  `Generated ${Object.keys(groups).filter((name) => name.startsWith("motion_")).length} Motion Studio tables, approved public view and ${functions.length} RPC types from migrated PostgreSQL.`,
);
