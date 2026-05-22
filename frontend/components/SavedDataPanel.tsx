import { BarChart3, Loader2, Trash2 } from "lucide-react";

import { LoadingSpinner } from "@/components/LoadingSpinner";
import { MatrixRow, SnapshotMatrix, SnapshotMeta } from "@/lib/api";
import { changeClass, formatPercent, formatTime } from "@/lib/format";

type SavedDataPanelProps = {
  snapshots: SnapshotMeta[];
  matrix: SnapshotMatrix | null;
  rows: MatrixRow[];
  isLoading: boolean;
  isDeleting: boolean;
  selectedSnapshotId: number | null;
  onLoad: () => void;
  onDeleteSnapshot: () => void;
  onSelect: (symbol: string) => void;
  onSelectSnapshot: (snapshotId: number) => void;
};

export function SavedDataPanel({
  snapshots,
  matrix,
  rows,
  isLoading,
  isDeleting,
  selectedSnapshotId,
  onLoad,
  onDeleteSnapshot,
  onSelect,
  onSelectSnapshot
}: SavedDataPanelProps) {
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
          <p className="eyebrow">Saved data</p>
          <h2>Timestamp matrix</h2>
        </div>
        <button onClick={onLoad} disabled={isLoading} type="button">
          {isLoading ? <Loader2 className="spin-icon" size={17} /> : <BarChart3 size={17} />}
          {isLoading ? "Reading" : "Read Saved Data"}
        </button>
      </div>

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
            {rows.map((row) => (
              <tr key={row.symbol} onClick={() => onSelect(row.symbol)}>
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={(matrix?.timestamps.length ?? 0) + 1}>No saved data yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
