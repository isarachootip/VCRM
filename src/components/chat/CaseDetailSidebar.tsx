'use client';

import React, { useState } from 'react';
import { 
  User, 
  Phone, 
  Mail, 
  Clock, 
  Calendar, 
  ShieldAlert, 
  Star, 
  CheckCircle2, 
  AlertTriangle, 
  History, 
  Tag, 
  ChevronRight, 
  ExternalLink, 
  X, 
  Send, 
  Bot, 
  CheckCheck, 
  Sparkles,
  Award,
  BarChart,
  Lock,
  Layers,
  HelpCircle,
  ArrowRightLeft,
  ShoppingBag,
  TrendingUp,
  Compass,
  Truck,
  Package,
  Copy,
  Check
} from 'lucide-react';
import { TransferModal } from './TransferModal';

export interface CaseDetail {
  id: string;
  caseNumber: string;
  title: string;
  businessUnit: string;
  channel: string;
  pageId?: string;
  pageName?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  queueId?: string;
  ownerId?: string | null;
  customerId?: string;
  sessionId?: string | null;
  resolutionCategory?: string | null;
  resolutionNotes?: string | null;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  isVip?: boolean;
  vipTier?: string | null;
  queuePriority?: number;
  customer?: {
    id?: string;
    displayName?: string;
    name?: string;
    channelUserId?: string;
    externalId?: string;
    phone?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    channel?: string;
    isVip?: boolean;
    vipTier?: string | null;
  };
  session?: {
    sessionId?: string;
    inboundSource?: string;
    sessionStart?: string;
    sessionEnd?: string | null;
    botState?: string;
  } | null;
  queue?: {
    id?: string;
    name?: string;
    code?: string;
    businessUnit?: string;
  } | null;
  owner?: {
    id?: string;
    name?: string;
    email?: string;
  } | null;
  surveyStatus?: string | null;
  distributionId?: string | null;
  csatScore?: number | null;
  npsScore?: number | null;
  cesScore?: number | null;
  feedbackComment?: string | null;
  supervisorAlert?: boolean;
  auditLogs?: any[];
  shippingFulfillment?: any;
  trackingNumber?: string;
  quotations?: any[];
}

export interface CaseDetailSidebarProps {
  caseData: CaseDetail;
  onStatusChange: (
    newStatus: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
    meta?: { closureReason?: string; resolutionNotes?: string; resolutionCategory?: string }
  ) => Promise<void>;
  onAssignChange?: (meta: { ownerId?: string; queueId?: string; priority?: string }) => Promise<void>;
  isUpdating?: boolean;
  onCloseSidebar?: () => void;
}

export const CaseDetailSidebar: React.FC<CaseDetailSidebarProps> = ({
  caseData,
  onStatusChange,
  onAssignChange,
  isUpdating = false,
  onCloseSidebar,
}) => {
  // Case Closure Modal State
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [closureReason, setClosureReason] = useState('RESOLVED_BY_AGENT');
  const [resolutionCategory, setResolutionCategory] = useState('Product Advisory');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'audit'>('details');
  const [customer360, setCustomer360] = useState<any>(null);
  const [loading360, setLoading360] = useState<boolean>(false);
  const [isVipState, setIsVipState] = useState<boolean>(Boolean(caseData.isVip || caseData.customer?.isVip));
  const [vipLoading, setVipLoading] = useState<boolean>(false);
  const [deliveryEvents, setDeliveryEvents] = useState<any[]>([]);
  const [loadingTracking, setLoadingTracking] = useState<boolean>(false);
  const [copiedTracking, setCopiedTracking] = useState<boolean>(false);

  // Active fulfillment resolution from caseData, quotations, or direct trackingNumber
  const activeFulfillment =
    caseData.shippingFulfillment ||
    caseData.quotations?.find((q: any) => q.shippingFulfillment)?.shippingFulfillment ||
    (caseData.quotations?.find((q: any) => q.posTicketNumber)?.posTicketNumber ? {
      trackingNumber: caseData.quotations.find((q: any) => q.posTicketNumber)!.posTicketNumber!,
      carrier: caseData.quotations.find((q: any) => q.posTicketNumber)!.posTicketNumber!.startsWith('KEX')
        ? 'KERRY'
        : caseData.quotations.find((q: any) => q.posTicketNumber)!.posTicketNumber!.startsWith('TH')
        ? 'FLASH'
        : 'FLASH',
      status: 'IN_TRANSIT',
    } : null) ||
    (caseData.trackingNumber ? {
      trackingNumber: caseData.trackingNumber,
      carrier: 'KERRY',
      status: 'IN_TRANSIT',
    } : null);

  React.useEffect(() => {
    const trackNo = activeFulfillment?.trackingNumber;
    if (trackNo) {
      setLoadingTracking(true);
      fetch(`/api/shipping/tracking/${encodeURIComponent(trackNo)}/events`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.events && Array.isArray(data.events)) {
            setDeliveryEvents(data.events);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingTracking(false));
    }
  }, [activeFulfillment?.trackingNumber]);

  const handleCopyTrackingLink = (trackingNumber: string, trackingUrl?: string) => {
    const url = trackingUrl || `https://th.kerryexpress.com/en/track/?track=${encodeURIComponent(trackingNumber)}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  React.useEffect(() => {
    setIsVipState(Boolean(caseData.isVip || caseData.customer?.isVip));
  }, [caseData.isVip, caseData.customer?.isVip]);

  const handleToggleVip = async () => {
    const custId = caseData.customer?.id || caseData.customerId;
    if (!custId) return;
    setVipLoading(true);
    try {
      const nextVip = !isVipState;
      const res = await fetch(`/api/customers/${custId}/vip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Role': 'ADMIN' },
        body: JSON.stringify({
          isVip: nextVip,
          vipTier: nextVip ? 'NSC_VIP' : null,
          reason: nextVip ? 'Toggled via Case Detail Sidebar' : 'Revoked via Case Detail Sidebar',
        }),
      });
      if (res.ok) {
        setIsVipState(nextVip);
      }
    } catch (err) {
      console.error('Failed to toggle VIP status:', err);
    } finally {
      setVipLoading(false);
    }
  };

  const customer = caseData.customer;
  const customerName = customer?.displayName || customer?.name || 'Customer';
  const customerId = customer?.channelUserId || customer?.externalId || caseData.customerId || '—';
  const session = caseData.session;
  const isClosed = caseData.status === 'CLOSED';

  // Fetch Customer 360 profile
  React.useEffect(() => {
    const custId = caseData.customerId || caseData.customer?.id || caseData.id;
    if (!custId) return;
    let isMounted = true;
    setLoading360(true);
    fetch(`/api/customers/${custId}/360`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.customer) {
          setCustomer360(data.customer);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading360(false);
      });
    return () => {
      isMounted = false;
    };
  }, [caseData.customerId, caseData.customer?.id, caseData.id]);

  // Format date helper
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Handle Closure Submit
  const handleConfirmClose = async () => {
    await onStatusChange('CLOSED', {
      closureReason,
      resolutionCategory,
      resolutionNotes,
    });
    setIsClosureModalOpen(false);
  };

  // Render CSAT Stars
  const renderStars = (score?: number | null) => {
    if (!score) return null;
    return (
      <div className="flex items-center gap-1 text-amber-400">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            size={16}
            className={s <= score ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
          />
        ))}
        <span className="ml-1 text-xs font-bold text-slate-700">{score}/5</span>
      </div>
    );
  };

  return (
    <aside className="w-80 md:w-88 flex flex-col h-full bg-white border-l border-slate-200 select-none shrink-0 overflow-hidden">
      {/* Top Header */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
            CAS
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 font-mono">
              {caseData.caseNumber}
            </h3>
            <p className="text-[10px] text-slate-500">Case &amp; Session Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onCloseSidebar && (
            <button
              onClick={onCloseSidebar}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded"
              title="Close Sidebar"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs: Details vs Audit Trail */}
      <div className="flex border-b border-slate-200 text-xs font-semibold bg-white">
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-2 text-center border-b-2 transition-all ${
            activeTab === 'details'
              ? 'border-orange-500 text-orange-600 font-bold bg-orange-50/30'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Case Details
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-2 text-center border-b-2 transition-all ${
            activeTab === 'audit'
              ? 'border-orange-500 text-orange-600 font-bold bg-orange-50/30'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Audit History ({caseData.auditLogs?.length || 0})
        </button>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'details' ? (
          <>
            {/* Status & Lifecycle Actions */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Lifecycle Status
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    caseData.status === 'OPEN'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : caseData.status === 'IN_PROGRESS'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : caseData.status === 'RESOLVED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {caseData.status}
                </span>
              </div>

              {/* Status Action Buttons */}
              <div className="pt-1 flex flex-col gap-1.5">
                {caseData.status === 'OPEN' && (
                  <button
                    onClick={() => onStatusChange('IN_PROGRESS')}
                    disabled={isUpdating}
                    className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <ChevronRight size={14} />
                    Accept &amp; Start Work
                  </button>
                )}

                {caseData.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => onStatusChange('RESOLVED')}
                    disabled={isUpdating}
                    className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={14} />
                    Mark as Resolved
                  </button>
                )}

                {!isClosed && (
                  <button
                    onClick={() => setIsTransferModalOpen(true)}
                    disabled={isUpdating}
                    className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <ArrowRightLeft size={13} />
                    Transfer to CS / COL
                  </button>
                )}

                {!isClosed && (
                  <button
                    onClick={() => setIsClosureModalOpen(true)}
                    disabled={isUpdating}
                    className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Lock size={13} />
                    Close Case &amp; Trigger Survey
                  </button>
                )}

                {isClosed && (
                  <div className="p-2 bg-slate-100 rounded-lg text-[11px] text-slate-600 flex items-center gap-1.5">
                    <Lock size={13} className="text-slate-500" />
                    <span>Case closed and locked. Bot state reset sent.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Qualtrics CSAT Reporting Card */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Award size={15} className="text-orange-500" />
                  <span className="text-xs font-bold text-slate-800">
                    Qualtrics CSAT Reporting
                  </span>
                </div>
                {caseData.surveyStatus && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      caseData.surveyStatus === 'RESPONDED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : caseData.surveyStatus === 'DISPATCHED' || caseData.surveyStatus === 'SENT'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {caseData.surveyStatus}
                  </span>
                )}
              </div>

              {/* Red Alert Banner if CSAT <= 2 */}
              {(caseData.supervisorAlert || (caseData.csatScore !== null && caseData.csatScore !== undefined && caseData.csatScore <= 2)) && (
                <div className="p-2.5 bg-red-50 border-2 border-red-300 rounded-lg text-red-900 text-xs font-bold flex items-start gap-2 shadow-xs">
                  <ShieldAlert size={16} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold text-red-800">⚠️ Low CSAT Alert</p>
                    <p className="text-[11px] font-medium text-red-700 mt-0.5">
                      Customer satisfaction score &le; 2. Flagged for immediate supervisor review.
                    </p>
                  </div>
                </div>
              )}

              {/* Score Display */}
              {caseData.csatScore !== null && caseData.csatScore !== undefined ? (
                <div className="space-y-2 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">CSAT Rating</span>
                    {renderStars(caseData.csatScore)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    {caseData.npsScore !== null && caseData.npsScore !== undefined && (
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">NPS Score</span>
                        <span className="font-bold text-slate-800 text-sm">{caseData.npsScore} / 10</span>
                      </div>
                    )}
                    {caseData.cesScore !== null && caseData.cesScore !== undefined && (
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">CES Effort</span>
                        <span className="font-bold text-slate-800 text-sm">{caseData.cesScore} / 5</span>
                      </div>
                    )}
                  </div>

                  {caseData.feedbackComment && (
                    <div className="p-2.5 bg-amber-50/60 rounded-lg border border-amber-200/80 text-xs text-amber-950 mt-2">
                      <span className="text-[10px] text-amber-800 font-semibold block">Customer Feedback:</span>
                      <p className="italic mt-0.5">"{caseData.feedbackComment}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 py-1 flex items-center gap-1.5">
                  <Clock size={13} />
                  <span>
                    {caseData.surveyStatus
                      ? `Survey ${caseData.surveyStatus.toLowerCase()} — awaiting response`
                      : 'Survey will be dispatched automatically upon case closure'}
                  </span>
                </div>
              )}
            </div>

            {/* Customer Profile Card */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Customer Profile
              </span>

              <div className="flex items-center gap-2.5">
                {customer?.avatarUrl ? (
                  <img
                    src={customer.avatarUrl}
                    alt={customerName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-sm">
                    {customerName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-xs truncate">{customerName}</p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">{customerId}</p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 text-xs text-slate-600 pt-1">
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-400">Channel</span>
                  <span className="font-semibold text-slate-800">{caseData.channel}</span>
                </div>
                {customer?.phone && (
                  <div className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1"><Phone size={11} /> Phone</span>
                    <span className="font-mono text-slate-800">{customer.phone}</span>
                  </div>
                )}
                {customer?.email && (
                  <div className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1"><Mail size={11} /> Email</span>
                    <span className="text-slate-800 truncate max-w-[150px]">{customer.email}</span>
                  </div>
                )}
                <div className="py-2 flex items-center justify-between border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={13} className={isVipState ? "text-amber-500 fill-amber-400" : "text-slate-400"} />
                    <span className="text-xs font-semibold text-slate-700">VIP Status</span>
                    {isVipState && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 border border-amber-400 shadow-xs">
                        NSC_VIP
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleVip}
                    disabled={vipLoading}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isVipState ? 'bg-amber-500' : 'bg-slate-300'
                    } disabled:opacity-50`}
                    title="Toggle VIP Customer Status"
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isVipState ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Customer 360 Behavioral Analytics Card (R5 - Phase 2) */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-500" />
                  Customer 360 Profile
                </span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    customer360?.loyaltyTier === 'PLATINUM'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : customer360?.loyaltyTier === 'GOLD'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : customer360?.loyaltyTier === 'SILVER'
                      ? 'bg-slate-100 text-slate-700 border-slate-300'
                      : 'bg-orange-50 text-orange-700 border-orange-200'
                  }`}
                >
                  {customer360?.loyaltyTier || 'BRONZE'} TIER
                </span>
              </div>

              {/* 4-Metric Grid: LTV, AOV, CES, Frequency */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-semibold flex items-center gap-1">
                    <TrendingUp size={11} className="text-emerald-500" /> Lifetime Value (LTV)
                  </span>
                  <span className="font-extrabold text-slate-800 text-xs">
                    ฿{Number(customer360?.ltv ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-semibold flex items-center gap-1">
                    <ShoppingBag size={11} className="text-blue-500" /> Average Order (AOV)
                  </span>
                  <span className="font-extrabold text-slate-800 text-xs">
                    ฿{Number(customer360?.aov ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-semibold flex items-center gap-1">
                    <Award size={11} className="text-amber-500" /> Engagement (CES)
                  </span>
                  <span className="font-extrabold text-slate-800 text-xs">
                    {customer360?.customerEngagementScore ?? 70} / 100
                  </span>
                </div>

                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-semibold flex items-center gap-1">
                    <Compass size={11} className="text-purple-500" /> Order Frequency
                  </span>
                  <span className="font-extrabold text-slate-800 text-xs">
                    {customer360?.purchaseFrequency ?? 0} / mo
                  </span>
                </div>
              </div>

              {/* Channel Preference & Loyalty Metadata */}
              <div className="divide-y divide-slate-100 text-xs text-slate-600 pt-1">
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-400">Preferred Channel</span>
                  <span className="font-bold text-slate-800">
                    {customer360?.preferredChannel || caseData.channel}
                  </span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-400">Completed Orders</span>
                  <span className="font-medium text-slate-800">
                    {customer360?.paidOrderCount ?? 0} paid ({customer360?.totalOrders ?? 0} total)
                  </span>
                </div>
                {customer360?.the1CardNumber && (
                  <div className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-400">The 1 Card</span>
                    <span className="font-mono text-slate-800 text-[11px]">{customer360.the1CardNumber}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Tracking & Timeline Stepper Card (R2 - Phase 3) */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Truck size={14} className="text-blue-600" />
                  Delivery Management
                </span>
                {activeFulfillment ? (
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      activeFulfillment.status === 'DELIVERED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : activeFulfillment.status === 'DELIVERY_FAILED'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : activeFulfillment.status === 'OUT_FOR_DELIVERY'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {activeFulfillment.status || 'PENDING'}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    NO FULFILLMENT
                  </span>
                )}
              </div>

              {activeFulfillment ? (
                <>
                  {/* Carrier & Tracking Meta */}
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Courier Partner:</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <Package size={13} className="text-slate-500" />
                        {activeFulfillment.carrier === 'KERRY'
                          ? 'Kerry Express'
                          : activeFulfillment.carrier === 'FLASH'
                          ? 'Flash Express'
                          : activeFulfillment.carrier === 'FLASH'
                          ? 'Flash Express'
                          : activeFulfillment.carrier || 'Kerry Express'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium">Tracking Number:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900 text-[11px]">
                          {activeFulfillment.trackingNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyTrackingLink(activeFulfillment.trackingNumber, activeFulfillment.trackingUrl)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
                          title="Copy tracking link"
                        >
                          {copiedTracking ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        </button>
                        <a
                          href={
                            activeFulfillment.trackingUrl ||
                            `https://th.kerryexpress.com/en/track/?track=${encodeURIComponent(activeFulfillment.trackingNumber)}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          title="Open Tracking Portal"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                      <span className="text-slate-500">Estimated Delivery:</span>
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <Calendar size={11} className="text-slate-400" />
                        {activeFulfillment.estimatedDelivery
                          ? formatDate(activeFulfillment.estimatedDelivery)
                          : 'Within 24 - 48 hours'}
                      </span>
                    </div>
                  </div>

                  {/* Delivery Failed Alert Banner if applicable */}
                  {activeFulfillment.status === 'DELIVERY_FAILED' && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle size={13} className="text-rose-600" />
                        Delivery Attempt Failed
                      </div>
                      <p className="text-[11px] text-rose-700 leading-tight">
                        Carrier reported delivery failure. Frontline agent follow-up required to verify customer contact and reschedule.
                      </p>
                    </div>
                  )}

                  {/* Vertical Stepper Timeline */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Delivery Milestones Timeline
                      </span>
                      {loadingTracking && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock size={10} className="animate-spin" /> Syncing...
                        </span>
                      )}
                    </div>

                    <div className="relative pl-5 border-l-2 border-slate-200 space-y-3.5 my-1">
                      {[
                        { key: 'PACKED', label: 'Packed & Dispatched', sub: 'เตรียมพัสดุเรียบร้อย' },
                        { key: 'PICKED_UP', label: 'Carrier Picked Up', sub: 'ขนส่งเข้ารับพัสดุ' },
                        { key: 'IN_TRANSIT', label: 'In Transit', sub: 'อยู่ระหว่างนำส่ง' },
                        { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', sub: 'กำลังนำจ่ายถึงผู้รับ' },
                        { key: 'DELIVERED', label: 'Delivered', sub: 'จัดส่งสำเร็จ' },
                      ].map((step) => {
                        const rankOrder: Record<string, number> = {
                          PENDING: 0,
                          LABEL_GENERATED: 1,
                          PACKED: 2,
                          PICKED_UP: 3,
                          IN_TRANSIT: 4,
                          OUT_FOR_DELIVERY: 5,
                          DELIVERED: 6,
                          DELIVERY_FAILED: 5,
                        };

                        const currentRank = rankOrder[activeFulfillment.status] ?? 0;
                        const stepRank = rankOrder[step.key] ?? 0;
                        const isCompleted = currentRank >= stepRank && activeFulfillment.status !== 'DELIVERY_FAILED';
                        const isCurrent = activeFulfillment.status === step.key;

                        // Match against recorded events
                        const matchingEvent = deliveryEvents.find((e: any) => e.status === step.key);

                        return (
                          <div key={step.key} className="relative text-xs">
                            {/* Dot / Check Icon */}
                            <div
                              className={`absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full ring-4 ring-white flex items-center justify-center ${
                                isCompleted
                                  ? 'bg-emerald-500 text-white'
                                  : isCurrent
                                  ? 'bg-blue-600 text-white animate-pulse'
                                  : 'bg-slate-200 text-slate-400'
                              }`}
                            >
                              {isCompleted ? <Check size={8} strokeWidth={3} /> : <div className="w-1 h-1 rounded-full bg-current" />}
                            </div>

                            <div className="flex items-center justify-between">
                              <span
                                className={`font-semibold text-[11px] ${
                                  isCompleted || isCurrent ? 'text-slate-800 font-bold' : 'text-slate-400'
                                }`}
                              >
                                {step.label}
                              </span>
                              {matchingEvent?.timestamp && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {formatDate(matchingEvent.timestamp)}
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] text-slate-400 block">{step.sub}</span>

                            {matchingEvent && (
                              <div className="mt-1 p-1.5 bg-slate-50 rounded border border-slate-100 text-[10px] space-y-0.5">
                                {matchingEvent.location && (
                                  <div className="text-slate-600 font-medium flex items-center gap-1">
                                    <span className="text-slate-400">📍</span> {matchingEvent.location}
                                  </div>
                                )}
                                {matchingEvent.description && (
                                  <p className="text-slate-500 italic">{matchingEvent.description}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-3 bg-slate-50 rounded-lg text-center text-xs text-slate-400 space-y-1">
                  <Package size={20} className="mx-auto text-slate-300" />
                  <p className="font-medium text-slate-600">No active shipping fulfillment</p>
                  <p className="text-[11px]">Generate a shipping label once the quotation is paid to initiate courier tracking.</p>
                </div>
              )}
            </div>

            {/* Session Traffic Source & Bot Info */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Session &amp; Traffic Source
              </span>

              <div className="divide-y divide-slate-100 text-xs text-slate-600">
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-400">Session ID</span>
                  <span className="font-mono text-[10px] text-slate-700 truncate max-w-[140px]" title={session?.sessionId || caseData.sessionId || '—'}>
                    {session?.sessionId || caseData.sessionId || '—'}
                  </span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-400">Traffic Source</span>
                  <span className="font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded text-[10px]">
                    {session?.inboundSource || 'ORGANIC_CHAT'}
                  </span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-400">Session Start</span>
                  <span className="text-slate-700 text-[11px]">
                    {formatDate(session?.sessionStart || caseData.createdAt)}
                  </span>
                </div>
                {caseData.closedAt && (
                  <div className="py-1.5 flex items-center justify-between">
                    <span className="text-slate-400">Session End</span>
                    <span className="text-slate-700 text-[11px]">
                      {formatDate(caseData.closedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Organization & Routing Info */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Routing &amp; Assignment
              </span>

              <div className="divide-y divide-slate-100 text-xs text-slate-600">
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-400">Business Unit</span>
                  <span className="font-semibold text-slate-800">{caseData.businessUnit}</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-400">Queue</span>
                  <span className="font-medium text-slate-800 truncate max-w-[150px]">
                    {caseData.queue?.name || caseData.queueId || 'General Queue'}
                  </span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-400">Assigned Agent</span>
                  <span className="font-semibold text-slate-800">
                    {caseData.owner?.name || 'Unassigned'}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Audit History Timeline */
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Audit Event Timeline
            </span>

            {(!caseData.auditLogs || caseData.auditLogs.length === 0) ? (
              <p className="text-xs text-slate-400 italic">No audit events recorded yet.</p>
            ) : (
              <div className="relative pl-4 border-l-2 border-slate-200 space-y-4 my-2">
                {caseData.auditLogs.map((log: any, i: number) => {
                  const action = log.action || 'EVENT';
                  const isNote = action === 'NOTE_ADDED';
                  const isStatus = action === 'STATUS_CHANGED';
                  const isBotSync = action.includes('BOT_STATE');
                  const isSurvey = action.includes('SURVEY');

                  return (
                    <div key={log.id || i} className="relative text-xs">
                      {/* Marker dot */}
                      <div
                        className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${
                          isStatus
                            ? 'bg-blue-500'
                            : isNote
                            ? 'bg-amber-500'
                            : isBotSync
                            ? 'bg-purple-500'
                            : isSurvey
                            ? 'bg-orange-500'
                            : 'bg-slate-400'
                        }`}
                      />

                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                        <span className="font-mono font-semibold text-slate-700">{action}</span>
                        <span>{formatDate(log.timestamp || log.createdAt)}</span>
                      </div>

                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        {log.details || log.description || log.message || `${action} executed by ${log.actorName || log.actorId || 'system'}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Case Closure Modal Dialog */}
      {isClosureModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Lock size={15} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Close Case &amp; Trigger Survey</h4>
                  <p className="text-[11px] text-slate-400 font-mono">{caseData.caseNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setIsClosureModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Closure Reason *
                </label>
                <select
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium focus:ring-1 focus:ring-orange-400"
                >
                  <option value="RESOLVED_BY_AGENT">Resolved by Agent</option>
                  <option value="CUSTOMER_INACTIVITY">Customer Inactivity / Abandoned</option>
                  <option value="SPAM_OR_WRONG_NUMBER">Spam / Wrong Number (Survey Exempt)</option>
                  <option value="DUPLICATE_CASE">Duplicate Case</option>
                  <option value="ESCALATED_OUTSIDE">Escalated to Store / Outside Team</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Resolution Category
                </label>
                <select
                  value={resolutionCategory}
                  onChange={(e) => setResolutionCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium focus:ring-1 focus:ring-orange-400"
                >
                  <option value="Product Advisory">Product Advisory &amp; Stock Check</option>
                  <option value="Order Assistance">Order Assistance &amp; E-Ordering</option>
                  <option value="Return & Refund">Return &amp; Refund Request</option>
                  <option value="Store Information">Store Information &amp; Hours</option>
                  <option value="General">General Inquiry</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Resolution Notes
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Summarize resolution for audit and Qualtrics survey context..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-orange-400 resize-none"
                />
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-900 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Bot size={13} className="text-blue-600" />
                  Automated Gateway Handshake:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                  <li>Notifies Zwiz.AI Bot to reset customer session state to MAIN_MENU.</li>
                  <li>Dispatches automated post-chat CSAT survey to Qualtrics (unless Spam exempt).</li>
                  <li>Applies terminal lock to case messages and notes.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsClosureModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                disabled={isUpdating}
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <Lock size={13} />
                Confirm Closure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Team Chat Transfer Modal */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        caseId={caseData.id}
        caseNumber={caseData.caseNumber}
        caseTitle={caseData.title}
        currentQueueId={caseData.queueId}
        currentBU={caseData.businessUnit}
        sessionStartTime={caseData.session?.sessionStart || caseData.createdAt}
        onTransferred={async () => {
          setIsTransferModalOpen(false);
          if (onAssignChange) {
            await onAssignChange({});
          }
        }}
      />
    </aside>
  );
};
