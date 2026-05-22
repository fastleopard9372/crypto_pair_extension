"use client";

import { Activity, Clock3, Database, Loader2, RefreshCcw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AnalyzePanel } from "@/components/AnalyzePanel";
import { ChartPanel } from "@/components/ChartPanel";
import { MarketPanel, MarketSortMode } from "@/components/MarketPanel";
import { SavedDataPanel } from "@/components/SavedDataPanel";
import {
  AnalyzeResult,
  FavoritePair,
  Pair,
  SnapshotMatrix,
  SnapshotMeta,
  addFavorite,
  analyze,
  getFavorites,
  getKinds,
  getLivePairs,
  getMatrix,
  getSnapshots,
  removeFavorite,
  removeSnapshot,
  saveSnapshot
} from "@/lib/api";
import { formatTime, toNumber } from "@/lib/format";

export default function Home() {
  const [kinds, setKinds] = useState<string[]>(["USDT", "USDC", "BTC", "ETH"]);
  const [kind, setKind] = useState("USDT");
  const [livePairs, setLivePairs] = useState<Pair[]>([]);
  const [favorites, setFavorites] = useState<FavoritePair[]>([]);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [matrix, setMatrix] = useState<SnapshotMatrix | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [marketSortMode, setMarketSortMode] = useState<MarketSortMode>("change");
  const [threshold, setThreshold] = useState(10);
  const [targetRatio, setTargetRatio] = useState(80);
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingSnapshot, setIsDeletingSnapshot] = useState(false);
  const [isChartEnabled, setIsChartEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPair = useMemo(
    () => livePairs.find((pair) => pair.symbol === selectedSymbol),
    [livePairs, selectedSymbol]
  );

  const favoriteSymbols = useMemo(
    () => new Set(favorites.map((favorite) => favorite.symbol)),
    [favorites]
  );

  const filteredLivePairs = useMemo(() => {
    const needle = query.trim().toUpperCase();
    const pairs = needle
      ? livePairs.filter(
          (pair) =>
            pair.symbol.includes(needle) ||
            pair.base_asset.includes(needle) ||
            pair.quote_asset.includes(needle)
        )
      : livePairs;

    return [...pairs].sort((left, right) => {
      const leftFavorite = favoriteSymbols.has(left.symbol) ? 1 : 0;
      const rightFavorite = favoriteSymbols.has(right.symbol) ? 1 : 0;
      const favoriteDelta = rightFavorite - leftFavorite;
      if (favoriteDelta !== 0) return favoriteDelta;

      const metric = {
        change: "price_change_percent",
        volume: "volume",
        price: "last_price"
      }[marketSortMode] as keyof Pick<Pair, "price_change_percent" | "volume" | "last_price">;

      return (toNumber(right[metric]) ?? -Infinity) - (toNumber(left[metric]) ?? -Infinity);
    });
  }, [favoriteSymbols, livePairs, marketSortMode, query]);

  const visibleMatrixRows = useMemo(() => {
    const rows = matrix?.rows ?? [];
    const needle = query.trim().toUpperCase();
    return needle ? rows.filter((row) => row.symbol.includes(needle)) : rows;
  }, [matrix, query]);

  const loadFavorites = useCallback(async () => {
    setIsLoadingFavorites(true);
    try {
      setFavorites(await getFavorites(kind));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to read favorite pairs");
    } finally {
      setIsLoadingFavorites(false);
    }
  }, [kind]);

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
    setIsLoadingHistory(true);
    try {
      const [snapshotRows, matrixRows] = await Promise.all([getSnapshots(kind), getMatrix(kind)]);
      setSnapshots(snapshotRows);
      setMatrix(matrixRows);
      setSelectedSnapshotId((current) =>
        current && snapshotRows.some((snapshot) => snapshot.id === current)
          ? current
          : (snapshotRows[0]?.id ?? null)
      );
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to read saved data");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [kind]);

  const runAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyze(kind, threshold, targetRatio);
      setAnalysis(result);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to analyze snapshots");
    } finally {
      setIsAnalyzing(false);
    }
  }, [kind, targetRatio, threshold]);

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
    loadFavorites();
    setAnalysis(null);
  }, [loadFavorites, loadHistory]);

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

  async function handleDeleteSnapshot() {
    if (!selectedSnapshotId) return;
    const selectedSnapshot = snapshots.find((snapshot) => snapshot.id === selectedSnapshotId);
    const selectedTime = selectedSnapshot ? formatTime(selectedSnapshot.captured_at) : "this timestamp";
    if (!window.confirm(`Remove saved data from ${selectedTime} from the database?`)) return;

    setIsDeletingSnapshot(true);
    try {
      const deleted = await removeSnapshot(selectedSnapshotId, kind);
      if (deleted.deleted) {
        const removedTime = deleted.captured_at ? formatTime(deleted.captured_at) : selectedTime;
        setMessage(`Removed ${deleted.pair_count} saved pairs from ${removedTime}`);
      } else {
        setMessage("That saved timestamp was already removed");
      }
      setAnalysis(null);
      await loadHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove saved timestamp");
    } finally {
      setIsDeletingSnapshot(false);
    }
  }

  async function handleToggleFavorite(pair: Pair) {
    const wasFavorite = favoriteSymbols.has(pair.symbol);
    setFavorites((current) =>
      wasFavorite
        ? current.filter((favorite) => favorite.symbol !== pair.symbol)
        : [
            {
              id: -Date.now(),
              kind,
              symbol: pair.symbol,
              base_asset: pair.base_asset,
              quote_asset: pair.quote_asset,
              created_at: new Date().toISOString()
            },
            ...current
          ]
    );

    try {
      if (wasFavorite) {
        await removeFavorite(pair.symbol, kind);
      } else {
        await addFavorite(pair, kind);
      }
      await loadFavorites();
    } catch (error) {
      await loadFavorites();
      setMessage(error instanceof Error ? error.message : "Failed to update favorite pair");
    }
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
            {kinds.map((item) => (
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
            {isLoadingLive ? <Loader2 className="spin-icon" size={17} /> : <RefreshCcw size={17} />}
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
          <span>
            {snapshots.length} saved snapshots / {favorites.length} favorites
            {isLoadingFavorites ? "..." : ""}
          </span>
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
        <MarketPanel
          kind={kind}
          pairs={filteredLivePairs}
          selectedSymbol={selectedSymbol}
          favoriteSymbols={favoriteSymbols}
          sortMode={marketSortMode}
          isLoading={isLoadingLive}
          isSaving={isSaving}
          onSortModeChange={setMarketSortMode}
          onSave={handleSave}
          onSelect={setSelectedSymbol}
          onToggleFavorite={handleToggleFavorite}
        />
        <ChartPanel
          selectedPair={selectedPair}
          selectedSymbol={selectedSymbol}
          isEnabled={isChartEnabled}
          onToggleEnabled={() => setIsChartEnabled((value) => !value)}
          onEnable={() => setIsChartEnabled(true)}
        />
      </section>

      <section className="lower-grid">
        <SavedDataPanel
          snapshots={snapshots}
          matrix={matrix}
          rows={visibleMatrixRows}
          isLoading={isLoadingHistory}
          isDeleting={isDeletingSnapshot}
          selectedSnapshotId={selectedSnapshotId}
          onLoad={loadHistory}
          onDeleteSnapshot={handleDeleteSnapshot}
          onSelect={setSelectedSymbol}
          onSelectSnapshot={setSelectedSnapshotId}
        />
        <AnalyzePanel
          analysis={analysis}
          threshold={threshold}
          targetRatio={targetRatio}
          isAnalyzing={isAnalyzing}
          onThresholdChange={setThreshold}
          onTargetRatioChange={setTargetRatio}
          onAnalyze={runAnalyze}
          onSelect={setSelectedSymbol}
        />
      </section>
    </main>
  );
}
