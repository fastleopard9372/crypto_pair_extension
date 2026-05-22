import { BarChart3, Loader2, Star, Trash2, X } from "lucide-react";
import { useState } from "react";

import { LoadingSpinner } from "@/components/LoadingSpinner";
import { FavoritePair, MatrixRow, Pair, SnapshotMatrix, SnapshotMeta } from "@/lib/api";
import { changeClass, formatPercent, formatPrice, formatTime, formatVolume } from "@/lib/format";

type DataTab = "saved" | "favorites";

type SavedDataPanelProps = {
  snapshots: SnapshotMeta[];
  matrix: SnapshotMatrix | null;
  rows: MatrixRow[];
  favorites: FavoritePair[];
  favoriteCount: number;
  favoriteSymbols: Set<string>;
  livePairBySymbol: Map<string, Pair>;
  isLoading: boolean;
  isLoadingFavorites: boolean;
  isDeleting: boolean;
  selectedSnapshotId: number | null;
  onLoad: () => void;
  onLoadFavorites: () => void;
  onDeleteSnapshot: () => void;
  onSelect: (symbol: string) => void;
  onSelectSnapshot: (snapshotId: number) => void;
  onToggleMatrixFavorite: (row: MatrixRow) => void;
  onRemoveFavorite: (favorite: FavoritePair) => void;
};

export function SavedDataPanel({
  snapshots,
  matrix,
  rows,
  favorites,
  favoriteCount,
  favoriteSymbols,
  livePairBySymbol,
  isLoading,
  isLoadingFavorites,
  isDeleting,
  selectedSnapshotId,
  onLoad,
  onLoadFavorites,
  onDeleteSnapshot,
  onSelect,
  onSelectSnapshot,
  onToggleMatrixFavorite,
  onRemoveFavorite
}: SavedDataPanelProps) {
  const [activeTab, setActiveTab] = useState<DataTab>("saved");
  const snapshotsByTime = new Map(
    snapshots.map((snapshot) => [new Date(snapshot.captured_at).getTime(), snapshot.id])
  );
  const timestampSnapshotIds = new Map(
    matrix?.timestamps.map((timestamp) => {
      const cell = matrix.rows.find((row) => row.cells[timestamp])?.cells[timestamp];
      return [
        timestamp,
        snapshotsByTime.get(new Date(timestamp).getTime()) ?? cell?.snapshot_id ?? null
      ];
    }) ?? []
  );

  return (
    <div className="panel saved-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{activeTab === "saved" ? "Saved data" : "Favorite pairs"}</p>
          <h2>{activeTab === "saved" ? "Timestamp matrix" : "Favorites"}</h2>
        </div>
        <button
          onClick={activeTab === "saved" ? onLoad : onLoadFavorites}
          disabled={activeTab === "saved" ? isLoading : isLoadingFavorites}
          type="button"
        >
          {activeTab === "saved" ? (
            isLoading ? (
              <Loader2 className="spin-icon" size={17} />
            ) : (
              <BarChart3 size={17} />
            )
          ) : isLoadingFavorites ? (
            <Loader2 className="spin-icon" size={17} />
          ) : (
            <Star size={17} />
          )}
          {activeTab === "saved"
            ? isLoading
              ? "Reading"
              : "Read Saved Data"
            : isLoadingFavorites
              ? "Reading"
              : "Read Favorites"}
        </button>
      </div>

      <div className="data-tabs" aria-label="Saved data views">
        <button
          className={activeTab === "saved" ? "active" : ""}
          onClick={() => setActiveTab("saved")}
          type="button"
        >
          <BarChart3 size={16} />
          Saved
        </button>
        <button
          className={activeTab === "favorites" ? "active" : ""}
          onClick={() => setActiveTab("favorites")}
          type="button"
        >
          <Star size={16} fill={activeTab === "favorites" ? "currentColor" : "none"} />
          Favorites
          <span>{favoriteCount}</span>
        </button>
      </div>

      {activeTab === "saved" ? (
        <>
          <div className="snapshot-strip">
            {snapshots.map((snapshot) => (
              <button
                className={snapshot.id === selectedSnapshotId ? "selected" : ""}
                key={snapshot.id}
                onClick={() => onSelectSnapshot(snapshot.id)}
                type="button"
              >
                {formatTime(snapshot.captured_at)}
                <span>{snapshot.pair_count} pairs</span>
              </button>
            ))}
            {snapshots.length > 0 && (
              <button
                className="delete-snapshot-button"
                disabled={!selectedSnapshotId || isDeleting || isLoading}
                onClick={onDeleteSnapshot}
                title="Remove selected timestamp from database"
                type="button"
              >
                {isDeleting ? <Loader2 className="spin-icon" size={16} /> : <Trash2 size={16} />}
                {isDeleting ? "Removing" : "Remove"}
              </button>
            )}
          </div>

          <div className="table-wrap matrix-table">
            {isLoading && (
              <div className="loading-strip">
                <LoadingSpinner label="Reading saved data" />
              </div>
            )}
            <table>
              <thead>
                <tr>
                  <th>Pair</th>
                  <th className="matrix-favorite-heading" aria-label="Favorite" />
                  {(matrix?.timestamps ?? []).map((timestamp) => {
                    const snapshotId = timestampSnapshotIds.get(timestamp);
                    return (
                      <th
                        className={snapshotId === selectedSnapshotId ? "selected-timestamp" : ""}
                        key={timestamp}
                      >
                        <button
                          disabled={!snapshotId}
                          onClick={() => snapshotId && onSelectSnapshot(snapshotId)}
                          type="button"
                        >
                          {formatTime(timestamp)}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isFavorite = favoriteSymbols.has(row.symbol);
                  return (
                    <tr key={row.symbol} onClick={() => onSelect(row.symbol)}>
                      <td>
                        <strong>{row.base_asset}</strong>
                        <span>/{row.quote_asset}</span>
                      </td>
                      <td className="matrix-favorite-cell">
                        <button
                          className={`pair-star-button ${isFavorite ? "active" : ""}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleMatrixFavorite(row);
                          }}
                          title={isFavorite ? "Remove favorite" : "Add favorite"}
                          type="button"
                        >
                          <Star
                            size={15}
                            strokeWidth={1.8}
                            fill={isFavorite ? "currentColor" : "none"}
                          />
                        </button>
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
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={(matrix?.timestamps.length ?? 0) + 2}>No saved data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="favorite-list" role="list" aria-label="Favorite pairs">
          {isLoadingFavorites && (
            <div className="loading-strip">
              <LoadingSpinner label="Reading favorites" />
            </div>
          )}
          {favorites.map((favorite) => {
            const livePair = livePairBySymbol.get(favorite.symbol);
            return (
              <div
                className="favorite-row"
                key={`${favorite.kind}-${favorite.symbol}`}
                onClick={() => onSelect(favorite.symbol)}
                role="listitem"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(favorite.symbol);
                  }
                }}
              >
                <span className="pair-avatar" aria-hidden="true">
                  {favorite.base_asset.slice(0, 1)}
                </span>
                <span className="pair-name">
                  <strong>
                    {favorite.base_asset}/{favorite.quote_asset}
                  </strong>
                  <small>Added {formatTime(favorite.created_at)}</small>
                </span>
                <span className="pair-price">
                  <strong>{livePair ? formatPrice(livePair.last_price) : "-"}</strong>
                  <small>{livePair ? formatVolume(livePair.volume) : favorite.symbol}</small>
                </span>
                <span className="pair-change">
                  <strong className={changeClass(livePair?.price_change_percent)}>
                    {livePair ? formatPercent(livePair.price_change_percent) : "-"}
                  </strong>
                  <small>{favorite.kind}</small>
                </span>
                <button
                  className="pair-star-button active"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveFavorite(favorite);
                  }}
                  title="Remove favorite"
                  type="button"
                >
                  <X size={15} strokeWidth={2} />
                </button>
              </div>
            );
          })}
          {!isLoadingFavorites && favorites?.length === 0 && (
            <div className="empty-state">No favorite pairs yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
