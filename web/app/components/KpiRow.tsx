'use client';
import { AgentState, Position, Trade } from '../hooks/useAgent';

type Props = { state: AgentState | null; positions: Position[]; trades: Trade[] };

const DRAWDOWN_CAP = 0.30; // competition risk gate

function fmtUsd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function signedPct(n: number) {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
}
function isToday(ts: number) {
  const d = new Date(ts), n = new Date();
  return d.getUTCFullYear() === n.getUTCFullYear() && d.getUTCMonth() === n.getUTCMonth() && d.getUTCDate() === n.getUTCDate();
}

export function KpiRow({ state, positions, trades }: Props) {
  const portfolioUsd = state?.portfolioUsd ?? 0;
  const bnbUsd = state?.bnbUsd ?? 0;
  const tokenUsd = state?.tokenUsd ?? 0;
  const pnlPct = state?.pnlPct ?? 0;
  const startingUsd = state?.startingUsd ?? 0;
  const drawdown = state?.drawdownPct ?? 0;

  const pnlUsd = portfolioUsd - startingUsd;

  const closed = positions.filter(p => p.status === 'CLOSED');
  const open = positions.filter(p => p.status === 'OPEN');
  const realized = closed.reduce((a, p) => a + (p.realized_pnl_pct ?? 0), 0);
  const wins = closed.filter(p => (p.realized_pnl_pct ?? 0) > 0).length;
  const winRate = closed.length ? (wins / closed.length) * 100 : 0;

  const tradesToday = trades.filter(t => isToday(t.timestamp)).length;
  const ddRatio = Math.min(drawdown / DRAWDOWN_CAP, 1);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Net worth */}
      <Card label="Net Worth" accent>
        <div className="text-2xl font-bold font-mono tabular-nums">{fmtUsd(portfolioUsd)}</div>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] font-mono">
          <span className="inline-flex items-center gap-1 text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />BNB {fmtUsd(bnbUsd)}
          </span>
          <span className="inline-flex items-center gap-1 text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />Tokens {fmtUsd(tokenUsd)}
          </span>
        </div>
        {/* composition bar */}
        <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="bg-amber-400" style={{ width: `${portfolioUsd ? (bnbUsd / portfolioUsd) * 100 : 0}%` }} />
          <div className="bg-sky-400" style={{ width: `${portfolioUsd ? (tokenUsd / portfolioUsd) * 100 : 0}%` }} />
        </div>
      </Card>

      {/* Total PnL */}
      <Card label="Total PnL">
        <div className={`text-2xl font-bold font-mono tabular-nums ${pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {signedPct(pnlPct)}
        </div>
        <div className={`mt-1.5 text-[11px] font-mono ${pnlUsd >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
          {pnlUsd >= 0 ? '+' : '−'}{fmtUsd(Math.abs(pnlUsd))} since start
        </div>
        <div className="mt-2 text-[10px] text-zinc-600 font-mono">baseline {fmtUsd(startingUsd)}</div>
      </Card>

      {/* Realized / win rate */}
      <Card label="Realized PnL">
        <div className={`text-2xl font-bold font-mono tabular-nums ${realized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {signedPct(realized)}
        </div>
        <div className="mt-1.5 text-[11px] font-mono text-zinc-400">
          win rate <span className="text-zinc-200">{winRate.toFixed(0)}%</span>
          <span className="text-zinc-600"> · {wins}/{closed.length} closed</span>
        </div>
        <div className="mt-2 text-[10px] text-zinc-600 font-mono">{open.length} open position{open.length === 1 ? '' : 's'}</div>
      </Card>

      {/* Drawdown gauge */}
      <Card label="Drawdown">
        <div className={`text-2xl font-bold font-mono tabular-nums ${ddRatio > 0.66 ? 'text-red-400' : ddRatio > 0.33 ? 'text-amber-400' : 'text-zinc-200'}`}>
          {(drawdown * 100).toFixed(2)}%
        </div>
        <div className="mt-1.5 text-[11px] font-mono text-zinc-500">cap {DRAWDOWN_CAP * 100}% · disqualify gate</div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full ${ddRatio > 0.66 ? 'bg-red-400' : ddRatio > 0.33 ? 'bg-amber-400' : 'bg-emerald-400'}`}
            style={{ width: `${ddRatio * 100}%` }}
          />
        </div>
        <div className="mt-1.5 text-[10px] text-zinc-600 font-mono">
          {tradesToday >= 1 ? '✓' : '○'} {tradesToday} trade{tradesToday === 1 ? '' : 's'} today (min 1/day)
        </div>
      </Card>
    </div>
  );
}

function Card({ label, children, accent }: { label: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-indigo-500/30 bg-indigo-500/[0.04]' : 'border-zinc-800 bg-zinc-900'}`}>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  );
}
