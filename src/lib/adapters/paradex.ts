import type {
  AdapterControl,
  ExchangeAdapter,
  FundingDatum,
  StartContext,
} from "./types";

function normalizeSymbol(market?: string): string | null {
  if (!market) return null;
  const upper = market.toUpperCase();
  if (!upper.endsWith("PERP")) return null;

  let base = upper.slice(0, -4);
  if (base.endsWith("-")) base = base.slice(0, -1);

  const parts = base.split("-").filter(Boolean);
  if (parts.length === 0) return null;

  let symbol = parts[0];
  const suffixes = ["USDT", "USDC", "USD"];
  for (const suf of suffixes) {
    if (symbol.endsWith(suf)) {
      symbol = symbol.slice(0, -suf.length);
      break;
    }
  }

  if (!symbol) return null;
  return symbol;
}

function toNumber(val: unknown): number | null {
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === "string" && val.trim() !== "") {
    const num = Number(val);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

export function createParadexAdapter(): ExchangeAdapter {
  const id = "paradex";
  const label = "ParaDex";
  const kind: "push" = "push";

  return {
    id,
    label,
    kind,
    start: ({ onData, onStatus }: StartContext): AdapterControl => {
      let ws: WebSocket | null = null;
      let active = true;
      const map = new Map<string, FundingDatum>();

      const open = () => {
        if (ws) return;
        onStatus?.("connecting", id);
        ws = new WebSocket("wss://ws.api.prod.paradex.trade/v1?/");

        ws.onopen = () => {
          onStatus?.("open", id);
          ws?.send(
            JSON.stringify({
              jsonrpc: "2.0",
              method: "subscribe",
              params: { channel: "funding_data.ALL" },
              id: 1,
            }),
          );
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            if (msg?.method === "ping") {
              ws?.send(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: msg?.id ?? null,
                  result: "pong",
                }),
              );
              return;
            }

            if (
              msg?.method === "subscription" &&
              msg?.params?.channel === "funding_data.ALL"
            ) {
              const data = msg.params?.data as
                | {
                    market?: string;
                    funding_rate?: unknown;
                    funding_rate_8h?: unknown;
                    funding_period_hours?: unknown;
                  }
                | undefined;
              if (!data) return;

              const symbol = normalizeSymbol(data.market);
              if (!symbol) return;

              let periodHours: number | null = null;
              let rawRate: number | null = null;

              const rate = toNumber(data.funding_rate);
              if (rate != null) {
                rawRate = rate;
                const ph = toNumber(data.funding_period_hours);
                periodHours = ph != null && ph > 0 ? ph : 1;
              } else {
                const rate8h = toNumber(data.funding_rate_8h);
                if (rate8h != null) {
                  rawRate = rate8h;
                  periodHours = 8;
                }
              }

              if (rawRate == null || periodHours == null || periodHours <= 0)
                return;

              const periodMs = periodHours * 3600000;
              const ratePerHour = rawRate / periodHours;
              if (!Number.isFinite(ratePerHour)) return;

              const prev = map.get(symbol);
              if (
                !prev ||
                prev.rawRate !== rawRate ||
                prev.periodMs !== periodMs
              ) {
                map.set(symbol, {
                  exchange: label,
                  symbol,
                  rawRate,
                  periodMs,
                  ratePerHour,
                });
                if (active) {
                  onData(Array.from(map.values()), id);
                }
              }
            }
          } catch {
            // ignore malformed messages
          }
        };

        ws.onclose = () => {
          onStatus?.("closed", id);
          ws = null;
          if (active) {
            setTimeout(open, 2000);
          }
        };

        ws.onerror = () => onStatus?.("error", id);
      };

      open();

      return {
        stop: () => {
          active = false;
          try {
            ws?.close();
          } catch {}
          ws = null;
        },
      };
    },
  };
}
