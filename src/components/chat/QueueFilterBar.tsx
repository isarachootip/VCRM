'use client';

import React from 'react';
import { 
  Search, 
  RotateCw, 
  Filter, 
  MessageSquare, 
  Tag, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Flame, 
  Building2,
  ChevronRight
} from 'lucide-react';

export interface CaseListItem {
  id: string;
  caseNumber: string;
  title: string;
  businessUnit: string;
  bu?: string;
  channel: string;
  pageName?: string;
  pageId?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  isVip?: boolean;
  vipTier?: string | null;
  queuePriority?: number;
  customerId?: string;
  customer?: {
    id?: string;
    name?: string;
    displayName?: string;
    avatarUrl?: string | null;
    isVip?: boolean;
    vipTier?: string | null;
  };
  latestMessage?: {
    text?: string;
    content?: any;
    createdAt?: string;
  } | null;
  messages?: any[];
  updatedAt: string;
  createdAt: string;
}

export interface QueueFilterBarProps {
  cases: CaseListItem[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  selectedBU: string;
  onSelectBU: (bu: string) => void;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  countsByStatus?: Record<string, number>;
  countsByBU?: Record<string, number>;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const BUSINESS_UNITS = [
  { id: 'ALL', label: 'All BUs' },
  { id: 'Muji', label: 'Muji' },
  { id: 'SSP', label: 'Supersports (SSP)' },
  { id: 'B2S', label: 'B2S' },
];

const STATUS_TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'OPEN', label: 'Open' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'RESOLVED', label: 'Resolved' },
  { id: 'CLOSED', label: 'Closed' },
];

export const QueueFilterBar: React.FC<QueueFilterBarProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  selectedBU,
  onSelectBU,
  selectedStatus,
  onSelectStatus,
  searchQuery,
  onSearchChange,
  countsByStatus = {},
  isLoading = false,
  onRefresh,
}) => {
  // Format relative timestamp
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Channel badge renderer
  const renderChannelBadge = (channel: string) => {
    const ch = (channel || '').toUpperCase();
    if (ch.includes('LINE')) {
      return (
        <span 
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white bg-[#06C755] shadow-xs"
          title="LINE Official Account"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
          LINE
        </span>
      );
    }
    if (ch.includes('FB') || ch.includes('MESSENGER')) {
      return (
        <span 
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white bg-[#0084FF] shadow-xs"
          title="Facebook Messenger"
        >
          FB
        </span>
      );
    }
    if (ch.includes('IG') || ch.includes('INSTAGRAM')) {
      return (
        <span 
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-xs"
          title="Instagram Direct"
        >
          IG
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200">
        {channel || 'CHAT'}
      </span>
    );
  };

  // Priority indicator renderer
  const renderPriorityBadge = (priority: string) => {
    const p = (priority || '').toUpperCase();
    switch (p) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-300">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
            MED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
            LOW
          </span>
        );
    }
  };

  // Status badge
  const renderStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'OPEN':
        return <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">OPEN</span>;
      case 'IN_PROGRESS':
        return <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">IN PROGRESS</span>;
      case 'RESOLVED':
        return <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">RESOLVED</span>;
      case 'CLOSED':
        return <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">CLOSED</span>;
      default:
        return <span className="text-[10px] text-slate-500">{status}</span>;
    }
  };

  const [vipOnly, setVipOnly] = React.useState(false);

  // Filter and sort cases client-side
  const filteredCases = cases
    .filter((item) => {
      // BU filter
      if (selectedBU !== 'ALL') {
        const itemBU = (item.businessUnit || item.bu || '').toLowerCase();
        const targetBU = selectedBU.toLowerCase();
        if (!itemBU.includes(targetBU) && !targetBU.includes(itemBU)) {
          return false;
        }
      }
      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'VIP') {
          if (!item.isVip && !item.customer?.isVip) return false;
        } else {
          const itemStatus = (item.status || '').toUpperCase();
          if (itemStatus !== selectedStatus) {
            return false;
          }
        }
      }
      // VIP Only Filter Chip
      if (vipOnly) {
        if (!item.isVip && !item.customer?.isVip) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const caseNo = (item.caseNumber || '').toLowerCase();
        const title = (item.title || '').toLowerCase();
        const customerName = (item.customer?.displayName || item.customer?.name || '').toLowerCase();
        if (!caseNo.includes(q) && !title.includes(q) && !customerName.includes(q)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      // Priority sorting: VIP & queuePriority jump ahead
      const prioA = (a.isVip || a.customer?.isVip ? 100 : 0) + (a.queuePriority || 0);
      const prioB = (b.isVip || b.customer?.isVip ? 100 : 0) + (b.queuePriority || 0);
      if (prioB !== prioA) {
        return prioB - prioA;
      }
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });

  return (
    <aside className="w-80 md:w-96 flex flex-col h-full bg-white border-r border-slate-200 select-none shrink-0 overflow-hidden">
      {/* Top Header: Desk Title & Refresh */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#ff7a59] text-white flex items-center justify-center font-bold shadow-xs">
            <MessageSquare size={16} />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Omnichannel Queues
            </h2>
            <p className="text-[11px] text-slate-500">
              Omnichannel Sales Desk
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh Queue"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition-colors disabled:opacity-50"
        >
          <RotateCw size={15} className={isLoading ? 'animate-spin text-[#ff7a59]' : ''} />
        </button>
      </div>

      {/* Business Unit Selector Dropdown */}
      <div className="p-2.5 border-b border-slate-100 bg-white">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
          Business Unit
        </label>
        <div className="relative">
          <select
            value={selectedBU}
            onChange={(e) => onSelectBU(e.target.value)}
            className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400 cursor-pointer appearance-none pr-7 hover:border-slate-300 transition-colors"
          >
            {BUSINESS_UNITS.map((bu) => (
              <option key={bu.id} value={bu.id}>
                {bu.label}
              </option>
            ))}
          </select>
          <Building2 size={13} className="absolute right-2.5 top-2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Status Filter Tabs with Counts */}
      <div className="px-2 pt-2 pb-1 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-xs">
          {STATUS_TABS.map((tab) => {
            const count = tab.id === 'ALL' ? cases.length : (countsByStatus[tab.id] ?? cases.filter(c => c.status === tab.id).length);
            const isActive = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectStatus(tab.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1 rounded-full font-bold ${
                    isActive ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Input Bar & Quick Filter Chips */}
      <div className="p-2.5 border-b border-slate-200 bg-white">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
          <input
            type="text"
            placeholder="Search case # or customer..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Quick Filter Chips (NSC VIP) */}
        <div className="flex items-center gap-1.5 mt-2">
          <button
            type="button"
            onClick={() => setVipOnly(!vipOnly)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
              vipOnly
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
            }`}
          >
            <span>⭐ NSC VIP Only</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                vipOnly ? 'bg-amber-600 text-white' : 'bg-amber-200 text-amber-900'
              }`}
            >
              {cases.filter((c) => c.isVip || c.customer?.isVip).length}
            </span>
          </button>
        </div>
      </div>

      {/* Case List Stream */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
        {filteredCases.length === 0 ? (
          <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
            <MessageSquare size={32} className="text-slate-300 mb-2 stroke-[1.5]" />
            <p className="text-xs font-semibold text-slate-600">No cases found</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
              No active conversations matching your current queue filters.
            </p>
          </div>
        ) : (
          filteredCases.map((item) => {
            const isSelected = item.id === selectedCaseId;
            const isVipCase = Boolean(item.isVip || item.customer?.isVip);
            const customerName = item.customer?.displayName || item.customer?.name || 'Customer';
            const avatarUrl = item.customer?.avatarUrl;
            const previewText = item.latestMessage?.text || (item.messages && item.messages.length > 0 ? (item.messages[item.messages.length - 1].text || item.messages[item.messages.length - 1].type) : null) || item.title || 'Incoming chat session...';

            return (
              <div
                key={item.id}
                onClick={() => onSelectCase(item.id)}
                className={`p-3 cursor-pointer transition-colors relative border-l-4 ${
                  isSelected
                    ? 'bg-orange-50/70 border-[#ff7a59]'
                    : isVipCase
                    ? 'bg-amber-50/30 border-amber-400 hover:bg-amber-50/50'
                    : 'hover:bg-slate-50/80 border-transparent'
                }`}
              >
                {/* Row 1: Channel Badge, Case Number, VIP Badge, Timestamp */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {renderChannelBadge(item.channel)}
                    <span className="font-mono text-[11px] font-bold text-slate-700">
                      {item.caseNumber}
                    </span>
                    {isVipCase && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 shadow-xs border border-amber-300">
                        ⭐ {item.vipTier || item.customer?.vipTier || 'NSC_VIP'}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {formatTime(item.updatedAt || item.createdAt)}
                  </span>
                </div>

                {/* Row 2: Customer Avatar & Name & Priority */}
                <div className="flex items-center justify-between gap-2 my-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={customerName}
                        className="w-6 h-6 rounded-full object-cover shrink-0 border border-slate-200"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                        {customerName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {customerName}
                    </span>
                  </div>

                  {renderPriorityBadge(item.priority)}
                </div>

                {/* Row 3: Latest Message Preview Snippet */}
                <p className="text-[11px] text-slate-500 line-clamp-1 my-1 leading-relaxed">
                  {previewText}
                </p>

                {/* Row 4: Business Unit & Status */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100/60 mt-1.5 text-[10px]">
                  <span className="text-slate-500 font-medium truncate max-w-[140px]" title={item.businessUnit || item.bu}>
                    🏢 {item.businessUnit || item.bu || 'General'}
                  </span>
                  {renderStatusBadge(item.status)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Summary Indicator */}
      <div className="p-2 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Showing {filteredCases.length} of {cases.length} cases</span>
        <span className="text-emerald-600 font-medium flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Connected to Gateway
        </span>
      </div>
    </aside>
  );
};
