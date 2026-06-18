'use client';
import { Signal } from '../hooks/useAgent';

type Props = { signals: Signal[] };

const regimeColor = { BULL: 'text-green-400', BEAR: 'text-red-400', NEUTRAL: 'text-yellow-400' } as const;

export function SignalFeed({ signals }: Props) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-56 overflow-hidden">
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Signal Feed</p>
      {signals.length === 0 ? (
        <div className="flex items-center justify-center h-36 text-zinc-600 text-sm">Waiting for signals…</div>
      ) : (
        <div className="space-y-2 overflow-y-auto h-40 pr-1">
          {signals.map((s, i) => (
            <div
              key={`${s.timestamp}-${i}`}
              className={`flex items-start gap-2 text-xs font-mono rounded px-1 -mx-1 py-0.5 ${i === 0 ? 'animate-rowflash' : ''}`}
            >
              <span className="text-zinc-600 shrink-0 tabular-nums">
                {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className={`shrink-0 font-bold ${regimeColor[s.regime as keyof typeof regimeColor] ?? 'text-zinc-300'}`}>
                {s.regime}
              </span>
              {s.fear_greed !== null && (
                <span className="text-zinc-400 shrink-0">F&G {s.fear_greed}</span>
              )}
              <span className="text-zinc-500 truncate">{s.action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
