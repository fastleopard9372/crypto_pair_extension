import { Loader2, Sparkles } from "lucide-react";

import { LoadingSpinner } from "@/components/LoadingSpinner";
import { AnalyzeResult } from "@/lib/api";
import { changeClass, formatPercent, formatPlainPercent } from "@/lib/format";

type AnalyzePanelProps = {
  analysis: AnalyzeResult | null;
  threshold: number;
  targetRatio: number;
  isAnalyzing: boolean;
  onThresholdChange: (value: number) => void;
  onTargetRatioChange: (value: number) => void;
  onAnalyze: () => void;
  onSelect: (symbol: string) => void;
};

export function AnalyzePanel({
  analysis,
  threshold,
  targetRatio,
  isAnalyzing,
  onThresholdChange,
  onTargetRatioChange,
  onAnalyze,
  onSelect
}: AnalyzePanelProps) {
  return (
    <div className="panel analyze-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Analyze</p>
          <h2>Change percent</h2>
        </div>
        <button onClick={onAnalyze} disabled={isAnalyzing} type="button">
          {isAnalyzing ? <Loader2 className="spin-icon" size={17} /> : <Sparkles size={17} />}
          {isAnalyzing ? "Analyzing" : "Analyze"}
        </button>
      </div>

      <div className="analysis-controls">
        <label className="threshold-control">
          <span>Recommend abs &gt;=</span>
          <input
            type="number"
            min="0"
            step="1"
            value={threshold}
            onChange={(event) => onThresholdChange(Number(event.target.value))}
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
            onChange={(event) => onTargetRatioChange(Number(event.target.value))}
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
            <strong>{formatPlainPercent(analysis.target_threshold)}</strong>
          </span>
        </div>
      )}

      <div className="recommendation-list">
        {isAnalyzing && (
          <div className="loading-strip">
            <LoadingSpinner label="Analyzing snapshots" />
          </div>
        )}
        {(analysis?.recommendations ?? []).map((pair) => (
          <button key={pair.symbol} onClick={() => onSelect(pair.symbol)} type="button">
            <span>
              <strong>{pair.base_asset}</strong>/{pair.quote_asset}
            </span>
            <span className={changeClass(pair.price_change_percent)}>
              {formatPercent(pair.price_change_percent)}
            </span>
            <small>Delta {pair.change_percent_delta ? formatPercent(pair.change_percent_delta) : "-"}</small>
          </button>
        ))}
        {analysis && analysis.recommendations.length === 0 && (
          <div className="empty-state">No saved pair has absolute change at or above {threshold}%.</div>
        )}
        {!analysis && <div className="empty-state">Run analyze after saving at least one snapshot.</div>}
      </div>
    </div>
  );
}
