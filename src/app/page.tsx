"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDefaultAdapters } from "../lib/adapters";
import type { AdapterStatus, FundingDatum } from "../lib/adapters/types";

function msToPeriod(ms?: number | null): string {
  if (!ms || ms <= 0) return "-";
  const minutes = Math.round(ms / 60000);
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

function fmtPct(x: number, dp = 4): string {
  if (!isFinite(x)) return "-";
  return `${(x * 100).toFixed(dp)}%`;
}

function exchangeTradeUrl(exchange: string, symbol: string): string | null {
  switch (exchange) {
    case "EdgeX":
      return `https://pro.edgex.exchange/trade/${symbol}USD`;
    case "Lighter":
      return `https://app.lighter.xyz/trade/${symbol}`;
    case "Backpack":
      return `https://backpack.exchange/trade/${symbol}_USD_PERP`;
    case "ParaDex":
      return `https://app.paradex.trade/trade/${symbol}-USD-PERP`;
    default:
      return null;
  }
}

const MIN_ENABLED_ADAPTERS = 2;

export default function Home() {
  const adapters = useMemo(() => getDefaultAdapters(), []);
  const adapterIds = useMemo(() => adapters.map((adp) => adp.id), [adapters]);

  const [enabledIds, setEnabledIds] = useState<string[]>(() => adapterIds);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [intervalSec, setIntervalSec] = useState<number>(30);
  const [statuses, setStatuses] = useState<Record<string, AdapterStatus>>({});
  const [data, setData] = useState<FundingDatum[]>([]);

  const enabledSetRef = useRef<Set<string>>(new Set(adapterIds));
  const controlsRef = useRef<{
    [id: string]: {
      stop: () => void;
      setIntervalSec?: (s: number) => void;
    };
  }>({});
  const dataByAdapterRef = useRef<Record<string, FundingDatum[]>>({});

  useEffect(() => {
    enabledSetRef.current = new Set(enabledIds);
  }, [enabledIds]);

  const onData = useCallback(
    (list: FundingDatum[], adapterId: string) => {
      if (!enabledSetRef.current.has(adapterId)) return;
      dataByAdapterRef.current = {
        ...dataByAdapterRef.current,
        [adapterId]: list,
      };
      const merged = Object.values(dataByAdapterRef.current).flat();
      setData(merged);
      setLastUpdate(Date.now());
    },
    [setData, setLastUpdate],
  );

  const onStatus = useCallback(
    (st: AdapterStatus, adapterId: string) => {
      if (!enabledSetRef.current.has(adapterId)) return;
      setStatuses((prev) => ({ ...prev, [adapterId]: st }));
    },
    [setStatuses],
  );

  useEffect(() => {
    const enabledSet = new Set(enabledIds);
    const controls = controlsRef.current;
    const removed: string[] = [];

    adapters.forEach((adp) => {
      const isEnabled = enabledSet.has(adp.id);
      const hasControl = controls[adp.id] != null;

      if (isEnabled && !hasControl) {
        const ctl = adp.start({ onData, onStatus, intervalSec });
        controls[adp.id] = ctl;
      } else if (!isEnabled && hasControl) {
        controls[adp.id].stop();
        delete controls[adp.id];
        delete dataByAdapterRef.current[adp.id];
        removed.push(adp.id);
      }
    });

    if (removed.length > 0) {
      setData(Object.values(dataByAdapterRef.current).flat());
      setStatuses((prev) => {
        const next = { ...prev };
        removed.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setLastUpdate(Date.now());
    }
  }, [adapters, enabledIds, intervalSec, onData, onStatus]);

  useEffect(() => {
    return () => {
      Object.values(controlsRef.current).forEach((c) => c.stop());
      controlsRef.current = {};
      dataByAdapterRef.current = {};
    };
  }, []);

  const handleToggleAdapter = useCallback((id: string) => {
    setEnabledIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= MIN_ENABLED_ADAPTERS) return prev;
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  }, []);

  // Propagate interval change to supported adapters
  useEffect(() => {
    const ctrls = Object.values(controlsRef.current);
    ctrls.forEach((c) => c.setIntervalSec?.(intervalSec));
  }, [intervalSec]);

  const rows = useMemo(() => {
    type Row = {
      symbol: string;
      longEx: string;
      longRate1h: number;
      longPeriod: string;
      shortEx: string;
      shortRate1h: number;
      shortPeriod: string;
      diff1h: number;
    };
    const out: Row[] = [];
    const bySymbol: Record<string, FundingDatum[]> = {};
    for (const d of data) {
      if (!bySymbol[d.symbol]) bySymbol[d.symbol] = [];
      bySymbol[d.symbol].push(d);
    }
    for (const [sym, list] of Object.entries(bySymbol)) {
      // Deduplicate by exchange per symbol (keep last)
      const byEx: Record<string, FundingDatum> = {};
      for (const d of list) byEx[d.exchange] = d;
      const uniq = Object.values(byEx);
      if (uniq.length < 2) continue;
      // Generate all possible exchange combinations for this symbol
      for (let i = 0; i < uniq.length; i++) {
        for (let j = 0; j < uniq.length; j++) {
          if (i === j) continue;
          const a = uniq[i];
          const b = uniq[j];
          if (a.exchange === b.exchange) continue;
          const diff = b.ratePerHour - a.ratePerHour; // short - long
          // Only include combinations with positive funding rate difference (profitable)
          if (diff > 0) {
            const row: Row = {
              symbol: sym,
              longEx: a.exchange,
              longRate1h: a.ratePerHour,
              longPeriod: msToPeriod(a.periodMs),
              shortEx: b.exchange,
              shortRate1h: b.ratePerHour,
              shortPeriod: msToPeriod(b.periodMs),
              diff1h: diff,
            };
            out.push(row);
          }
        }
      }
    }
    out.sort((a, b) => b.diff1h - a.diff1h);
    return out;
  }, [data]);

  return (
    <>
      <div className="min-h-screen p-6 sm:p-10">
        <header className="mb-4">
          <h1 className="text-xl sm:text-2xl font-semibold">
            DEX 资费套利面板
          </h1>
        </header>

        <div className="mb-4 flex w-full flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span>自动刷新:</span>
            <select
              className="rounded-md border bg-transparent px-2 py-1"
              value={String(intervalSec)}
              onChange={(e) => setIntervalSec(Number(e.target.value))}
            >
              <option value="0">关闭</option>
              <option value="10">10s</option>
              <option value="30">30s</option>
              <option value="60">60s</option>
              <option value="300">300s</option>
            </select>
          </div>
          <div className="text-center sm:text-right">
            <div className="mb-1 text-xs text-gray-500">
              选择订阅交易所（至少 2 个）
            </div>
            <div className="flex flex-wrap justify-center gap-3 sm:justify-end">
              {adapters.map((adapter) => {
                const checked = enabledIds.includes(adapter.id);
                const disableToggle =
                  checked && enabledIds.length <= MIN_ENABLED_ADAPTERS;
                return (
                  <label
                    key={adapter.id}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1 ${
                      disableToggle
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      disabled={disableToggle}
                      onChange={() => handleToggleAdapter(adapter.id)}
                    />
                    {adapter.label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="border border-black/10 dark:border-white/10 rounded-md overflow-auto"
          style={{ maxHeight: "calc(100vh - 280px)" }}
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-black/10 bg-slate-100 text-left text-gray-900 dark:border-white/10 dark:bg-slate-800 dark:text-gray-100">
              <tr>
                <th className="px-3 py-2">Symbol</th>
                <th className="px-3 py-2">做多交易所</th>
                <th className="px-3 py-2">做多资金费率(按1h, %)</th>
                <th className="px-3 py-2">做多结算周期</th>
                <th className="px-3 py-2">做空交易所</th>
                <th className="px-3 py-2">做空资金费率(按1h, %)</th>
                <th className="px-3 py-2">做空结算周期</th>
                <th className="px-3 py-2">资金费差(按1h, %)</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-4 text-center text-gray-500"
                    colSpan={8}
                  >
                    等待数据...
                  </td>
                </tr>
              ) : (
                rows.map((r, index) => (
                  <tr
                    key={`${r.symbol}-${r.longEx}-${r.shortEx}-${index}`}
                    className="border-t border-black/5 dark:border-white/10"
                  >
                    <td className="px-3 py-2 font-medium">{r.symbol}</td>
                    <td className="px-3 py-2">
                      {(() => {
                        const url = exchangeTradeUrl(r.longEx, r.symbol);
                        return url ? (
                          <a
                            className="underline underline-offset-4 hover:opacity-80"
                            href={url}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            {r.longEx}
                          </a>
                        ) : (
                          r.longEx
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2">{fmtPct(r.longRate1h)}</td>
                    <td className="px-3 py-2">{r.longPeriod}</td>
                    <td className="px-3 py-2">
                      {(() => {
                        const url = exchangeTradeUrl(r.shortEx, r.symbol);
                        return url ? (
                          <a
                            className="underline underline-offset-4 hover:opacity-80"
                            href={url}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            {r.shortEx}
                          </a>
                        ) : (
                          r.shortEx
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2">{fmtPct(r.shortRate1h)}</td>
                    <td className="px-3 py-2">{r.shortPeriod}</td>
                    <td
                      className={`px-3 py-2 ${
                        r.diff1h >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {fmtPct(r.diff1h)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {lastUpdate
              ? `最后更新：${new Date(lastUpdate).toLocaleTimeString()}`
              : "等待更新..."}
          </div>
          <div>
            说明：资金费率按 1 小时折算后计算“做空-做多”差值并择优展示。
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
          {adapters
            .filter((adapter) => enabledIds.includes(adapter.id))
            .map((adapter) => {
              const st = statuses[adapter.id];
              const healthy = st === "ok" || st === "open";
              return (
                <div key={adapter.id} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`status-dot ${
                      healthy ? "status-dot--ok" : "status-dot--error"
                    }`}
                  />
                  <span>
                    {adapter.label}
                    {st ? `：${st}` : "：无数据"}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
      <style jsx global>{`
        @keyframes status-dot-pulse {
          0% {
            transform: scale(0.85);
            opacity: 0.7;
          }
          50% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(0.85);
            opacity: 0.7;
          }
        }
        .status-dot {
          display: inline-block;
          width: 0.6rem;
          height: 0.6rem;
          border-radius: 9999px;
          animation: status-dot-pulse 1.8s ease-in-out infinite;
        }
        .status-dot--ok {
          background: radial-gradient(
            circle at center,
            #22c55e 0%,
            #22c55e 60%,
            rgba(34, 197, 94, 0.3) 100%
          );
          box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
        }
        .status-dot--error {
          background: radial-gradient(
            circle at center,
            #ef4444 0%,
            #ef4444 60%,
            rgba(239, 68, 68, 0.3) 100%
          );
          box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
        }
      `}</style>
    </>
  );
}
