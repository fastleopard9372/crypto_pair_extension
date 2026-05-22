export function toNumber(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatPercent(value: string | null | undefined) {
  const parsed = toNumber(value);
  if (parsed === null) return "-";
  return `${parsed > 0 ? "+" : ""}${parsed.toFixed(2)}%`;
}

export function formatPlainPercent(value: string | null | undefined) {
  const parsed = toNumber(value);
  if (parsed === null) return "-";
  return `${parsed.toFixed(2)}%`;
}

export function formatPrice(value: string | null | undefined) {
  const parsed = toNumber(value);
  if (parsed === null) return "-";
  if (parsed >= 1) return parsed.toLocaleString(undefined, { maximumFractionDigits: 6 });
  return parsed.toPrecision(6);
}

export function formatSubPrice(value: string | null | undefined) {
  const parsed = toNumber(value);
  if (parsed === null) return "-";
  if (parsed >= 1) {
    return `$ ${parsed.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  }
  return `$ ${parsed.toPrecision(4)}`;
}

export function formatVolume(value: string | null | undefined) {
  const parsed = toNumber(value);
  if (parsed === null) return "-";
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(parsed);
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function changeClass(value: string | null | undefined) {
  const parsed = toNumber(value);
  if (parsed === null) return "neutral";
  if (parsed > 0) return "positive";
  if (parsed < 0) return "negative";
  return "neutral";
}
