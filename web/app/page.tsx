'use client';
import { useAgent } from './hooks/useAgent';
import { Header } from './components/Header';
import { KpiRow } from './components/KpiRow';
import { AgentPipeline } from './components/AgentPipeline';
import { PnlChart } from './components/PnlChart';
import { SignalFeed } from './components/SignalFeed';
import { TradeLog } from './components/TradeLog';
import { AgentRunLog } from './components/AgentRunLog';
import { Positions } from './components/Positions';

export default function Dashboard() {
  const { state, trades, pnlHistory, signals, agentRuns, positions, activeAgent, connected } = useAgent();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-4">
        <Header state={state} connected={connected} />

        <KpiRow state={state} positions={positions} trades={trades} />

        <AgentPipeline latestRun={agentRuns[0] ?? null} activeAgent={activeAgent} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PnlChart data={pnlHistory} />
          <SignalFeed signals={signals} />
        </div>

        <Positions positions={positions} />
        <AgentRunLog runs={agentRuns} />
        <TradeLog trades={trades} />

        <footer className="pt-2 pb-6 text-center text-[11px] text-zinc-600 font-mono">
          Kairos · powered by CoinMarketCap Agent Hub + Trust Wallet Agent Kit on BNB Smart Chain
        </footer>
      </div>
    </main>
  );
}
