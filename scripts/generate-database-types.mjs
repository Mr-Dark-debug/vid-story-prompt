import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const response = await fetch(`${url}/rest/v1/`, {
  headers: {
    apikey: key,
    authorization: `Bearer ${key}`,
    accept: "application/openapi+json",
  },
});

if (!response.ok) {
  throw new Error(`PostgREST schema request failed with ${response.status}`);
}

const schema = await response.json();
const definitions = schema.definitions ?? schema.components?.schemas ?? {};
const tableNames = Object.keys(schema.paths ?? {})
  .filter((path) => /^\/[a-zA-Z0-9_]+$/.test(path) && schema.paths[path]?.get)
  .map((path) => path.slice(1))
  .filter((name) => definitions[name])
  .sort();

function typeFor(value) {
  if (value?.$ref) return value.$ref.split("/").at(-1) ?? "Json";
  if (Array.isArray(value?.enum)) return value.enum.map((item) => JSON.stringify(item)).join(" | ");
  if (value?.type === "string") return "string";
  if (value?.type === "integer" || value?.type === "number") return "number";
  if (value?.type === "boolean") return "boolean";
  if (value?.type === "array") return `${typeFor(value.items)}[]`;
  if (value?.type === "object") return "Json";
  return "Json";
}

function fieldsFor(definition, mode) {
  const required = new Set(definition.required ?? []);
  return Object.entries(definition.properties ?? {})
    .map(([name, value]) => {
      const hasDatabaseDefault =
        name === "id" ||
        name.endsWith("_at") ||
        value.default !== undefined ||
        value.type === "array" ||
        value.type === "object";
      const optional =
        mode === "Update" || (mode === "Insert" && (!required.has(name) || hasDatabaseDefault));
      // PostgREST omits nullable metadata for some columns, but a column that is not
      // required and has no database default is nullable in the generated schema.
      const nullable =
        value.nullable ||
        value["x-nullable"] ||
        value.default === null ||
        (!required.has(name) &&
          value.default === undefined &&
          !["created_at", "updated_at", "received_at"].includes(name))
          ? " | null"
          : "";
      return `          ${JSON.stringify(name)}${optional ? "?" : ""}: ${typeFor(value)}${nullable};`;
    })
    .join("\n");
}

const tables = tableNames
  .map((name) => {
    const definition = definitions[name];
    return `      ${JSON.stringify(name)}: {\n        Row: {\n${fieldsFor(definition, "Row")}\n        };\n        Insert: {\n${fieldsFor(definition, "Insert")}\n        };\n        Update: {\n${fieldsFor(definition, "Update")}\n        };\n        Relationships: [];\n      };`;
  })
  .join("\n");

const output = `// Generated from the live Supabase PostgREST schema by scripts/generate-database-types.mjs.\n// Do not edit manually.\n\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\n\nexport type Database = {\n  public: {\n    Tables: {\n${tables}\n    };\n    Views: Record<string, never>;\n    Functions: {\n      create_automated_clip_job: {\n        Args: {\n          p_rule_id: string;\n          p_draft_id: string;\n          p_source_asset_id: string;\n          p_idempotency_key: string;\n        };\n        Returns: string;\n      };\n    };\n    Enums: Record<string, never>;\n    CompositeTypes: Record<string, never>;\n  };\n};\n`;

await writeFile(resolve("src/lib/supabase/database.types.ts"), output, "utf8");
console.log(`Generated ${tableNames.length} public table definitions.`);
