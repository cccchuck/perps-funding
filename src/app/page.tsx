'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDefaultAdapters } from '../lib/adapters'
import type { AdapterStatus, FundingDatum } from '../lib/adapters/types'

function msToPeriod(ms?: number | null): string {
  if (!ms || ms <= 0) return '-'
  const minutes = Math.round(ms / 60000)
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${minutes}m`
}

function fmtPct(x: number, dp = 4): string {
  if (!isFinite(x)) return '-'
  return `${(x * 100).toFixed(dp)}%`
}

function exchangeTradeUrl(exchange: string, symbol: string): string | null {
  switch (exchange) {
    case 'EdgeX':
      return `https://pro.edgex.exchange/trade/${symbol}USD`
    case 'Lighter':
      return `https://app.lighter.xyz/trade/${symbol}`
    default:
      return null
  }
}

export default function Home() {
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)
  const [intervalSec, setIntervalSec] = useState<number>(30)
  const [loading, setLoading] = useState<boolean>(false)
  const [statuses, setStatuses] = useState<Record<string, AdapterStatus>>({})
  const [data, setData] = useState<FundingDatum[]>([])
  const controlsRef = useRef<{
    [id: string]: {
      stop: () => void
      setIntervalSec?: (s: number) => void
      manualRefresh?: () => Promise<void>
    }
  }>({})
  const dataByAdapterRef = useRef<Record<string, FundingDatum[]>>({})

  // Initialize adapters
  useEffect(() => {
    const adapters = getDefaultAdapters()
    const nextControls: typeof controlsRef.current = {}

    const onData = (list: FundingDatum[], adapterId: string) => {
      dataByAdapterRef.current = {
        ...dataByAdapterRef.current,
        [adapterId]: list,
      }
      const merged = Object.values(dataByAdapterRef.current).flat()
      setData(merged)
      setLastUpdate(Date.now())
    }
    const onStatus = (st: AdapterStatus, adapterId: string) => {
      setStatuses((prev) => ({ ...prev, [adapterId]: st }))
    }

    adapters.forEach((adp) => {
      const ctl = adp.start({ onData, onStatus, intervalSec })
      nextControls[adp.id] = ctl
    })
    controlsRef.current = nextControls

    return () => {
      Object.values(controlsRef.current).forEach((c) => c.stop())
      controlsRef.current = {}
      dataByAdapterRef.current = {}
    }
  }, [])

  // Manual refresh across all pull adapters
  const manualRefreshAll = useCallback(async () => {
    try {
      setLoading(true)
      const ctrls = Object.values(controlsRef.current)
      await Promise.all(
        ctrls
          .map((c) => c.manualRefresh)
          .filter(Boolean)
          .map((fn) => (fn as () => Promise<void>)())
      )
    } finally {
      setLoading(false)
    }
  }, [])

  // Propagate interval change to supported adapters
  useEffect(() => {
    const ctrls = Object.values(controlsRef.current)
    ctrls.forEach((c) => c.setIntervalSec?.(intervalSec))
  }, [intervalSec])

  const rows = useMemo(() => {
    type Row = {
      symbol: string
      longEx: string
      longRate1h: number
      longPeriod: string
      shortEx: string
      shortRate1h: number
      shortPeriod: string
      diff1h: number
    }
    const out: Row[] = []
    const bySymbol: Record<string, FundingDatum[]> = {}
    for (const d of data) {
      if (!bySymbol[d.symbol]) bySymbol[d.symbol] = []
      bySymbol[d.symbol].push(d)
    }
    for (const [sym, list] of Object.entries(bySymbol)) {
      // Deduplicate by exchange per symbol (keep last)
      const byEx: Record<string, FundingDatum> = {}
      for (const d of list) byEx[d.exchange] = d
      const uniq = Object.values(byEx)
      if (uniq.length < 2) continue
      let best: Row | null = null
      for (let i = 0; i < uniq.length; i++) {
        for (let j = 0; j < uniq.length; j++) {
          if (i === j) continue
          const a = uniq[i]
          const b = uniq[j]
          if (a.exchange === b.exchange) continue
          const diff = b.ratePerHour - a.ratePerHour // short - long
          const row: Row = {
            symbol: sym,
            longEx: a.exchange,
            longRate1h: a.ratePerHour,
            longPeriod: msToPeriod(a.periodMs),
            shortEx: b.exchange,
            shortRate1h: b.ratePerHour,
            shortPeriod: msToPeriod(b.periodMs),
            diff1h: diff,
          }
          if (!best || row.diff1h > best.diff1h) best = row
        }
      }
      if (best) out.push(best)
    }
    out.sort((a, b) => b.diff1h - a.diff1h)
    return out
  }, [data])

  return (
    <div className="min-h-screen p-6 sm:p-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold">DEX 资费套利面板</h1>
        <div className="text-xs sm:text-sm text-gray-500">
          {Object.entries(statuses)
            .map(([k, v]) => `${k}:${v}`)
            .join(' · ')}
          {lastUpdate
            ? ` · 更新于 ${new Date(lastUpdate).toLocaleTimeString()}`
            : ''}
        </div>
      </header>

      <div className="mb-3 flex items-center gap-3 text-sm">
        <button
          className="rounded-md border px-3 py-1 hover:bg-black/5 dark:hover:bg-white/10"
          onClick={() => manualRefreshAll()}
          disabled={loading}
        >
          {loading ? '刷新中...' : '手动刷新'}
        </button>
        <label className="flex items-center gap-2">
          自动刷新:
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
        </label>
      </div>

      <div className="overflow-auto border border-black/10 dark:border-white/10 rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5 text-left">
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
                <td className="px-3 py-4 text-center text-gray-500" colSpan={8}>
                  等待数据...
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.symbol}
                  className="border-t border-black/5 dark:border-white/10"
                >
                  <td className="px-3 py-2 font-medium">{r.symbol}</td>
                  <td className="px-3 py-2">
                    {(() => {
                      const url = exchangeTradeUrl(r.longEx, r.symbol)
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
                      )
                    })()}
                  </td>
                  <td className="px-3 py-2">{fmtPct(r.longRate1h)}</td>
                  <td className="px-3 py-2">{r.longPeriod}</td>
                  <td className="px-3 py-2">
                    {(() => {
                      const url = exchangeTradeUrl(r.shortEx, r.symbol)
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
                      )
                    })()}
                  </td>
                  <td className="px-3 py-2">{fmtPct(r.shortRate1h)}</td>
                  <td className="px-3 py-2">{r.shortPeriod}</td>
                  <td
                    className={`px-3 py-2 ${
                      r.diff1h >= 0 ? 'text-green-600' : 'text-red-600'
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

      <p className="mt-3 text-xs text-gray-500">
        说明：资金费率按 1 小时折算后计算“做空-做多”差值并择优展示。
      </p>
    </div>
  )
}
