'use client';
import { AgentState, PipelineStep } from '../hooks/useAgent';

type Props = { state: AgentState | null; connected: boolean; activeAgent?: PipelineStep };

const PIPELINE_LABELS: Record<string, string> = {
  analyst: 'Analyst thinking...',
  portfolioManager: 'Portfolio Manager deciding...',
  riskOfficer: 'Risk Officer reviewing...',
};

export function StatusBar({ state, connected, activeAgent }: Props) {
  const statusColor = {
    RUNNING: 'text-green-400',
    PAUSED: 'text-yellow-400',
    STOPPED: 'text-red-400',
  }[state?.status ?? 'STOPPED'];

  const pnl = state?.pnlPct ?? 0;
  const drawdown = state?.drawdownPct ?? 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-sm font-mono font-bold ${statusColor}`}>
            {connected ? '● ' : '○ '}{state?.status ?? 'DISCONNECTED'}
          </span>
          <span className="text-zinc-500 text-xs">Kairos</span>
        </div>

        <div className="flex items-center gap-8">
          <Stat label="Portfolio" value={`$${(state?.portfolioUsd ?? 0).toFixed(2)}`} />
          <Stat
            label="PnL"
            value={`${pnl >= 0 ? '+' : ''}${(pnl * 100).toFixed(2)}%`}
            color={pnl >= 0 ? 'text-green-400' : 'text-red-400'}
          />
          <Stat
            label="Drawdown"
            value={`${(drawdown * 100).toFixed(2)}%`}
            color={drawdown > 0.2 ? 'text-red-400' : 'text-zinc-300'}
          />
        </div>
      </div>

      {activeAgent && (
        <div className="flex items-center gap-2 text-xs font-mono">
          <PipelineProgress activeAgent={activeAgent} />
        </div>
      )}
    </div>
  );
}

function PipelineProgress({ activeAgent }: { activeAgent: PipelineStep }) {
  const steps: PipelineStep[] = ['analyst', 'portfolioManager', 'riskOfficer'];
  const activeIdx = steps.indexOf(activeAgent);

  return (
    <div className="flex items-center gap-2 w-full">
      {steps.map((step, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={step} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] ${
              active  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' :
              done    ? 'bg-zinc-800 text-green-400' :
                        'bg-zinc-800/40 text-zinc-600'
            }`}>
              {active && <span className="animate-pulse">●</span>}
              {done   && <span>✓</span>}
              {PIPELINE_LABELS[step ?? ''] ?? step}
            </div>
            {i < steps.length - 1 && <span className="text-zinc-700">→</span>}
          </div>
        );
      })}
      <span className="ml-2 text-zinc-500">{activeAgent ? PIPELINE_LABELS[activeAgent] : ''}</span>
    </div>
  );
}

function Stat({ label, value, color = 'text-zinc-100' }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-mono font-bold ${color}`}>{value}</p>
    </div>
  );
}
