import type { DatabaseAdapter, DatabaseConfig, TableInfo, ColumnInfo, IndexInfo, QueryResult, TableStats, ForeignKey } from "./adapter.js";

const DANGEROUS_PATTERNS = /^\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE|INSERT|UPDATE|GRANT|REVOKE)\b/i;

export function createPostgresAdapter(
  exec: (machineId: string, cmd: string) => Promise<string>
): DatabaseAdapter {
  let connected = false;
  let lastConfig: DatabaseConfig | null = null;

  function psql(machineId: string, database: string, sql: string, timeout = 10): string {
    const userFlag = lastConfig?.username ? `-U ${lastConfig.username}` : "";
    const hostFlag = lastConfig?.host ? `-h ${lastConfig.host}` : "";
    const portFlag = lastConfig?.port ? `-p ${lastConfig.port}` : "";
    // Escape single quotes in SQL
    const escaped = sql.replace(/'/g, "'\\''");
    return `PGPASSWORD='${lastConfig?.password || ""}' psql ${userFlag} ${hostFlag} ${portFlag} -d ${database} -t -A -c '${escaped}' --set=statement_timeout=${timeout}s 2>&1`;
  }

  function psqlJson(machineId: string, database: string, sql: string): string {
    const userFlag = lastConfig?.username ? `-U ${lastConfig.username}` : "";
    const hostFlag = lastConfig?.host ? `-h ${lastConfig.host}` : "";
    const portFlag = lastConfig?.port ? `-p ${lastConfig.port}` : "";
    const escaped = sql.replace(/'/g, "'\\''");
    return `PGPASSWORD='${lastConfig?.password || ""}' psql ${userFlag} ${hostFlag} ${portFlag} -d ${database} -t -A -J -c '${escaped}' 2>&1`;
  }

  return {
    async connect(config: DatabaseConfig): Promise<void> {
      lastConfig = config;
      // Test connection
      const result = await exec(config.machineId, psql(config.machineId, config.database, "SELECT 1"));
      if (result.includes("error") || result.includes("fatal")) {
        throw new Error(`Connection failed: ${result.trim()}`);
      }
      connected = true;
    },

    async disconnect(): Promise<void> {
      connected = false;
      lastConfig = null;
    },

    isConnected(): boolean {
      return connected;
    },

    async getStats(machineId: string, database: string): Promise<TableStats> {
      const version = await exec(machineId, psql(machineId, database, "SELECT version()")).catch(() => "unknown");
      const tables = await this.listTables(machineId, database);
      const totalRows = tables.reduce((sum, t) => sum + t.rowCount, 0);

      return {
        totalTables: tables.length,
        totalRows,
        totalSize: tables.reduce((sum, t) => sum + parseSize(t.size), 0) > 0
          ? formatBytes(tables.reduce((sum, t) => sum + parseSize(t.size), 0))
          : "N/A",
        engine: "postgresql",
        version: version.trim().split("\n")[0] || "PostgreSQL",
      };
    },

    async listTables(machineId: string, database: string): Promise<TableInfo[]> {
      const sql = `
        SELECT
          t.table_name,
          t.table_schema,
          COALESCE(pg_catalog.obj_description((t.table_schema || '.' || t.table_name)::regclass), '') as comment,
          COALESCE(pg_total_relation_size((t.table_schema || '.' || t.table_name)::regclass), 0) as size_bytes,
          COALESCE(pg_stat_get_live_tuples((t.table_schema || '.' || t.table_name)::regclass), 0) as row_count
        FROM information_schema.tables t
        WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_schema, t.table_name
      `;
      const output = await exec(machineId, psql(machineId, database, sql));
      return output.trim().split("\n").filter(Boolean).map((line) => {
        const [name, schema, comment, sizeBytes, rowCount] = line.split("|");
        return {
          name: name || "",
          schema: schema || "public",
          comment: comment || "",
          size: formatBytes(parseInt(sizeBytes || "0", 10)),
          rowCount: parseInt(rowCount || "0", 10),
        };
      });
    },

    async getTableColumns(machineId: string, database: string, table: string): Promise<ColumnInfo[]> {
      const sql = `
        SELECT
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          CASE WHEN pk.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END as is_pk,
          fk.foreign_table,
          fk.foreign_column,
          COALESCE(pgd.description, '') as comment
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          WHERE tc.table_name = '${table}' AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON pk.column_name = c.column_name
        LEFT JOIN (
          SELECT
            ku.column_name as local_column,
            ccu.table_name as foreign_table,
            ccu.column_name as foreign_column
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
          WHERE tc.table_name = '${table}' AND tc.constraint_type = 'FOREIGN KEY'
        ) fk ON fk.local_column = c.column_name
        LEFT JOIN pg_catalog.pg_statio_all_tables st ON st.schemaname = c.table_schema AND st.relname = c.table_name
        LEFT JOIN pg_catalog.pg_description pgd ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
        WHERE c.table_name = '${table}'
        ORDER BY c.ordinal_position
      `;
      const output = await exec(machineId, psql(machineId, database, sql));
      return output.trim().split("\n").filter(Boolean).map((line) => {
        const [name, type, nullable, defaultVal, isPk, fTable, fColumn, comment] = line.split("|");
        return {
          name: name || "",
          type: type || "",
          nullable: nullable === "YES",
          defaultValue: defaultVal || null,
          isPrimaryKey: isPk === "YES",
          isForeignKey: !!fTable,
          foreignTable: fTable || null,
          foreignColumn: fColumn || null,
          comment: comment || "",
        };
      });
    },

    async getTableIndexes(machineId: string, database: string, table: string): Promise<IndexInfo[]> {
      const sql = `
        SELECT
          i.relname as index_name,
          ix.indisunique as is_unique,
          ix.indisprimary as is_primary,
          am.amname as index_type,
          array_to_string(array_agg(a.attname), ',') as columns
        FROM pg_catalog.pg_class t
        JOIN pg_catalog.pg_index ix ON t.oid = ix.indrelid
        JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
        JOIN pg_catalog.pg_am am ON i.relam = am.oid
        JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE t.relname = '${table}'
        GROUP BY i.relname, ix.indisunique, ix.indisprimary, am.amname
        ORDER BY i.relname
      `;
      const output = await exec(machineId, psql(machineId, database, sql));
      return output.trim().split("\n").filter(Boolean).map((line) => {
        const [name, unique, primary, type, columns] = line.split("|");
        return {
          name: name || "",
          columns: (columns || "").split(","),
          unique: unique === "t",
          type: primary === "t" ? "PRIMARY" : type || "btree",
        };
      });
    },

    async getForeignKeys(machineId: string, database: string): Promise<ForeignKey[]> {
      const sql = `
        SELECT
          tc.constraint_name,
          tc.table_name as from_table,
          ku.column_name as from_column,
          ccu.table_name as to_table,
          ccu.column_name as to_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        ORDER BY tc.table_name
      `;
      const output = await exec(machineId, psql(machineId, database, sql));
      return output.trim().split("\n").filter(Boolean).map((line) => {
        const [name, fromTable, fromCol, toTable, toCol] = line.split("|");
        return {
          constraintName: name || "",
          fromTable: fromTable || "",
          fromColumn: fromCol || "",
          toTable: toTable || "",
          toColumn: toCol || "",
        };
      });
    },

    async getTableDDL(machineId: string, database: string, table: string): Promise<string> {
      const sql = `SELECT pg_get_tabledef('public', '${table}')`;
      try {
        const output = await exec(machineId, psql(machineId, database, sql));
        if (output.includes("function") && output.includes("does not exist")) {
          // Fallback: construct basic DDL
          const cols = await this.getTableColumns(machineId, database, table);
          const lines = cols.map((c) => {
            let def = `  ${c.name} ${c.type}`;
            if (!c.nullable) def += " NOT NULL";
            if (c.defaultValue) def += ` DEFAULT ${c.defaultValue}`;
            if (c.isPrimaryKey) def += " PRIMARY KEY";
            return def;
          });
          return `CREATE TABLE ${table} (\n${lines.join(",\n")}\n);`;
        }
        return output.trim();
      } catch {
        return `-- DDL not available for ${table}`;
      }
    },

    async query(machineId: string, database: string, sql: string, readOnly = true): Promise<QueryResult> {
      if (readOnly && DANGEROUS_PATTERNS.test(sql)) {
        throw new Error("Write queries blokirane u read-only modu. Postavite readOnly=false za dopuštanje.");
      }

      const start = Date.now();
      const output = await exec(machineId, psqlJson(machineId, database, sql));
      const duration = Date.now() - start;

      if (output.includes("error") || output.includes("fatal")) {
        throw new Error(output.trim());
      }

      try {
        const data = JSON.parse(output);
        const rows = Array.isArray(data) ? data : [data];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return {
          columns,
          rows,
          rowCount: rows.length,
          duration,
          truncated: rows.length >= 1000,
        };
      } catch {
        // Not JSON — try pipe-separated
        const lines = output.trim().split("\n").filter(Boolean);
        if (lines.length === 0) return { columns: [], rows: [], rowCount: 0, duration, truncated: false };

        const rows = lines.map((line) => {
          const values = line.split("|");
          const row: Record<string, unknown> = {};
          values.forEach((v, i) => { row[`col${i}`] = v; });
          return row;
        });

        return {
          columns: rows.length > 0 ? Object.keys(rows[0]) : [],
          rows,
          rowCount: rows.length,
          duration,
          truncated: lines.length >= 1000,
        };
      }
    },

    async listDatabases(machineId: string): Promise<string[]> {
      const sql = "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres') ORDER BY datname";
      const output = await exec(machineId, `PGPASSWORD='${lastConfig?.password || ""}' psql ${lastConfig?.host ? `-h ${lastConfig.host}` : ""} -t -A -c '${sql}' 2>&1`);
      return output.trim().split("\n").filter(Boolean);
    },
  };
}

// ── Helpers ──

function parseSize(sizeStr: string): number {
  if (!sizeStr || sizeStr === "N/A") return 0;
  const match = sizeStr.match(/([\d.]+)\s*(B|KB|MB|GB|TB)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
  return val * (multipliers[unit] || 1);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
