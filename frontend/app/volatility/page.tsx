"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { scanCoinMarketCapVolatility, VolatilityScan } from "@/lib/api";
import {
  changeClass,
  formatPercent,
  formatPlainPercent,
  formatPrice,
  formatTime,
  formatVolume,
  toNumber
} from "@/lib/format";

type WindowDays = 1 | 2;

export default function VolatilityPage() {
  const [thresholdPercent, setThresholdPercent] = useState(10);
  const [minProbabilityPercent, setMinProbabilityPercent] = useState(40);
  const [windowDays, setWindowDays] = useState<WindowDays>(1);
  const [lookbackDays, setLookbackDays] = useState(30);
  const [minAgeMonths, setMinAgeMonths] = useState(3);
  const [limit, setLimit] = useState(200);
  const [quote, setQuote] = useState("USD");
  const [query, setQuery] = useState("");
  const [scan, setScan] = useState<VolatilityScan | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filteredTokens = useMemo(() => {
    const needle = query.trim().toUpperCase();
    const tokens = scan?.tokens ?? [];
    return needle
      ? tokens.filter(
          (token) =>
            token.symbol.includes(needle) ||
            token.name.toUpperCase().includes(needle) ||
            token.slug.toUpperCase().includes(needle)
        )
      : tokens;
  }, [query, scan]);

  async function runScan() {
    setIsScanning(true);
    try {
      const result = await scanCoinMarketCapVolatility({
        thresholdPercent,
        minProbabilityPercent,
        windowDays,
        lookbackDays,
        minAgeMonths,
        limit,
        quote: quote.trim().toUpperCase() || "USD"
      });
      setScan(result);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to scan CoinMarketCap");
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">CoinMarketCap</p>
          <h1>Volatility Screener</h1>
        </div>
        <div className="toolbar-actions">
          <Link className="nav-link" href="/">
            <ArrowLeft size={17} />
            Dashboard
          </Link>
          <button onClick={runScan} disabled={isScanning} type="button">
            {isScanning ? <Loader2 className="spin-icon" size={17} /> : <BarChart3 size={17} />}
            {isScanning ? "Scanning" : "Scan"}
          </button>
        </div>
      </section>

      <section className="status-row volatility-status-row">
        <div className="stat">
          <BarChart3 size={17} />
          <span>{scan ? `${scan.count} matches` : "Ready"}</span>
        </div>
        <div className="stat">
          <span>{scan ? `${scan.candidate_count} age-filtered / ${scan.checked_count} checked` : "CMC"}</span>
        </div>
        <label className="search-box">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search token"
          />
        </label>
      </section>

      {message && <div className="notice">{message}</div>}

      <section className="volatility-grid">
        <div className="panel volatility-controls-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Filters</p>
              <h2>Price movement</h2>
            </div>
          </div>
          <div className="volatility-controls">
            <label className="threshold-control">
              <span>Move abs &gt;=</span>
              <input
                type="number"
                min="0"
                step="1"
                value={thresholdPercent}
                onChange={(event) => setThresholdPercent(Number(event.target.value))}
              />
              <strong>%</strong>
            </label>
            <label className="threshold-control">
              <span>Probability &gt;=</span>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={minProbabilityPercent}
                onChange={(event) => setMinProbabilityPercent(Number(event.target.value))}
              />
              <strong>%</strong>
            </label>
            <label className="threshold-control">
              <span>Window</span>
              <select value={windowDays} onChange={(event) => setWindowDays(Number(event.target.value) as WindowDays)}>
                <option value={1}>1 day</option>
                <option value={2}>2 days</option>
              </select>
              <strong />
            </label>
            <label className="threshold-control">
              <span>Lookback</span>
              <input
                type="number"
                min="7"
                max="60"
                step="1"
                value={lookbackDays}
                onChange={(event) => setLookbackDays(Number(event.target.value))}
              />
              <strong>d</strong>
            </label>
            <label className="threshold-control">
              <span>Birth age &gt;=</span>
              <input
                type="number"
                min="0"
                step="1"
                value={minAgeMonths}
                onChange={(event) => setMinAgeMonths(Number(event.target.value))}
              />
              <strong>m</strong>
            </label>
            <label className="threshold-control">
              <span>Listings</span>
              <input
                type="number"
                min="1"
                max="1000"
                step="50"
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
              />
              <strong />
            </label>
            <label className="threshold-control">
              <span>Quote</span>
              <input value={quote} onChange={(event) => setQuote(event.target.value.toUpperCase())} />
              <strong />
            </label>
          </div>
        </div>

        <div className="panel volatility-results-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Results</p>
              <h2>{scan ? `${scan.window_days}-day probability` : "No scan yet"}</h2>
            </div>
            {scan && (
              <span className="change-pill">
                {formatPlainPercent(scan.threshold_percent)} / {formatPlainPercent(scan.min_probability_percent)}
              </span>
            )}
          </div>

          <div className="table-wrap volatility-table">
            <table>
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Prob</th>
                  <th>Hits</th>
                  <th>Max move</th>
                  <th>Price</th>
                  <th>24h</th>
                  <th>Volume</th>
                  <th>Age</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {filteredTokens.map((token) => (
                  <tr key={token.id}>
                    <td>
                      <strong>{token.symbol}</strong>
                      <span> {token.name}</span>
                    </td>
                    <td>{formatPlainPercent(token.probability_percent)}</td>
                    <td>
                      {token.hit_count}/{token.period_count}
                    </td>
                    <td>{formatPlainPercent(token.max_abs_change_percent)}</td>
                    <td>{formatPrice(token.price)}</td>
                    <td className={changeClass(token.percent_change_24h)}>
                      {formatPercent(token.percent_change_24h)}
                    </td>
                    <td>{formatVolume(token.volume_24h)}</td>
                    <td>{formatAge(token.age_months)}</td>
                    <td>{token.date_added ? formatTime(token.date_added) : "-"}</td>
                  </tr>
                ))}
                {scan && filteredTokens.length === 0 && (
                  <tr>
                    <td colSpan={9}>No token matches these filters.</td>
                  </tr>
                )}
                {!scan && (
                  <tr>
                    <td colSpan={9}>Run a scan to load CoinMarketCap volatility results.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function formatAge(value: string | null) {
  const parsed = toNumber(value);
  if (parsed === null) return "-";
  return `${parsed.toFixed(1)}m`;
}
