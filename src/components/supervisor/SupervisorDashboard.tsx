'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Coffee,
  Utensils,
  RefreshCw,
  Play,
  TrendingUp,
  ShieldAlert,
  Zap,
} from 'lucide-react';

interface AgentPresenceItem {
  id: string;
  name: string;
  email: string;
  role: string;
  presence: 'ONLINE' | 'OFFLINE' | 'LUNCH' | 'BREAK';
  activeChatCount: number;
  maxConcurrentChats: number;
  businessUnits: string[];
  breakExpectedEndAt?: string | null;
}

interface AdherenceRecord {
  agentId: string;
  agentName: string;
  email: string;
  role: string;
  presence: string;
  breakExpectedEndAt?: string | null;
  totalBreaks: number;
  totalBreakMinutes: number;
  totalOverrunSeconds: number;
  overrunMinutes: number;
  autoRevertedCount: number;
  adherenceScore: number;
}

export interface SupervisorDashboardProps {
  selectedBu?: string;
  onBuChange?: (bu: string) => void;
}

export const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({
  selectedBu = 'ALL',
}) => {
  const [agents, setAgents] = useState<AgentPresenceItem[]>([]);
  const [adherenceRecords, setAdherenceRecords] = useState<AdherenceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sweeping, setSweeping] = useState<boolean>(false);
  const [sweepResult, setSweepResult] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [filterPresence, setFilterPresence] = useState<string>('ALL');

  // Live clock ticker every second for countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [presenceRes, adherenceRes] = await Promise.all([
        fetch('/api/agents/presence'),
        fetch('/api/agents/adherence'),
      ]);

      if (presenceRes.ok) {
        const pData = await presenceRes.json();
        setAgents(pData.agents || []);
      }

      if (adherenceRes.ok) {
        const aData = await adherenceRes.json();
        setAdherenceRecords(aData.agents || aData.adherenceRecords || []);
      }
    } catch (err) {
      console.error('Failed to load supervisor data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunSweep = async () => {
    try {
      setSweeping(true);
      setSweepResult(null);
      const res = await fetch('/api/agents/break-sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
      if (res.ok) {
        const data = await res.json();
        setSweepResult(
          `Sweep executed: Scanned ${data.scanned} agents, reverted ${data.reverted} back to ONLINE`
        );
        await fetchData();
      }
    } catch (err: any) {
      setSweepResult(`Sweep failed: ${err.message}`);
    } finally {
      setSweeping(false);
    }
  };

  // Filter agents by BU first if selected
  const buAgents = agents.filter((a) => {
    if (!selectedBu || selectedBu === 'ALL') return true;
    if (!a.businessUnits || a.businessUnits.length === 0) return true;
    return a.businessUnits.some((b) => b.toUpperCase() === selectedBu.toUpperCase());
  });

  // Compute metrics
  const totalAgents = buAgents.length;
  const onlineCount = buAgents.filter((a) => a.presence === 'ONLINE').length;
  const onBreakCount = buAgents.filter(
    (a) => a.presence === 'BREAK' || a.presence === 'LUNCH'
  ).length;

  const overrunAgents = buAgents.filter((a) => {
    if (a.presence !== 'BREAK' && a.presence !== 'LUNCH') return false;
    if (!a.breakExpectedEndAt) return false;
    return currentTime >= new Date(a.breakExpectedEndAt).getTime();
  });

  const avgAdherence =
    adherenceRecords.length > 0
      ? Math.round(
          adherenceRecords.reduce((acc, r) => acc + r.adherenceScore, 0) /
            adherenceRecords.length
        )
      : 100;

  const filteredAgents = buAgents.filter((a) => {
    if (filterPresence === 'ALL') return true;
    return a.presence === filterPresence;
  });

  const formatCountdown = (expectedEndAtStr?: string | null) => {
    if (!expectedEndAtStr) return null;
    const endMs = new Date(expectedEndAtStr).getTime();
    const diffMs = endMs - currentTime;

    if (diffMs > 0) {
      const minutes = Math.floor(diffMs / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      return {
        isOverrun: false,
        text: `${minutes}m ${seconds.toString().padStart(2, '0')}s remaining`,
      };
    } else {
      const overMs = Math.abs(diffMs);
      const minutes = Math.floor(overMs / 60000);
      const seconds = Math.floor((overMs % 60000) / 1000);
      return {
        isOverrun: true,
        text: `+${minutes}m ${seconds.toString().padStart(2, '0')}s OVERRUN`,
      };
    }
  };

  return (
    <div className="flex-1 bg-background text-foreground p-6 overflow-y-auto min-h-screen transition-colors">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center text-violet-500">
              <ShieldAlert size={20} />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Supervisor Workforce &amp; Shift Adherence Center
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Live shift monitoring, break countdown timers, automated reversion &amp; adherence analytics (R3)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-accent text-muted-foreground hover:text-foreground text-xs font-semibold border border-border transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleRunSweep}
            disabled={sweeping}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-md shadow-violet-500/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Zap size={13} className={sweeping ? 'animate-bounce' : ''} />
            <span>{sweeping ? 'Sweeping...' : 'Run Break Sweep'}</span>
          </button>
        </div>
      </div>

      {sweepResult && (
        <div className="mt-4 p-3 rounded-xl bg-violet-500/10 border border-violet-500/25 text-violet-500 text-xs flex items-center justify-between animate-in fade-in duration-200">
          <span>{sweepResult}</span>
          <button
            onClick={() => setSweepResult(null)}
            className="text-violet-400 hover:text-violet-200 text-sm font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 my-6">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Agents</span>
            <Users size={16} />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{totalAgents}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Configured staff</div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-500 text-xs font-medium">
            <span>Online &amp; Active</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-2xl font-bold text-emerald-500 mt-2">{onlineCount}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Ready for dispatch</div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-500 text-xs font-medium">
            <span>On Lunch / Break</span>
            <Coffee size={16} />
          </div>
          <div className="text-2xl font-bold text-amber-500 mt-2">{onBreakCount}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Paused dispatch</div>
        </div>

        <div className={`border rounded-2xl p-4 shadow-xs transition-colors ${overrunAgents.length > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-card border-border'}`}>
          <div className="flex items-center justify-between text-rose-500 text-xs font-medium">
            <span>Break Overruns</span>
            <AlertTriangle size={16} className={overrunAgents.length > 0 ? 'animate-bounce' : ''} />
          </div>
          <div className="text-2xl font-bold text-rose-500 mt-2">{overrunAgents.length}</div>
          <div className="text-[10px] text-rose-400 mt-1">
            {overrunAgents.length > 0 ? 'Exceeding schedule' : 'Zero violations'}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-violet-500 text-xs font-medium">
            <span>Shift Adherence</span>
            <TrendingUp size={16} />
          </div>
          <div className="text-2xl font-bold text-violet-500 mt-2">{avgAdherence}%</div>
          <div className="text-[10px] text-muted-foreground mt-1">Team average score</div>
        </div>
      </div>

      {/* Live Presence & Countdown Timers Grid */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Clock size={16} className="text-violet-500" />
              Live Presence &amp; Break Countdown Timers
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time workforce activity with countdowns and automatic return indicators
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            {['ALL', 'ONLINE', 'BREAK', 'LUNCH', 'OFFLINE'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterPresence(status)}
                className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                  filterPresence === status
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
          {filteredAgents.map((agent) => {
            const countdown = formatCountdown(agent.breakExpectedEndAt);
            const isOnBreak = agent.presence === 'BREAK' || agent.presence === 'LUNCH';

            return (
              <div
                key={agent.id}
                className={`p-4 rounded-xl border transition-all ${
                  countdown?.isOverrun
                    ? 'bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/30'
                    : 'bg-muted/30 border-border hover:border-violet-500/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-foreground">{agent.name}</h3>
                    <p className="text-[10px] text-muted-foreground">{agent.email}</p>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      agent.presence === 'ONLINE'
                        ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25'
                        : agent.presence === 'LUNCH'
                        ? 'bg-amber-500/15 text-amber-500 border border-amber-500/25'
                        : agent.presence === 'BREAK'
                        ? 'bg-violet-500/15 text-violet-500 border border-violet-500/25'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    {agent.presence}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-3 pt-2 border-t border-border">
                  <span>Active Chats: <strong className="text-foreground">{agent.activeChatCount}</strong>/{agent.maxConcurrentChats}</span>
                  <span className="text-[10px] uppercase font-mono">{agent.role}</span>
                </div>

                {/* Countdown Timer or Overrun Alert */}
                {isOnBreak && countdown && (
                  <div
                    className={`mt-2.5 p-2 rounded-lg text-xs font-semibold flex items-center justify-between ${
                      countdown.isOverrun
                        ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30 animate-pulse'
                        : 'bg-amber-500/15 text-amber-500 border border-amber-500/25'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {agent.presence === 'LUNCH' ? <Utensils size={13} /> : <Coffee size={13} />}
                      <span>{countdown.text}</span>
                    </div>
                    {countdown.isOverrun && (
                      <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                        Overrun
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Shift Adherence Summary Table */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
        <div className="pb-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <TrendingUp size={16} className="text-violet-500" />
            Frontline Shift Adherence &amp; Overrun Tracking
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aggregated break sessions, overrun minutes, and adherence compliance scores
          </p>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-[11px] uppercase tracking-wider bg-muted/40">
                <th className="py-2.5 px-3 rounded-l-lg">Agent</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Total Breaks</th>
                <th className="py-2.5 px-3">Break Duration</th>
                <th className="py-2.5 px-3">Overrun</th>
                <th className="py-2.5 px-3">Auto-Reverts</th>
                <th className="py-2.5 px-3 rounded-r-lg">Adherence Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {adherenceRecords.map((record) => (
                <tr key={record.agentId} className="hover:bg-accent/40 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-foreground">{record.agentName}</div>
                    <div className="text-[10px] text-muted-foreground">{record.email}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        record.presence === 'ONLINE'
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : record.presence === 'LUNCH'
                          ? 'bg-amber-500/15 text-amber-500'
                          : record.presence === 'BREAK'
                          ? 'bg-violet-500/15 text-violet-500'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {record.presence}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-medium">{record.totalBreaks} sessions</td>
                  <td className="py-3 px-3 font-medium">{record.totalBreakMinutes} min</td>
                  <td className="py-3 px-3 font-medium">
                    {record.overrunMinutes > 0 ? (
                      <span className="text-rose-500 font-bold">+{record.overrunMinutes} min</span>
                    ) : (
                      <span className="text-emerald-500">0 min</span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-medium">{record.autoRevertedCount} times</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold ${
                          record.adherenceScore >= 90
                            ? 'text-emerald-500'
                            : record.adherenceScore >= 75
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }`}
                      >
                        {record.adherenceScore}%
                      </span>
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            record.adherenceScore >= 90
                              ? 'bg-emerald-500'
                              : record.adherenceScore >= 75
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${record.adherenceScore}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
