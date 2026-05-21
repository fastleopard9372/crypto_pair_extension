"use client";

import { useEffect, useMemo } from "react";

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
  const containerId = useMemo(
    () => `tradingview-${symbol.toLowerCase()}-${Math.random().toString(36).slice(2)}`,
    [symbol]
  );
  const tradingViewSymbol = `MEXC:${symbol}`;

  useEffect(() => {
    const createWidget = () => {
      if (!window.TradingView) return;
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
    };

    const existing = document.getElementById("tradingview-widget-script");
    if (existing) {
      createWidget();
      return;
    }

    const script = document.createElement("script");
    script.id = "tradingview-widget-script";
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = createWidget;
    document.body.appendChild(script);
  }, [containerId, tradingViewSymbol]);

  return <div id={containerId} className="tradingview-container" />;
}

