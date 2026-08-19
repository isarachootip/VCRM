'use client';

import React from 'react';
import { CRMGroup, CRMItem } from '@/types/crm';
import { 
  TrendingUp, 
  DollarSign, 
  Award, 
  PieChart, 
  Target, 
  Users, 
  CheckCircle,
  Briefcase
} from 'lucide-react';

interface DashboardViewProps {
  groups: CRMGroup[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ groups }) => {
  const allItems: CRMItem[] = groups.flatMap((g) => g.items);

  const totalPipelineValue = allItems.reduce((sum, i) => sum + (i.dealValue || 0), 0);
  const wonItems = allItems.filter((i) => i.status === 'Closed Won');
  const wonValue = wonItems.reduce((sum, i) => sum + (i.dealValue || 0), 0);
  const winRate = allItems.length ? Math.round((wonItems.length / allItems.length) * 100) : 0;
  const avgDealSize = allItems.length ? Math.round(totalPipelineValue / allItems.length) : 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val);
  };

  // Group by Stage
  const stageStats: Record<string, { count: number; value: number; color: string }> = {};
  allItems.forEach((i) => {
    if (!stageStats[i.status]) {
      stageStats[i.status] = { count: 0, value: 0, color: '#0073ea' };
    }
    stageStats[i.status].count += 1;
    stageStats[i.status].value += i.dealValue || 0;
  });

  // Group by Owner
  const ownerStats: Record<string, { count: number; value: number; avatar: string }> = {};
  allItems.forEach((i) => {
    const name = i.owner.name;
    if (!ownerStats[name]) {
      ownerStats[name] = { count: 0, value: 0, avatar: i.owner.avatar };
    }
    ownerStats[name].count += 1;
    ownerStats[name].value += i.dealValue || 0;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 1. Top KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pipeline */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Pipeline Value
            </span>
            <div className="text-2xl font-black text-gray-900 mt-1">
              {formatCurrency(totalPipelineValue)}
            </div>
            <span className="text-[11px] text-blue-600 font-medium mt-1 inline-block">
              {allItems.length} Active Deals
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Closed Won Value */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Closed Won Revenue
            </span>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {formatCurrency(wonValue)}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium mt-1 inline-block">
              {wonItems.length} Deals Closed
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle size={24} />
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Conversion / Win Rate
            </span>
            <div className="text-2xl font-black text-purple-600 mt-1">
              {winRate}%
            </div>
            <span className="text-[11px] text-gray-400 font-medium mt-1 inline-block">
              Won vs Total Opportunities
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Target size={24} />
          </div>
        </div>

        {/* Avg Deal Size */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Average Deal Size
            </span>
            <div className="text-2xl font-black text-gray-900 mt-1">
              {formatCurrency(avgDealSize)}
            </div>
            <span className="text-[11px] text-gray-400 font-medium mt-1 inline-block">
              Across all pipeline stages
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Briefcase size={24} />
          </div>
        </div>
      </div>

      {/* 2. Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deal Value by Stage */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
            <PieChart size={16} className="text-blue-600" />
            Pipeline Distribution by Stage
          </h3>

          <div className="space-y-3.5">
            {Object.entries(stageStats).map(([stage, stat]) => {
              const percentage = totalPipelineValue ? Math.round((stat.value / totalPipelineValue) * 100) : 0;
              return (
                <div key={stage}>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-gray-700 font-semibold">{stage} ({stat.count})</span>
                    <span className="text-gray-900 font-bold">{formatCurrency(stat.value)} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(percentage, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rep Performance */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
            <Users size={16} className="text-purple-600" />
            Sales Rep Pipeline Breakdown
          </h3>

          <div className="space-y-4">
            {Object.entries(ownerStats).map(([name, stat]) => {
              return (
                <div key={name} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{stat.avatar}</span>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">{name}</h4>
                      <span className="text-[11px] text-gray-500">{stat.count} Active Deals Managed</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-gray-900">{formatCurrency(stat.value)}</div>
                    <span className="text-[10px] text-emerald-600 font-bold">Quota on track</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Top High Value Opportunities Table */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-2">
          <Award size={16} className="text-amber-500" />
          Top High-Value Deals in Pipeline
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 font-semibold">
                <th className="py-2.5">Deal Name</th>
                <th className="py-2.5">Stage</th>
                <th className="py-2.5 text-right">Value</th>
                <th className="py-2.5 text-center">Probability</th>
                <th className="py-2.5">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...allItems]
                .sort((a, b) => b.dealValue - a.dealValue)
                .slice(0, 5)
                .map((deal) => (
                  <tr key={deal.id} className="hover:bg-gray-50">
                    <td className="py-2.5 font-bold text-gray-800">{deal.name}</td>
                    <td className="py-2.5">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {deal.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-extrabold text-emerald-600">
                      {formatCurrency(deal.dealValue)}
                    </td>
                    <td className="py-2.5 text-center font-bold text-gray-700">{deal.probability}%</td>
                    <td className="py-2.5 text-gray-600">{deal.owner.avatar} {deal.owner.name}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
