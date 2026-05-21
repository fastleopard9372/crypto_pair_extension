"use client";

import {
  Activity,
  BarChart3,
  Clock3,
  Database,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TradingViewWidget } from "@/components/TradingViewWidget";
import {
  AnalyzeResult,
  MatrixRow,
  Pair,
  SnapshotMatrix,
  SnapshotMeta,
  analyze,
  getKinds,
  getLivePairs,
  getMatrix,
  getSnapshots,
  saveSnapshot
} from "@/lib/api";

function toNumber(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPercent(value: string | null | undefined) {
  const parsed = toNumber(value);
  if (parsed === null) return "-";
  return `${parsed > 0 ? "+" : ""}${parsed.toFixed(2)}%`;
}

function formatPlainPercent(value: string | null | undefined) {
  const parsed = toNumber(value);
  if (parsed === null) return "-";
  return `${parsed.toFixed(2)}%`;
}

function formatPrice(value: string | null | undefined) {
  const parsed = toNumber(value);
  if (parsed === null) return "-";
  if (parsed >= 1) return parsed.toLocaleString(undefined, { maximumFractionDigits: 6 });
  return parsed.toPrecision(6);
}

function formatVolume(value: string | null | undefined) {
  const parsed = toNumber(value);
  if (parsed === null) return "-";
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(parsed);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function changeClass(value: string | null | undefined) {
  const parsed = toNumber(value);
  if (parsed === null) return "neutral";
  if (parsed > 0) return "positive";
  if (parsed < 0) return "negative";
  return "neutral";
}

export default function Home() {
  const [kinds, setKinds] = useState<string[]>(["USDT", "USDC", "BTC", "ETH"]);
  const [kind, setKind] = useState("USDT");
  const [livePairs, setLivePairs] = useState<Pair[]>([]);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [matrix, setMatrix] = useState<SnapshotMatrix | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [query, setQuery] = useState("");
  const [threshold, setThreshold] = useState(10);
  const [targetRatio, setTargetRatio] = useState(80);
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPair = useMemo(
    () => livePairs.find((pair) => pair.symbol === selectedSymbol),
    [livePairs, selectedSymbol]
  );

  const filteredLivePairs = useMemo(() => {
    const needle = query.trim().toUpperCase();
    if (!needle) return livePairs;
    return livePairs.filter(
      (pair) =>
        pair.symbol.includes(needle) ||
        pair.base_asset.includes(needle) ||
        pair.quote_asset.includes(needle)
    );
  }, [livePairs, query]);

  const visibleMatrixRows = useMemo(() => {
    const rows = matrix?.rows ?? [];
    const needle = query.trim().toUpperCase();
    const filtered = needle ? rows.filter((row) => row.symbol.includes(needle)) : rows;
    return filtered.slice(0, 60);
  }, [matrix, query]);

  const loadLive = useCallback(async () => {
    setIsLoadingLive(true);
    try {
      const result = await getLivePairs(kind);
      setLivePairs(result.pairs);
      setReadAt(result.read_at);
      if (!result.pairs.some((pair) => pair.symbol === selectedSymbol) && result.pairs[0]) {
        setSelectedSymbol(result.pairs[0].symbol);
      }
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load live pairs");
    } finally {
      setIsLoadingLive(false);
    }
  }, [kind, selectedSymbol]);

  const loadHistory = useCallback(async () => {
    try {
      const [snapshotRows, matrixRows] = await Promise.all([getSnapshots(kind), getMatrix(kind)]);
      setSnapshots(snapshotRows);
      setMatrix(matrixRows);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to read saved data");
    }
  }, [kind]);

  const runAnalyze = useCallback(async () => {
    try {
      const result = await analyze(kind, threshold, targetRatio);
      setAnalysis(result);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to analyze snapshots");
    }
  }, [kind, threshold, targetRatio]);

  useEffect(() => {
    getKinds()
      .then((result) => {
        if (result.kinds.length > 0) setKinds(result.kinds);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadLive();
    const timer = window.setInterval(loadLive, 20000);
    return () => window.clearInterval(timer);
  }, [loadLive]);

  useEffect(() => {
    loadHistory();
    setAnalysis(null);
  }, [loadHistory]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const saved = await saveSnapshot(kind);
      setMessage(`Saved ${saved.pair_count} ${saved.kind} pairs at ${formatTime(saved.captured_at)}`);
      await loadHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save snapshot");
    } finally {
      setIsSaving(false);
    }
  }

  function openPair(symbol: string) {
    setSelectedSymbol(symbol);
  }

  return (
    <main className="app-shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">MEXC spot monitor</p>
          <h1>Crypto Pair Snapshot</h1>
        </div>
        <div className="toolbar-actions">
          <div className="kind-tabs" aria-label="Market kind">
            {kinds.slice(0, 10).map((item) => (
              <button
                className={item === kind ? "active" : ""}
                key={item}
                onClick={() => setKind(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <button className="icon-button" onClick={loadLive} title="Refresh live pairs" type="button">
            <RefreshCcw size={17} />
          </button>
        </div>
      </section>

      <section className="status-row">
        <div className="stat">
          <Activity size={17} />
          <span>{livePairs.length} live pairs</span>
        </div>
        <div className="stat">
          <Clock3 size={17} />
          <span>{readAt ? formatTime(readAt) : "Waiting"}</span>
        </div>
        <div className="stat">
          <Database size={17} />
          <span>{snapshots.length} saved snapshots</span>
        </div>
        <label className="search-box">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pair"
          />
        </label>
      </section>

      {message && <div className="notice">{message}</div>}

      <section className="workspace">
        <div className="panel pair-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Live market</p>
              <h2>{kind} pairs</h2>
            </div>
            <button onClick={handleSave} disabled={isSaving} type="button">
              <Save size={17} />
              {isSaving ? "Saving" : "Save Snapshot"}
            </button>
          </div>

          <div className="table-wrap live-table">
            <table>
              <thead>
                <tr>
                  <th>Pair</th>
                  <th>Price</th>
                  <th>Change</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                {filteredLivePairs.map((pair) => (
                  <tr
                    className={pair.symbol === selectedSymbol ? "selected" : ""}
                    key={pair.symbol}
                    onClick={() => openPair(pair.symbol)}
                  >
                    <td>
                      <strong>{pair.base_asset}</strong>
                      <span>/{pair.quote_asset}</span>
                    </td>
                    <td>{formatPrice(pair.last_price)}</td>
                    <td className={changeClass(pair.price_change_percent)}>
                      {formatPercent(pair.price_change_percent)}
                    </td>
                    <td>{formatVolume(pair.volume)}</td>
                  </tr>
                ))}
                {!isLoadingLive && filteredLivePairs.length === 0 && (
                  <tr>
                    <td colSpan={4}>No pairs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">TradingView</p>
              <h2>{selectedPair ? `${selectedPair.base_asset}/${selectedPair.quote_asset}` : selectedSymbol}</h2>
            </div>
            <div className={`change-pill ${changeClass(selectedPair?.price_change_percent)}`}>
              <TrendingUp size={16} />
              {formatPercent(selectedPair?.price_change_percent)}
            </div>
          </div>
          <TradingViewWidget key={selectedSymbol} symbol={selectedSymbol} />
        </div>
      </section>

      <section className="lower-grid">
        <div className="panel saved-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Saved data</p>
              <h2>Timestamp matrix</h2>
            </div>
            <button onClick={loadHistory} type="button">
              <BarChart3 size={17} />
              Read Saved Data
            </button>
          </div>

          <div className="snapshot-strip">
            {snapshots.slice(0, 5).map((snapshot) => (
              <button key={snapshot.id} type="button">
                {formatTime(snapshot.captured_at)}
                <span>{snapshot.pair_count} pairs</span>
              </button>
            ))}
          </div>

          <div className="table-wrap matrix-table">
            <table>
              <thead>
                <tr>
                  <th>Pair</th>
                  {(matrix?.timestamps ?? []).map((timestamp) => (
                    <th key={timestamp}>{formatTime(timestamp)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleMatrixRows.map((row: MatrixRow) => (
                  <tr key={row.symbol} onClick={() => openPair(row.symbol)}>
                    <td>
                      <strong>{row.base_asset}</strong>
                      <span>/{row.quote_asset}</span>
                    </td>
                    {(matrix?.timestamps ?? []).map((timestamp) => {
                      const cell = row.cells[timestamp];
                      return (
                        <td className={changeClass(cell?.price_change_percent)} key={timestamp}>
                          {cell ? formatPercent(cell.price_change_percent) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {visibleMatrixRows.length === 0 && (
                  <tr>
                    <td colSpan={(matrix?.timestamps.length ?? 0) + 1}>No saved data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel analyze-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Analyze</p>
              <h2>Change percent</h2>
            </div>
            <button onClick={runAnalyze} type="button">
              <Sparkles size={17} />
              Analyze
            </button>
          </div>

          <div className="analysis-controls">
            <label className="threshold-control">
              <span>Recommend &gt;=</span>
              <input
                type="number"
                min="0"
                step="1"
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
              />
              <strong>%</strong>
            </label>
            <label className="threshold-control">
              <span>Count target</span>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={targetRatio}
                onChange={(event) => setTargetRatio(Number(event.target.value))}
              />
              <strong>%</strong>
            </label>
          </div>

          {analysis && (
            <div className="analysis-summary">
              <span>
                Recommended <strong>{analysis.count}</strong> / {analysis.total_pairs}
              </span>
              <span>{formatPlainPercent(analysis.qualified_ratio)} meet the threshold</span>
              <span>
                {formatPlainPercent(analysis.target_ratio)} count cutoff:{" "}
                <strong>{formatPercent(analysis.target_threshold)}</strong>
              </span>
            </div>
          )}

          <div className="recommendation-list">
            {(analysis?.recommendations ?? []).map((pair) => (
              <button key={pair.symbol} onClick={() => openPair(pair.symbol)} type="button">
                <span>
                  <strong>{pair.base_asset}</strong>/{pair.quote_asset}
                </span>
                <span className={changeClass(pair.price_change_percent)}>
                  {formatPercent(pair.price_change_percent)}
                </span>
                <small>
                  Delta {pair.change_percent_delta ? formatPercent(pair.change_percent_delta) : "-"}
                </small>
              </button>
            ))}
            {analysis && analysis.recommendations.length === 0 && (
              <div className="empty-state">No saved pair is at or above {threshold}%.</div>
            )}
            {!analysis && <div className="empty-state">Run analyze after saving at least one snapshot.</div>}
          </div>
        </div>
      </section>
    </main>
  );
}
