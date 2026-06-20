'use client';
import { useState } from 'react';
import { Position } from '../hooks/useAgent';

type Props = { positions: Position[] };

const exitColor: Record<string, string> = {
  TAKE_PROFIT: 'text-green-400',
  TRAILING_STOP: 'text-green-400',
  STOP_LOSS: 'text-red-400',
  TIME_STOP: 'text-yellow-400',
  PM_SELL: 'text-sky-400',
};

function pct(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
}
function pnlClass(n: number | null | undefined) {
  if (n === null || n === undefined) return 'text-zinc-600';
  return n >= 0 ? 'text-green-400' : 'text-red-400';
}

export function Positions({ positions }: Props) {
  const [tab, setTab] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const open = positions.filter(p => p.status === 'OPEN');
  const closed = positions.filter(p => p.status === 'CLOSED');
  const rows = tab === 'OPEN' ? open : closed;

  const realized = closed.reduce((a, p) => a + (p.realized_pnl_pct ?? 0), 0);
  const unrealized = open.reduce((a, p) => a + (p.unrealized_pnl_pct ?? 0), 0);
  const wins = closed.filter(p => (p.realized_pnl_pct ?? 0) > 0).length;
  const winRate = closed.length ? (wins / closed.length) * 100 : 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Positions</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono">
          <span className="text-zinc-500">{open.length} open</span>
          <span className="text-zinc-500">
            unrealized <span className={pnlClass(unrealized)}>{pct(unrealized)}</span>
          </span>
          <span className="text-zinc-500">
            win rate <span className="text-zinc-300">{winRate.toFixed(0)}%</span> ({wins}/{closed.length})
          </span>
          <span className="text-zinc-500">
            realized <span className={pnlClass(realized)}>{pct(realized)}</span>
          </span>
        </div>
      </div>

      {/* Open / Closed tabs */}
      <div className="mb-3 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 text-xs font-mono">
        {(['OPEN', 'CLOSED'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1 transition-colors ${
              tab === t ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'OPEN' ? 'Open' : 'Closed'}
            <span className="ml-1.5 text-zinc-600">{t === 'OPEN' ? open.length : closed.length}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center justify-center h-20 text-zinc-600 text-sm">
          No {tab === 'OPEN' ? 'open' : 'closed'} positions
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* All columns shown; scrolls horizontally on narrow screens (nowrap cells). */}
          <table className="w-full text-xs font-mono whitespace-nowrap">
            <thead>
              <tr className="text-zinc-600 text-left">
                <th className="pb-2 pr-4 font-medium">Token</th>
                <th className="pb-2 pr-4 font-medium">BNB In</th>
                <th className="pb-2 pr-4 font-medium">Entry</th>
                <th className="pb-2 pr-4 font-medium">Now / Exit</th>
                <th className="pb-2 pr-4 font-medium">PnL</th>
                <th className="pb-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => {
                const isOpen = p.status === 'OPEN';
                const livePnl = isOpen ? p.unrealized_pnl_pct : p.realized_pnl_pct;
                const price = isOpen ? p.current_price_usd : p.exit_price_usd;
                return (
                  <tr key={p.id} className="border-t border-zinc-800">
                    <td className="py-1.5 pr-4 text-zinc-200 font-bold">{p.token}</td>
                    <td className="py-1.5 pr-4 text-zinc-300">{p.bnb_spent.toFixed(4)}</td>
                    <td className="py-1.5 pr-4 text-zinc-400">${p.entry_price_usd.toPrecision(4)}</td>
                    <td className="py-1.5 pr-4 text-zinc-400">{price ? `$${price.toPrecision(4)}` : '—'}</td>
                    <td className={`py-1.5 pr-4 font-bold ${pnlClass(livePnl)}`}>
                      {pct(livePnl)}
                      {isOpen && livePnl !== null && livePnl !== undefined && (
                        <span className="ml-1 text-[9px] font-normal text-zinc-600">unreal.</span>
                      )}
                    </td>
                    <td className={`py-1.5 ${exitColor[p.exit_reason ?? ''] ?? 'text-zinc-600'}`}>
                      {p.exit_reason ?? (isOpen ? 'open' : '—')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
