import { Eye, EyeOff, TrendingUp } from "lucide-react";

import { TradingViewWidget } from "@/components/TradingViewWidget";
import { Pair } from "@/lib/api";
import { changeClass, formatPercent } from "@/lib/format";

type ChartPanelProps = {
  selectedPair?: Pair;
  selectedSymbol: string;
  isEnabled: boolean;
  onToggleEnabled: () => void;
  onEnable: () => void;
};

export function ChartPanel({
  selectedPair,
  selectedSymbol,
  isEnabled,
  onToggleEnabled,
  onEnable
}: ChartPanelProps) {
  return (
    <div className="panel chart-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">TradingView</p>
          <h2>{selectedPair ? `${selectedPair.base_asset}/${selectedPair.quote_asset}` : selectedSymbol}</h2>
        </div>
        <div className="chart-actions">
          <div className={`change-pill ${changeClass(selectedPair?.price_change_percent)}`}>
            <TrendingUp size={16} />
            {formatPercent(selectedPair?.price_change_percent)}
          </div>
          <button className="compact-button" onClick={onToggleEnabled} type="button">
            {isEnabled ? <EyeOff size={16} /> : <Eye size={16} />}
            {isEnabled ? "Unread" : "Read"}
          </button>
        </div>
      </div>
      {isEnabled ? (
        <TradingViewWidget key={selectedSymbol} symbol={selectedSymbol} />
      ) : (
        <div className="chart-placeholder">
          <EyeOff size={24} />
          <strong>TradingView unread</strong>
          <span>Load the chart only when you need it.</span>
          <button onClick={onEnable} type="button">
            <Eye size={16} />
            Read Chart
          </button>
        </div>
      )}
    </div>
  );
}

