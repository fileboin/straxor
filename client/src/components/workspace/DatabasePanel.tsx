import { useState, useCallback, useEffect } from "react";
import {
  connectDatabase, listDatabases, getDatabaseStats, listTables,
  getTableColumns, getTableIndexes, executeQuery, getTableDDL,
  type TableInfo, type ColumnInfo, type IndexInfo, type QueryResult, type TableStats,
} from "../../lib/database";

interface Props {
  machineId: string | null;
}

type View = "connect" | "browser" | "query";

export default function DatabasePanel({ machineId }: Props) {
  // Connection
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("postgres");
  const [password, setPassword] = useState("");
  const [databases, setDatabases] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);

  // Browser
  const [view, setView] = useState<View>("connect");
  const [stats, setStats] = useState<TableStats | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [ddl, setDdl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Query
  const [sql, setSql] = useState("SELECT * FROM ");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [readOnly, setReadOnly] = useState(true);

  const conn = { machineId: machineId!, database };

  // ── Connect ──
  const handleConnect = useCallback(async () => {
    if (!machineId || !database) return;
    setConnecting(true);
    setConnError(null);
    try {
      await connectDatabase({ machineId, engine: "postgresql", host, port: parseInt(port, 10), database, username, password });
      setConnected(true);
      setView("browser");
      // Load data
      const [t, s] = await Promise.all([listTables(conn), getDatabaseStats(conn)]);
      setTables(t);
      setStats(s);
    } catch (err: any) {
      setConnError(err.message || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, [machineId, database, host, port, username, password]);

  // ── Load databases list ──
  const handleLoadDatabases = useCallback(async () => {
    if (!machineId) return;
    try {
      const dbs = await listDatabases(machineId, host, parseInt(port, 10), username, password);
      setDatabases(dbs);
    } catch { /* ok */ }
  }, [machineId, host, port, username, password]);

  // ── Select table ──
  const handleSelectTable = useCallback(async (tableName: string) => {
    if (!connected) return;
    setSelectedTable(tableName);
    setLoading(true);
    try {
      const [c, i, d] = await Promise.all([
        getTableColumns({ ...conn, table: tableName }),
        getTableIndexes({ ...conn, table: tableName }),
        getTableDDL({ ...conn, table: tableName }),
      ]);
      setColumns(c);
      setIndexes(i);
      setDdl(d);
    } catch { /* ok */ }
    setLoading(false);
  }, [connected, conn]);

  // ── Run query ──
  const handleQuery = useCallback(async () => {
    if (!connected || !sql.trim()) return;
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    try {
      const result = await executeQuery({ ...conn, sql: sql.trim(), readOnly });
      setQueryResult(result);
    } catch (err: any) {
      setQueryError(err.message || "Query failed");
    } finally {
      setQueryLoading(false);
    }
  }, [connected, sql, readOnly, conn]);

  // ── Keyboard shortcut for query ──
  useEffect(() => {
    if (view !== "query") return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleQuery();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, handleQuery]);

  if (!machineId) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-text-muted">
        <div className="text-3xl opacity-20">🐘</div>
        <div className="text-[12px]">Poveži GitHub repo ili VPS za pristup bazi podataka</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-[#202838] bg-[#0e1422] shrink-0">
        {(["connect", "browser", "query"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => { if (v !== "connect" || !connected) setView(v); else setView(v); }}
            disabled={v !== "connect" && !connected}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              view === v
                ? "bg-accent/10 text-accent"
                : "text-text-muted hover:text-text-secondary disabled:opacity-30"
            }`}
          >
            {v === "connect" ? "Veza" : v === "browser" ? "Šema" : "Upit"}
          </button>
        ))}
        {connected && (
          <span className="ml-2 text-[9px] text-accent flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            {database}
          </span>
        )}
      </div>

      {/* ── Connect View ── */}
      {view === "connect" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="text-[11px] text-text-muted mb-2">Postavke veze (PostgreSQL)</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-0.5">
              <span className="text-[9px] text-text-muted">Host</span>
              <input value={host} onChange={(e) => setHost(e.target.value)} className="w-full px-2 py-1 bg-[#111] text-text text-[11px] rounded border border-[#333] focus:border-accent outline-none" />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] text-text-muted">Port</span>
              <input value={port} onChange={(e) => setPort(e.target.value)} className="w-full px-2 py-1 bg-[#111] text-text text-[11px] rounded border border-[#333] focus:border-accent outline-none" />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] text-text-muted">Korisnik</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-2 py-1 bg-[#111] text-text text-[11px] rounded border border-[#333] focus:border-accent outline-none" />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] text-text-muted">Lozinka</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-2 py-1 bg-[#111] text-text text-[11px] rounded border border-[#333] focus:border-accent outline-none" />
            </label>
          </div>
          <label className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-text-muted">Baza podataka</span>
              <button onClick={handleLoadDatabases} className="text-[9px] text-accent/60 hover:text-accent">Učitaj liste</button>
            </div>
            {databases.length > 0 ? (
              <select value={database} onChange={(e) => setDatabase(e.target.value)} className="w-full px-2 py-1 bg-[#111] text-text text-[11px] rounded border border-[#333] focus:border-accent outline-none">
                <option value="">Odaberi bazu…</option>
                {databases.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            ) : (
              <input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="ime_baze" className="w-full px-2 py-1 bg-[#111] text-text text-[11px] rounded border border-[#333] focus:border-accent outline-none" />
            )}
          </label>
          {connError && <div className="text-[10px] text-red-400">{connError}</div>}
          <button onClick={handleConnect} disabled={!database || connecting} className="w-full py-1.5 bg-accent/10 text-accent text-[11px] rounded hover:bg-accent/20 disabled:opacity-30 transition-colors">
            {connecting ? "Povezujem…" : "Poveži se"}
          </button>
          <div className="text-[9px] text-text-muted/40 text-center">
            Read-only mod po defaultu. Write upiti blokirani.
          </div>
        </div>
      )}

      {/* ── Browser View ── */}
      {view === "browser" && (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Table list */}
          <div className="w-44 border-r border-[#202838] bg-[#0a0e1a] overflow-y-auto shrink-0">
            {stats && (
              <div className="px-2 py-1.5 border-b border-[#202838] text-[9px] text-text-muted space-y-0.5">
                <div>{stats.totalTables} tabela &middot; {stats.totalRows.toLocaleString()} redova</div>
                <div>{stats.engine} {stats.version?.split(" ")[1] || ""}</div>
              </div>
            )}
            {tables.map((t) => (
              <div
                key={t.name}
                onClick={() => handleSelectTable(t.name)}
                className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[11px] transition-colors ${
                  selectedTable === t.name
                    ? "bg-accent/10 text-accent"
                    : "text-text-secondary hover:bg-surface-2"
                }`}
              >
                <span className="text-[9px] opacity-40">⊞</span>
                <span className="truncate">{t.name}</span>
                <span className="ml-auto text-[8px] text-text-muted/40">{t.rowCount}</span>
              </div>
            ))}
          </div>

          {/* Table detail */}
          <div className="flex-1 overflow-y-auto p-3">
            {!selectedTable && (
              <div className="text-[11px] text-text-muted text-center py-8">Odaberi tabelu</div>
            )}
            {selectedTable && loading && (
              <div className="text-[11px] text-text-muted text-center py-8">Učitavam…</div>
            )}
            {selectedTable && !loading && (
              <div className="space-y-4">
                <div className="text-[12px] text-text font-medium">{selectedTable}</div>

                {/* Columns */}
                <div>
                  <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1">Kolone</div>
                  <div className="bg-[#141824] rounded border border-[#2d3750] overflow-hidden">
                    <div className="grid grid-cols-[1fr_100px_60px_60px] gap-0 text-[9px] text-text-muted/60 px-2 py-1 border-b border-[#2d3750]">
                      <span>Naziv</span><span>Tip</span><span>PK</span><span>Null</span>
                    </div>
                    {columns.map((c) => (
                      <div key={c.name} className="grid grid-cols-[1fr_100px_60px_60px] gap-0 text-[10px] text-text-secondary px-2 py-1 border-b border-[#202838] hover:bg-surface-2/30">
                        <span className="font-mono">{c.name}</span>
                        <span className="text-text-muted">{c.type}</span>
                        <span>{c.isPrimaryKey ? "🔑" : ""}</span>
                        <span className="text-text-muted">{c.nullable ? "✓" : "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Indexes */}
                {indexes.length > 0 && (
                  <div>
                    <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1">Indeksi</div>
                    <div className="bg-[#141824] rounded border border-[#2d3750] overflow-hidden">
                      {indexes.map((idx) => (
                        <div key={idx.name} className="flex items-center gap-2 px-2 py-1 text-[10px] border-b border-[#202838]">
                          <span className="text-text-secondary font-mono">{idx.name}</span>
                          <span className="text-[8px] text-text-muted">({idx.columns.join(", ")})</span>
                          {idx.unique && <span className="text-[8px] text-accent">UNIQUE</span>}
                          <span className="ml-auto text-[8px] text-text-muted/40">{idx.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DDL */}
                {ddl && (
                  <div>
                    <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1">DDL</div>
                    <pre className="bg-[#141824] rounded border border-[#2d3750] p-2 text-[10px] text-text-secondary font-mono overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {ddl}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Query View ── */}
      {view === "query" && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* SQL input */}
          <div className="p-2 border-b border-[#202838] space-y-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[9px] text-text-muted cursor-pointer">
                <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} className="w-3 h-3 accent-accent" />
                Read-only
              </label>
              <div className="flex-1" />
              <button onClick={handleQuery} disabled={queryLoading || !sql.trim()} className="px-3 py-0.5 bg-accent/10 text-accent text-[10px] rounded hover:bg-accent/20 disabled:opacity-30 transition-colors">
                {queryLoading ? "…" : "▶ Pokreni"}
              </button>
              <span className="text-[8px] text-text-muted/40">Ctrl+Enter</span>
            </div>
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              className="w-full h-20 px-2 py-1 bg-[#111] text-text text-[11px] font-mono rounded border border-[#333] focus:border-accent outline-none resize-none"
              placeholder="SELECT * FROM table_name LIMIT 100;"
              spellCheck={false}
            />
          </div>

          {/* Results */}
          <div className="flex-1 overflow-auto">
            {queryError && (
              <div className="px-3 py-2 text-[11px] text-red-400">{queryError}</div>
            )}
            {queryResult && (
              <div className="p-2">
                <div className="text-[9px] text-text-muted mb-1">
                  {queryResult.rowCount} redova &middot; {queryResult.duration}ms
                  {queryResult.truncated && " (truncirano)"}
                </div>
                <div className="bg-[#141824] rounded border border-[#2d3750] overflow-auto max-h-[300px]">
                  <table className="text-[10px] w-full">
                    <thead>
                      <tr className="border-b border-[#333]">
                        {queryResult.columns.map((col) => (
                          <th key={col} className="px-2 py-1 text-left text-text-muted font-medium sticky top-0 bg-[#111]">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.map((row, i) => (
                        <tr key={i} className="border-b border-[#202838] hover:bg-surface-2/20">
                          {queryResult.columns.map((col) => (
                            <td key={col} className="px-2 py-0.5 text-text-secondary font-mono max-w-[200px] truncate">
                              {String(row[col] ?? "NULL")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {!queryResult && !queryError && (
              <div className="text-[11px] text-text-muted text-center py-8">
                Unesi SQL upit i klikni ▶ ili Ctrl+Enter
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
