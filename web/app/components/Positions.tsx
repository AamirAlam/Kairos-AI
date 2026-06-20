'use client';
import { Position } from '../hooks/useAgent';

type Props = { positions: Position[] };

const exitColor: Record<string, string> = {
  TAKE_PROFIT: 'text-green-400',
  TRAILING_STOP: 'text-green-400',
  STOP_LOSS: 'text-red-400',
  TIME_STOP: 'text-yellow-400',
  PM_SELL: 'text-sky-400',
};

function pct(n: number | null) {
  if (n === null) return '—';
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
}

export function Positions({ positions }: Props) {
  const open = positions.filter(p => p.status === 'OPEN');
  const closed = positions.filter(p => p.status === 'CLOSED');

  // Realized PnL roll-up — the "is the bot actually profitable" number.
  const realized = closed
    .map(p => p.realized_pnl_pct ?? 0)
    .reduce((a, b) => a + b, 0);
  const wins = closed.filter(p => (p.realized_pnl_pct ?? 0) > 0).length;
  const winRate = closed.length ? (wins / closed.length) * 100 : 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Positions</p>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-zinc-500">{open.length} open</span>
          <span className="text-zinc-500">
            win rate <span className="text-zinc-300">{winRate.toFixed(0)}%</span> ({wins}/{closed.length})
          </span>
          <span className="text-zinc-500">
            realized <span className={realized >= 0 ? 'text-green-400' : 'text-red-400'}>{pct(realized)}</span>
          </span>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="flex items-center justify-center h-20 text-zinc-600 text-sm">No positions yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-zinc-600 text-left">
                <th className="pb-2 pr-4">Token</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">BNB In</th>
                <th className="pb-2 pr-4">Entry</th>
                <th className="pb-2 pr-4">Exit</th>
                <th className="pb-2 pr-4">PnL</th>
                <th className="pb-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(p => (
                <tr key={p.id} className="border-t border-zinc-800">
                  <td className="py-1.5 pr-4 text-zinc-200 font-bold">{p.token}</td>
                  <td className={`py-1.5 pr-4 ${p.status === 'OPEN' ? 'text-indigo-300' : 'text-zinc-500'}`}>
                    {p.status}
                  </td>
                  <td className="py-1.5 pr-4 text-zinc-300">{p.bnb_spent.toFixed(4)}</td>
                  <td className="py-1.5 pr-4 text-zinc-400">${p.entry_price_usd.toPrecision(4)}</td>
                  <td className="py-1.5 pr-4 text-zinc-400">
                    {p.exit_price_usd ? `$${p.exit_price_usd.toPrecision(4)}` : '—'}
                  </td>
                  <td className={`py-1.5 pr-4 font-bold ${
                    p.realized_pnl_pct === null ? 'text-zinc-600'
                      : p.realized_pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {pct(p.realized_pnl_pct)}
                  </td>
                  <td className={`py-1.5 ${exitColor[p.exit_reason ?? ''] ?? 'text-zinc-600'}`}>
                    {p.exit_reason ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
