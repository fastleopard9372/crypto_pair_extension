import { Loader2, Save, Star } from "lucide-react";

import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Pair } from "@/lib/api";
import { changeClass, formatPercent, formatPrice, formatSubPrice, formatVolume } from "@/lib/format";

export type MarketSortMode = "change" | "volume" | "price";

type MarketPanelProps = {
  kind: string;
  pairs: Pair[];
  selectedSymbol: string;
  favoriteSymbols: Set<string>;
  sortMode: MarketSortMode;
  isLoading: boolean;
  isSaving: boolean;
  onSortModeChange: (mode: MarketSortMode) => void;
  onSave: () => void;
  onSelect: (symbol: string) => void;
  onToggleFavorite: (pair: Pair) => void;
};

export function MarketPanel({
  kind,
  pairs,
  selectedSymbol,
  favoriteSymbols,
  sortMode,
  isLoading,
  isSaving,
  onSortModeChange,
  onSave,
  onSelect,
  onToggleFavorite
}: MarketPanelProps) {
  return (
    <div className="panel pair-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Live market</p>
          <h2>{kind} pairs</h2>
        </div>
        <button onClick={onSave} disabled={isSaving} type="button">
          {isSaving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
          {isSaving ? "Saving" : "Save Snapshot"}
        </button>
      </div>

      <div className="sort-tabs" aria-label="Sort live pairs">
        <button
          className={sortMode === "change" ? "active" : ""}
          onClick={() => onSortModeChange("change")}
          type="button"
        >
          Change
        </button>
        <button
          className={sortMode === "volume" ? "active" : ""}
          onClick={() => onSortModeChange("volume")}
          type="button"
        >
          Volume
        </button>
        <button
          className={sortMode === "price" ? "active" : ""}
          onClick={() => onSortModeChange("price")}
          type="button"
        >
          Price
        </button>
      </div>

      <div className="live-list" role="list" aria-label={`${kind} live pairs`}>
        {isLoading && pairs.length === 0 && (
          <div className="loading-state">
            <LoadingSpinner label="Loading live pairs" />
          </div>
        )}
        {isLoading && pairs.length > 0 && (
          <div className="loading-strip">
            <LoadingSpinner label="Refreshing" />
          </div>
        )}
        {pairs.map((pair) => {
          const isFavorite = favoriteSymbols.has(pair.symbol);
          return (
            <div
              className={`pair-row ${pair.symbol === selectedSymbol ? "selected" : ""}`}
              key={pair.symbol}
              onClick={() => onSelect(pair.symbol)}
              role="listitem"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(pair.symbol);
                }
              }}
            >
              <span className="pair-avatar" aria-hidden="true">
                {pair.base_asset.slice(0, 1)}
              </span>
              <span className="pair-name">
                <strong>
                  {pair.base_asset}/{pair.quote_asset}
                </strong>
                <small>{pair.base_asset}</small>
              </span>
              <span className="pair-price">
                <strong>{formatPrice(pair.last_price)}</strong>
                <small>{formatSubPrice(pair.last_price)}</small>
              </span>
              <span className="pair-change">
                <strong className={changeClass(pair.price_change_percent)}>
                  {formatPercent(pair.price_change_percent)}
                </strong>
                <small>{formatVolume(pair.volume)}</small>
              </span>
              <button
                className={`pair-star-button ${isFavorite ? "active" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavorite(pair);
                }}
                type="button"
                title={isFavorite ? "Remove favorite" : "Add favorite"}
              >
                <Star size={15} strokeWidth={1.8} fill={isFavorite ? "currentColor" : "none"} />
              </button>
            </div>
          );
        })}
        {!isLoading && pairs.length === 0 && <div className="empty-state">No pairs found.</div>}
      </div>
    </div>
  );
}
