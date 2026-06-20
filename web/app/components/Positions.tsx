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

function pct(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
}
function pnlClass(n: number | null | undefined) {
  if (n === null || n === undefined) return 'text-zinc-600';
  return n >= 0 ? 'text-green-400' : 'text-red-400';
}

export function Positions({ positions }: Props) {
  const open = positions.filter(p => p.status === 'OPEN');
  const closed = positions.filter(p => p.status === 'CLOSED');

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

      {positions.length === 0 ? (
        <div className="flex items-center justify-center h-20 text-zinc-600 text-sm">No positions yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-zinc-600 text-left">
                <th className="pb-2 pr-4 font-medium">Token</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium hidden sm:table-cell">BNB In</th>
                <th className="pb-2 pr-4 font-medium hidden md:table-cell">Entry</th>
                <th className="pb-2 pr-4 font-medium hidden md:table-cell">Now / Exit</th>
                <th className="pb-2 pr-4 font-medium">PnL</th>
                <th className="pb-2 font-medium hidden sm:table-cell">Reason</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(p => {
                const isOpen = p.status === 'OPEN';
                const livePnl = isOpen ? p.unrealized_pnl_pct : p.realized_pnl_pct;
                const price = isOpen ? p.current_price_usd : p.exit_price_usd;
                return (
                  <tr key={p.id} className="border-t border-zinc-800">
                    <td className="py-1.5 pr-4 text-zinc-200 font-bold">{p.token}</td>
                    <td className={`py-1.5 pr-4 ${isOpen ? 'text-indigo-300' : 'text-zinc-500'}`}>{p.status}</td>
                    <td className="py-1.5 pr-4 text-zinc-300 hidden sm:table-cell">{p.bnb_spent.toFixed(4)}</td>
                    <td className="py-1.5 pr-4 text-zinc-400 hidden md:table-cell">${p.entry_price_usd.toPrecision(4)}</td>
                    <td className="py-1.5 pr-4 text-zinc-400 hidden md:table-cell">{price ? `$${price.toPrecision(4)}` : '—'}</td>
                    <td className={`py-1.5 pr-4 font-bold ${pnlClass(livePnl)}`}>
                      {pct(livePnl)}
                      {isOpen && livePnl !== null && livePnl !== undefined && (
                        <span className="ml-1 text-[9px] font-normal text-zinc-600">unreal.</span>
                      )}
                    </td>
                    <td className={`py-1.5 hidden sm:table-cell ${exitColor[p.exit_reason ?? ''] ?? 'text-zinc-600'}`}>
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
