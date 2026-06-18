'use client';
import { useState } from 'react';
import { AgentRun } from '../hooks/useAgent';

type Props = { runs: AgentRun[] };

const actionColor: Record<string, string> = {
  BUY:    'text-green-400',
  SELL:   'text-red-400',
  HOLD:   'text-yellow-400',
  VETOED: 'text-orange-400',
};

const regimeColor: Record<string, string> = {
  BULL:    'text-green-400',
  BEAR:    'text-red-400',
  NEUTRAL: 'text-zinc-400',
};

function RunRow({ run }: { run: AgentRun }) {
  const [open, setOpen] = useState(false);
  const brief = run.analyst_brief;

  return (
    <>
      <tr
        className="border-t border-zinc-800 cursor-pointer hover:bg-zinc-800/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <td className="py-1.5 pr-4 text-zinc-500">
          {new Date(run.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </td>
        <td className={`py-1.5 pr-4 font-bold ${actionColor[run.action] ?? 'text-zinc-300'}`}>
          {run.action}
        </td>
        <td className="py-1.5 pr-4 text-zinc-200">{run.token || '—'}</td>
        <td className={`py-1.5 pr-4 ${brief ? (regimeColor[brief.regime] ?? 'text-zinc-400') : 'text-zinc-600'}`}>
          {brief?.regime ?? '—'}
        </td>
        <td className="py-1.5 pr-4 text-zinc-500">{brief ? `${brief.fearGreed} (${brief.fearGreedLabel})` : '—'}</td>
        <td className="py-1.5 text-zinc-600 text-xs">{open ? '▲' : '▼'}</td>
      </tr>

      {open && (
        <tr className="border-t border-zinc-800 bg-zinc-900/60">
          <td colSpan={6} className="px-3 pb-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">

              <div className="bg-zinc-800/60 rounded-lg p-3 space-y-1">
                <p className="text-zinc-500 uppercase tracking-wider text-[10px] mb-2">Analyst</p>
                {brief ? (
                  <>
                    <p className="text-zinc-200">{brief.summary}</p>
                    {brief.topOpportunities?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-zinc-500 text-[10px] mb-1">Opportunities</p>
                        <ul className="space-y-0.5">
                          {brief.topOpportunities.map((o, i) => (
                            <li key={i} className="text-green-400/80">+ {o}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {brief.keyRisks?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-zinc-500 text-[10px] mb-1">Risks</p>
                        <ul className="space-y-0.5">
                          {brief.keyRisks.map((r, i) => (
                            <li key={i} className="text-red-400/80">- {r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-zinc-600">No data</p>
                )}
              </div>

              <div className="bg-zinc-800/60 rounded-lg p-3">
                <p className="text-zinc-500 uppercase tracking-wider text-[10px] mb-2">Portfolio Manager</p>
                <p className="text-zinc-200 leading-relaxed">{run.pm_reasoning ?? 'No data'}</p>
              </div>

              <div className="bg-zinc-800/60 rounded-lg p-3">
                <p className="text-zinc-500 uppercase tracking-wider text-[10px] mb-2">Risk Officer</p>
                <p className="text-zinc-200 leading-relaxed">{run.risk_reasoning ?? 'No data'}</p>
                {run.trade_id && (
                  <p className="mt-2 text-zinc-500 text-[10px]">trade #{run.trade_id}</p>
                )}
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function AgentRunLog({ runs }: Props) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Decision History</p>
        <span className="text-[11px] font-mono text-zinc-600">{runs.length} runs · click to expand</span>
      </div>
      {runs.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-zinc-600 text-sm">No runs yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-zinc-600 text-left">
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">Action</th>
                <th className="pb-2 pr-4">Token</th>
                <th className="pb-2 pr-4">Regime</th>
                <th className="pb-2 pr-4">Fear & Greed</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => <RunRow key={r.id} run={r} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
