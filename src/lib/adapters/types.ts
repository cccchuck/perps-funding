export type AdapterStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "ok"
  | "error";

export type FundingDatum = {
  exchange: string;
  symbol: string; // normalized
  // raw funding for the native period
  rawRate: number;
  // native period length in ms
  periodMs: number;
  // normalized to 1 hour funding
  ratePerHour: number;
};

export type StartContext = {
  onData: (list: FundingDatum[], adapterId: string) => void;
  onStatus?: (status: AdapterStatus, adapterId: string) => void;
  intervalSec?: number;
};

export type AdapterControl = {
  stop: () => void;
  setIntervalSec?: (sec: number) => void;
  manualRefresh?: () => Promise<void>;
};

export interface ExchangeAdapter {
  id: string;
  label: string;
  kind: "pull" | "push";
  start: (ctx: StartContext) => AdapterControl;
}
