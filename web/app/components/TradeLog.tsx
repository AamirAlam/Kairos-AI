'use client';
import { useMemo, useState } from 'react';
import { Trade, AgentRun } from '../hooks/useAgent';
import { DecisionChainModal } from './DecisionChainModal';

type Props = { trades: Trade[]; runs: AgentRun[] };

const statusBadge: Record<string, string> = {
  CONFIRMED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  PENDING: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  FAILED: 'text-red-400 bg-red-500/10 border-red-500/30',
};

function short(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function TradeLog({ trades, runs }: Props) {
  const [selected, setSelected] = useState<AgentRun | null>(null);

  // trade_id → the LLM decision chain that produced it.
  const runByTrade = useMemo(() => {
    const m = new Map<number, AgentRun>();
    for (const r of runs) if (r.trade_id != null) m.set(r.trade_id, r);
    return m;
  }, [runs]);

  function openChain(t: Trade) {
    const run = runByTrade.get(t.id);
    // Automated exits (TP/SL/trailing/time-stop) have no LLM chain — synthesize a
    // clear entry so the modal still explains the trade.
    setSelected(run ?? {
      id: -t.id,
      timestamp: t.timestamp,
      action: t.side,
      token: t.token,
      analyst_brief: null,
      pm_reasoning: 'Automated exit — triggered by a deterministic risk rule, not an LLM decision.',
      risk_reasoning: t.signal ?? '—',
      trade_id: t.id,
    });
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Trade Log</p>
        <span className="text-[11px] font-mono text-zinc-600">{trades.length} executed · tap for decision</span>
      </div>
      {trades.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-zinc-600 text-sm">No trades yet</div>
      ) : (
        <div className="overflow-y-auto max-h-80 -mx-1 px-1">
          <table className="w-full text-xs font-mono">
            <thead className="sticky top-0 bg-zinc-900">
              <tr className="text-zinc-600 text-left">
                <th className="pb-2 pr-4 font-medium">Time</th>
                <th className="pb-2 pr-4 font-medium">Side</th>
                <th className="pb-2 pr-4 font-medium">Token</th>
                <th className="pb-2 pr-4 font-medium">Amount</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Tx</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {trades.map(t => (
                <tr
                  key={t.id}
                  onClick={() => openChain(t)}
                  className="border-t border-zinc-800 cursor-pointer hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="py-2 pr-4 text-zinc-500 whitespace-nowrap">
                    {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`font-bold ${t.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.side === 'BUY' ? '▲ BUY' : '▼ SELL'}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-zinc-200 font-semibold">{t.token}</td>
                  <td className="py-2 pr-4 text-zinc-300 tabular-nums">{t.amount_bnb.toFixed(4)}</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] ${statusBadge[t.status] ?? 'text-zinc-400 border-zinc-700'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4" onClick={(e) => e.stopPropagation()}>
                    {t.tx_hash ? (
                      <a
                        href={`https://bscscan.com/tx/${t.tx_hash}`}
                        target="_blank" rel="noreferrer"
                        className="text-sky-400 hover:text-sky-300 hover:underline"
                      >
                        {short(t.tx_hash)} ↗
                      </a>
                    ) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="py-2 text-zinc-600 text-right">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DecisionChainModal run={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
