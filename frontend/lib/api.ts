export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type Pair = {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  last_price: string | null;
  price_change: string | null;
  price_change_percent: string | null;
  high_price: string | null;
  low_price: string | null;
  volume: string | null;
  quote_volume: string | null;
};

export type LivePairs = {
  kind: string;
  source: string;
  read_at: string;
  count: number;
  pairs: Pair[];
};

export type SnapshotMeta = {
  id: number;
  kind: string;
  source: string;
  captured_at: string;
  pair_count: number;
};

export type SnapshotDeleted = {
  deleted: boolean;
  id: number;
  captured_at: string | null;
  pair_count: number;
};

export type MatrixCell = {
  snapshot_id: number;
  captured_at: string;
  last_price: string | null;
  price_change_percent: string | null;
  volume: string | null;
};

export type MatrixRow = {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  cells: Record<string, MatrixCell>;
};

export type SnapshotMatrix = {
  kind: string;
  metric: "price" | "change_percent" | "volume";
  timestamps: string[];
  rows: MatrixRow[];
};

export type Recommendation = Pair & {
  snapshot_id: number;
  captured_at: string;
  previous_change_percent: string | null;
  change_percent_delta: string | null;
};

export type AnalyzeResult = {
  kind: string;
  threshold: string;
  target_ratio: string;
  target_threshold: string | null;
  snapshot_id: number | null;
  captured_at: string | null;
  total_pairs: number;
  count: number;
  qualified_ratio: string;
  recommendations: Recommendation[];
};

export type FavoritePair = {
  id: number;
  kind: string;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  created_at: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getKinds() {
  return request<{ kinds: string[] }>("/api/kinds");
}

export function getFavorites(kind: string) {
  return request<FavoritePair[]>(`/api/favorites?kind=${encodeURIComponent(kind)}`);
}

export function addFavorite(pair: Pair, kind: string) {
  return request<FavoritePair>("/api/favorites", {
    method: "POST",
    body: JSON.stringify({
      kind,
      symbol: pair.symbol,
      base_asset: pair.base_asset,
      quote_asset: pair.quote_asset
    })
  });
}

export function removeFavorite(symbol: string, kind: string) {
  return request<{ deleted: boolean }>(
    `/api/favorites/${encodeURIComponent(symbol)}?kind=${encodeURIComponent(kind)}`,
    { method: "DELETE" }
  );
}

export function getLivePairs(kind: string) {
  return request<LivePairs>(`/api/pairs/live?kind=${encodeURIComponent(kind)}&limit=5000`);
}

export function saveSnapshot(kind: string) {
  return request<SnapshotMeta>("/api/snapshots", {
    method: "POST",
    body: JSON.stringify({ kind })
  });
}

export function getSnapshots(kind: string) {
  return request<SnapshotMeta[]>(`/api/snapshots?kind=${encodeURIComponent(kind)}&limit=100`);
}

export function removeSnapshot(snapshotId: number, kind: string) {
  return request<SnapshotDeleted>(
    `/api/snapshots/${snapshotId}?kind=${encodeURIComponent(kind)}`,
    { method: "DELETE" }
  );
}

export function getMatrix(kind: string) {
  return request<SnapshotMatrix>(
    `/api/snapshots/matrix?kind=${encodeURIComponent(kind)}&limit=24&metric=change_percent`
  );
}

export function analyze(kind: string, threshold: number, targetRatio: number) {
  return request<AnalyzeResult>(
    `/api/analyze?kind=${encodeURIComponent(kind)}&threshold=${threshold}&target_ratio=${targetRatio}`
  );
}
