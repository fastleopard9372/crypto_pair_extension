import { Loader2 } from "lucide-react";

export function LoadingSpinner({ label }: { label: string }) {
  return (
    <span className="loading-inline">
      <Loader2 className="spin-icon" size={16} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

