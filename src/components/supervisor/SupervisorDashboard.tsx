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

export const SupervisorDashboard: React.FC = () => {
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

  // Compute metrics
  const totalAgents = agents.length;
  const onlineCount = agents.filter((a) => a.presence === 'ONLINE').length;
  const onBreakCount = agents.filter(
    (a) => a.presence === 'BREAK' || a.presence === 'LUNCH'
  ).length;

  const overrunAgents = agents.filter((a) => {
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

  const filteredAgents = agents.filter((a) => {
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
    <div className="flex-1 bg-slate-900 text-slate-100 p-6 overflow-y-auto min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-orange-400" size={24} />
            <h1 className="text-xl font-bold text-white tracking-tight">
              Supervisor Workforce &amp; Shift Adherence Center
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Live shift monitoring, break countdown timers, automated reversion &amp; adherence analytics (R3)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleRunSweep}
            disabled={sweeping}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-md shadow-orange-900/30 transition-all active:scale-95 disabled:opacity-50"
          >
            <Zap size={13} className={sweeping ? 'animate-bounce' : ''} />
            <span>{sweeping ? 'Sweeping...' : 'Run Break Sweep'}</span>
          </button>
        </div>
      </div>

      {sweepResult && (
        <div className="mt-4 p-3 rounded-lg bg-orange-950/40 border border-orange-700/50 text-orange-200 text-xs flex items-center justify-between">
          <span>{sweepResult}</span>
          <button
            onClick={() => setSweepResult(null)}
            className="text-orange-400 hover:text-orange-200 text-sm font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 my-6">
        <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Agents</span>
            <Users size={16} />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{totalAgents}</div>
          <div className="text-[10px] text-slate-400 mt-1">Configured staff</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-4">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
            <span>Online &amp; Active</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{onlineCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">Ready for dispatch</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-4">
          <div className="flex items-center justify-between text-amber-400 text-xs font-medium">
            <span>On Lunch / Break</span>
            <Coffee size={16} />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">{onBreakCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">Paused dispatch</div>
        </div>

        <div className={`border rounded-lg p-4 transition-colors ${overrunAgents.length > 0 ? 'bg-red-950/40 border-red-600/60' : 'bg-slate-800/80 border-slate-700/70'}`}>
          <div className="flex items-center justify-between text-red-400 text-xs font-medium">
            <span>Break Overruns</span>
            <AlertTriangle size={16} className={overrunAgents.length > 0 ? 'animate-bounce' : ''} />
          </div>
          <div className="text-2xl font-bold text-red-400 mt-2">{overrunAgents.length}</div>
          <div className="text-[10px] text-red-300/80 mt-1">
            {overrunAgents.length > 0 ? 'Exceeding schedule' : 'Zero violations'}
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-4">
          <div className="flex items-center justify-between text-purple-400 text-xs font-medium">
            <span>Shift Adherence</span>
            <TrendingUp size={16} />
          </div>
          <div className="text-2xl font-bold text-purple-300 mt-2">{avgAdherence}%</div>
          <div className="text-[10px] text-slate-400 mt-1">Team average score</div>
        </div>
      </div>

      {/* Live Presence & Countdown Timers Grid */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-lg p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-700/60 gap-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-orange-400" />
              Live Presence &amp; Break Countdown Timers
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time workforce activity with countdowns and automatic return indicators
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            {['ALL', 'ONLINE', 'BREAK', 'LUNCH', 'OFFLINE'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterPresence(status)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  filterPresence === status
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
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
                className={`p-3.5 rounded-lg border transition-all ${
                  countdown?.isOverrun
                    ? 'bg-red-950/20 border-red-500/60 ring-1 ring-red-500/40'
                    : 'bg-slate-800/90 border-slate-700/60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white">{agent.name}</h3>
                    <p className="text-[10px] text-slate-400">{agent.email}</p>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      agent.presence === 'ONLINE'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : agent.presence === 'LUNCH'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : agent.presence === 'BREAK'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-slate-700/60 text-slate-400 border border-slate-600'
                    }`}
                  >
                    {agent.presence}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-700/40">
                  <span>Active Chats: <strong className="text-white">{agent.activeChatCount}</strong>/{agent.maxConcurrentChats}</span>
                  <span className="text-[10px] uppercase font-mono">{agent.role}</span>
                </div>

                {/* Countdown Timer or Overrun Alert */}
                {isOnBreak && countdown && (
                  <div
                    className={`mt-2.5 p-2 rounded text-xs font-semibold flex items-center justify-between ${
                      countdown.isOverrun
                        ? 'bg-red-900/40 text-red-300 border border-red-700/60 animate-pulse'
                        : 'bg-amber-950/30 text-amber-300 border border-amber-700/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {agent.presence === 'LUNCH' ? <Utensils size={13} /> : <Coffee size={13} />}
                      <span>{countdown.text}</span>
                    </div>
                    {countdown.isOverrun && (
                      <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.2 rounded uppercase font-bold tracking-wider">
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
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-lg p-5">
        <div className="pb-4 border-b border-slate-700/60">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp size={16} className="text-orange-400" />
            Frontline Shift Adherence &amp; Overrun Tracking
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Aggregated break sessions, overrun minutes, and adherence compliance scores
          </p>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Agent</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Total Breaks</th>
                <th className="py-2.5 px-3">Break Duration</th>
                <th className="py-2.5 px-3">Overrun</th>
                <th className="py-2.5 px-3">Auto-Reverts</th>
                <th className="py-2.5 px-3">Adherence Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {adherenceRecords.map((record) => (
                <tr key={record.agentId} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-white">{record.agentName}</div>
                    <div className="text-[10px] text-slate-400">{record.email}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        record.presence === 'ONLINE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : record.presence === 'LUNCH'
                          ? 'bg-amber-500/20 text-amber-400'
                          : record.presence === 'BREAK'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {record.presence}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-medium">{record.totalBreaks} sessions</td>
                  <td className="py-3 px-3 font-medium">{record.totalBreakMinutes} min</td>
                  <td className="py-3 px-3 font-medium">
                    {record.overrunMinutes > 0 ? (
                      <span className="text-red-400 font-bold">+{record.overrunMinutes} min</span>
                    ) : (
                      <span className="text-emerald-400">0 min</span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-medium">{record.autoRevertedCount} times</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold ${
                          record.adherenceScore >= 90
                            ? 'text-emerald-400'
                            : record.adherenceScore >= 75
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }`}
                      >
                        {record.adherenceScore}%
                      </span>
                      <div className="w-16 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            record.adherenceScore >= 90
                              ? 'bg-emerald-500'
                              : record.adherenceScore >= 75
                              ? 'bg-amber-500'
                              : 'bg-red-500'
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
