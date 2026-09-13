'use client';

import React from 'react';
import { 
  PanelRight, 
  PanelRightClose, 
  Info, 
  MessageSquare, 
  Sparkles, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  Bot
} from 'lucide-react';
import { MessageList, FormattedMessage } from './MessageList';
import { MessageComposer, SendMessagePayload } from './MessageComposer';
import { CaseDetail } from './CaseDetailSidebar';

export interface ChatWindowProps {
  caseData: CaseDetail | null;
  messages: FormattedMessage[];
  isLoading?: boolean;
  isSending?: boolean;
  onSendMessage: (payload: SendMessagePayload) => Promise<void>;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onPreviewImage?: (url: string) => void;
  currentAgentId?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  caseData,
  messages,
  isLoading = false,
  isSending = false,
  onSendMessage,
  onToggleSidebar,
  isSidebarOpen = true,
  onPreviewImage,
  currentAgentId,
}) => {
  // Empty State: No Case Selected
  if (!caseData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#ff5c35] to-[#ff9e7d] text-white flex items-center justify-center shadow-lg shadow-orange-500/20 mb-4 ring-4 ring-orange-100">
          <MessageSquare size={32} />
        </div>
        <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">
          Central Chat &amp; Shop Unified Desk
        </h2>
        <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
          Select an active customer conversation from the queue on the left to start responding, reviewing session traffic, or collaborating via staff whisper notes.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3 max-w-md w-full text-left">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-[#06C755] uppercase block">LINE OA</span>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">Central Chat&amp;Shop</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-[#0084FF] uppercase block">Facebook</span>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">Messenger Inbound</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-[#bc1888] uppercase block">Instagram</span>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">Direct Message</p>
          </div>
        </div>
      </div>
    );
  }

  const customer = caseData.customer;
  const customerName = customer?.displayName || customer?.name || 'Customer';
  const customerAvatar = customer?.avatarUrl || null;
  const isClosed = caseData.status === 'CLOSED';

  // Channel badge
  const renderChannelBadge = (channel: string) => {
    const ch = (channel || '').toUpperCase();
    if (ch.includes('LINE')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-white bg-[#06C755] shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
          LINE OA
        </span>
      );
    }
    if (ch.includes('FB') || ch.includes('MESSENGER')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-white bg-[#0084FF] shadow-xs">
          Facebook
        </span>
      );
    }
    if (ch.includes('IG') || ch.includes('INSTAGRAM')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-white bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-xs">
          Instagram
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200">
        {channel}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Center Pane Top Header */}
      <header className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between shadow-xs select-none z-10">
        {/* Left: Customer & Case Identifiers */}
        <div className="flex items-center gap-3 min-w-0">
          {customerAvatar ? (
            <img
              src={customerAvatar}
              alt={customerName}
              className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {customerName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-800 truncate">
                {customerName}
              </h2>
              {renderChannelBadge(caseData.channel)}
              <span className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                {caseData.caseNumber}
              </span>
              {Boolean(caseData.isVip || caseData.customer?.isVip) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold text-amber-950 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 border border-amber-400 shadow-xs tracking-wider">
                  <Sparkles size={11} className="text-amber-900 fill-amber-700" />
                  <span>NSC_VIP</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
              <span>🏢 {caseData.businessUnit}</span>
              <span>&bull;</span>
              <span className="truncate max-w-[160px] text-slate-600 font-medium">
                {caseData.pageName || caseData.title}
              </span>
              <span>&bull;</span>
              <span
                className={`font-bold ${
                  caseData.priority === 'CRITICAL'
                    ? 'text-red-600'
                    : caseData.priority === 'HIGH'
                    ? 'text-orange-600'
                    : caseData.priority === 'MEDIUM'
                    ? 'text-amber-600'
                    : 'text-slate-500'
                }`}
              >
                {caseData.priority}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions & Sidebar Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {Boolean(caseData.isVip || caseData.customer?.isVip) && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-bold shadow-xs">
              <Clock size={13} className="text-amber-600 animate-pulse" />
              <span>5m VIP SLA</span>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] text-slate-600 font-medium">
            <Bot size={13} className="text-emerald-600" />
            <span>Zwiz Gateway Synced</span>
          </div>

          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className={`p-2 rounded-lg border transition-colors ${
                isSidebarOpen
                  ? 'bg-orange-50 border-orange-300 text-orange-600'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
              title={isSidebarOpen ? 'Collapse Details Sidebar' : 'Expand Details Sidebar'}
            >
              <PanelRight size={17} />
            </button>
          )}
        </div>
      </header>

      {/* Message List Stream (Center Scrollable) */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        onPreviewImage={onPreviewImage}
        caseStatus={caseData.status}
        customerName={customerName}
        customerAvatar={customerAvatar}
      />

      {/* Message Composer (Docked Bottom) */}
      <MessageComposer
        caseId={caseData.id}
        caseNumber={caseData.caseNumber}
        isCaseClosed={isClosed}
        onSendMessage={onSendMessage}
        currentAgentId={currentAgentId}
        isSending={isSending}
      />
    </div>
  );
};
