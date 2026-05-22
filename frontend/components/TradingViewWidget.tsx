"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => unknown;
    };
  }
}

type TradingViewWidgetProps = {
  symbol: string;
};

export function TradingViewWidget({ symbol }: TradingViewWidgetProps) {
  const [isLoading, setIsLoading] = useState(true);
  const containerId = `tradingview-${symbol.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
  const tradingViewSymbol = `MEXC:${symbol}`;

  useEffect(() => {
    let isCancelled = false;
    let settleTimer: number | undefined;
    const container = document.getElementById(containerId);
    setIsLoading(true);
    if (container) {
      container.replaceChildren();
    }

    const createWidget = () => {
      if (isCancelled || !window.TradingView) return;
      new window.TradingView.widget({
        autosize: true,
        symbol: tradingViewSymbol,
        interval: "60",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#0f141f",
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: true,
        container_id: containerId
      });
      settleTimer = window.setTimeout(() => {
        if (!isCancelled) setIsLoading(false);
      }, 700);
    };

    const existing = document.getElementById("tradingview-widget-script");
    if (window.TradingView) {
      createWidget();
    } else if (existing) {
      existing.addEventListener("load", createWidget, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = "tradingview-widget-script";
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = createWidget;
      script.onerror = () => setIsLoading(false);
      document.body.appendChild(script);
    }

    return () => {
      isCancelled = true;
      if (settleTimer) window.clearTimeout(settleTimer);
      existing?.removeEventListener("load", createWidget);
      document.getElementById(containerId)?.replaceChildren();
    };
  }, [containerId, tradingViewSymbol]);

  return (
    <div className="tradingview-shell">
      <div id={containerId} className="tradingview-container" />
      {isLoading && (
        <div className="chart-loading">
          <span className="spinner" aria-hidden="true" />
          <span>Loading TradingView</span>
        </div>
      )}
    </div>
  );
}
