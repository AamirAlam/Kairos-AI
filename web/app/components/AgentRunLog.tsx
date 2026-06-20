'use client';
import { useState } from 'react';
import { AgentRun } from '../hooks/useAgent';
import { DecisionChainModal } from './DecisionChainModal';

type Props = { runs: AgentRun[] };

const actionColor: Record<string, string> = {
  BUY: 'text-emerald-400',
  SELL: 'text-red-400',
  HOLD: 'text-amber-400',
  VETOED: 'text-orange-400',
  SKIPPED: 'text-zinc-400',
};

const regimeColor: Record<string, string> = {
  BULL: 'text-emerald-400',
  BEAR: 'text-red-400',
  NEUTRAL: 'text-zinc-400',
};

export function AgentRunLog({ runs }: Props) {
  const [selected, setSelected] = useState<AgentRun | null>(null);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Decision History</p>
        <span className="text-[11px] font-mono text-zinc-600">{runs.length} runs · tap to view chain</span>
      </div>

      {runs.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-zinc-600 text-sm">No runs yet</div>
      ) : (
        // Cap height so the panel stops growing as rows accumulate.
        <div className="overflow-y-auto max-h-80 -mx-1 px-1">
          <table className="w-full text-xs font-mono">
            <thead className="sticky top-0 bg-zinc-900">
              <tr className="text-zinc-600 text-left">
                <th className="pb-2 pr-4 font-medium">Time</th>
                <th className="pb-2 pr-4 font-medium">Action</th>
                <th className="pb-2 pr-4 font-medium">Token</th>
                <th className="pb-2 pr-4 font-medium hidden sm:table-cell">Regime</th>
                <th className="pb-2 pr-4 font-medium hidden sm:table-cell">Fear &amp; Greed</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => {
                const brief = r.analyst_brief;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="border-t border-zinc-800 cursor-pointer hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-2 pr-4 text-zinc-500 whitespace-nowrap">
                      {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className={`py-2 pr-4 font-bold ${actionColor[r.action] ?? 'text-zinc-300'}`}>{r.action}</td>
                    <td className="py-2 pr-4 text-zinc-200">{r.token || '—'}</td>
                    <td className={`py-2 pr-4 hidden sm:table-cell ${brief ? (regimeColor[brief.regime] ?? 'text-zinc-400') : 'text-zinc-600'}`}>
                      {brief?.regime ?? '—'}
                    </td>
                    <td className="py-2 pr-4 text-zinc-500 hidden sm:table-cell">
                      {brief ? `${brief.fearGreed}${brief.fearGreedLabel ? ` (${brief.fearGreedLabel})` : ''}` : '—'}
                    </td>
                    <td className="py-2 text-zinc-600 text-right">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DecisionChainModal run={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
