'use client';

import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Phone, 
  MessageSquare, 
  CheckSquare, 
  Calendar, 
  Building2, 
  Briefcase, 
  Ticket, 
  Sparkles, 
  Plus, 
  ChevronRight, 
  ChevronDown, 
  ExternalLink,
  Edit2,
  Clock,
  Send,
  MoreVertical,
  CheckCircle2,
  Tag
} from 'lucide-react';
import { HubSpotContactRecord } from '@/types/hubspot';

interface HubSpotRecordDetailProps {
  contact: HubSpotContactRecord;
  onClose: () => void;
  onUpdateContact?: (updated: Partial<HubSpotContactRecord>) => void;
}

export const HubSpotRecordDetail: React.FC<HubSpotRecordDetailProps> = ({
  contact,
  onClose,
  onUpdateContact
}) => {
  const [activeTab, setActiveTab] = useState<'activity' | 'notes' | 'emails' | 'calls' | 'tasks'>('activity');
  const [newNoteText, setNewNoteText] = useState('');
  const [notes, setNotes] = useState(contact.notes || []);
  const [activities, setActivities] = useState(contact.activities || []);
  const [leadStatus, setLeadStatus] = useState(contact.leadStatus);
  const [lifecycleStage, setLifecycleStage] = useState(contact.lifecycleStage);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const noteItem = {
      id: `n-${Date.now()}`,
      author: 'Thanakorn W. (You)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      content: newNoteText,
      createdAt: 'Just now'
    };

    const newActivity = {
      id: `a-${Date.now()}`,
      type: 'note' as const,
      title: 'Created a new note',
      description: newNoteText,
      timestamp: 'Just now',
      user: 'Thanakorn W.'
    };

    setNotes([noteItem, ...notes]);
    setActivities([newActivity, ...activities]);
    setNewNoteText('');
  };

  const getStageBadgeColor = (stage: string) => {
    switch (stage) {
      case 'CUSTOMER': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'OPPORTUNITY': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'SALES_QUALIFIED': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'MARKETING_QUALIFIED': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'LEAD': return 'bg-slate-100 text-slate-800 border-slate-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 animate-fadeIn">
      <div className="bg-[#f5f8fa] w-full max-w-7xl h-[92vh] rounded-xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden animate-scaleIn">
        {/* Top Header Banner */}
        <div className="bg-[#2d3e50] text-white px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#ff7a59] flex items-center justify-center font-bold text-white shadow-sm">
              {contact.firstName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight">{contact.name}</h1>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStageBadgeColor(lifecycleStage)}`}>
                  {lifecycleStage}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {contact.jobTitle} at <span className="font-semibold text-orange-300">{contact.company.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 3-Column HubSpot Record Layout */}
        <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden divide-x divide-slate-200">
          {/* ========================================================
              COLUMN 1 (Left 3 cols): Profile & Properties (About Contact)
             ======================================================== */}
          <div className="col-span-12 lg:col-span-3 bg-white p-5 overflow-y-auto space-y-5 text-xs">
            {/* Quick Action Toolbar (HubSpot Icon Bar) */}
            <div>
              <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <button className="flex flex-col items-center justify-center p-2 rounded hover:bg-orange-100/60 text-slate-700 hover:text-orange-600 transition-colors" title="Add Note">
                  <MessageSquare size={16} />
                  <span className="text-[10px] mt-1 font-medium">Note</span>
                </button>
                <button className="flex flex-col items-center justify-center p-2 rounded hover:bg-orange-100/60 text-slate-700 hover:text-orange-600 transition-colors" title="Send Email">
                  <Mail size={16} />
                  <span className="text-[10px] mt-1 font-medium">Email</span>
                </button>
                <button className="flex flex-col items-center justify-center p-2 rounded hover:bg-orange-100/60 text-slate-700 hover:text-orange-600 transition-colors" title="Log Call">
                  <Phone size={16} />
                  <span className="text-[10px] mt-1 font-medium">Call</span>
                </button>
                <button className="flex flex-col items-center justify-center p-2 rounded hover:bg-orange-100/60 text-slate-700 hover:text-orange-600 transition-colors" title="Create Task">
                  <CheckSquare size={16} />
                  <span className="text-[10px] mt-1 font-medium">Task</span>
                </button>
                <button className="flex flex-col items-center justify-center p-2 rounded hover:bg-orange-100/60 text-slate-700 hover:text-orange-600 transition-colors" title="Schedule Meeting">
                  <Calendar size={16} />
                  <span className="text-[10px] mt-1 font-medium">Meet</span>
                </button>
              </div>
            </div>

            {/* About this Contact Box */}
            <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-2xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center justify-between pb-2 border-b border-slate-100">
                <span>About this contact</span>
                <span className="text-slate-400 text-[11px] font-normal">Actions</span>
              </h3>

              <div>
                <span className="text-[11px] text-slate-500 font-medium">Email</span>
                <p className="font-semibold text-[#0066cc] mt-0.5 select-all">{contact.email}</p>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-medium">Phone Number</span>
                <p className="font-semibold text-slate-800 mt-0.5 select-all">{contact.phone}</p>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-medium">Contact Owner</span>
                <div className="flex items-center gap-2 mt-1">
                  <img src={contact.owner.avatar} alt={contact.owner.name} className="w-5 h-5 rounded-full object-cover" />
                  <span className="font-semibold text-slate-800">{contact.owner.name}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-medium">Lifecycle Stage</span>
                <select
                  value={lifecycleStage}
                  onChange={(e) => setLifecycleStage(e.target.value as any)}
                  className="w-full mt-1 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-orange-500"
                >
                  <option value="SUBSCRIBER">Subscriber</option>
                  <option value="LEAD">Lead</option>
                  <option value="MARKETING_QUALIFIED">Marketing Qualified Lead (MQL)</option>
                  <option value="SALES_QUALIFIED">Sales Qualified Lead (SQL)</option>
                  <option value="OPPORTUNITY">Opportunity</option>
                  <option value="CUSTOMER">Customer</option>
                </select>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-medium">Lead Status</span>
                <select
                  value={leadStatus}
                  onChange={(e) => setLeadStatus(e.target.value as any)}
                  className="w-full mt-1 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-orange-500"
                >
                  <option value="NEW">New</option>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="OPEN_DEAL">Open Deal</option>
                  <option value="CONNECTED">Connected</option>
                  <option value="UNQUALIFIED">Unqualified</option>
                </select>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-medium">Create Date</span>
                <p className="text-slate-700 font-mono mt-0.5">{contact.createDate}</p>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-medium">Last Activity Date</span>
                <p className="text-slate-700 font-mono mt-0.5">{contact.lastActivityDate}</p>
              </div>
            </div>
          </div>

          {/* ========================================================
              COLUMN 2 (Center 6 cols): Activity Timeline & Composer
             ======================================================== */}
          <div className="col-span-12 lg:col-span-6 bg-[#f5f8fa] p-5 overflow-y-auto flex flex-col space-y-4 text-xs">
            {/* New Note Composer Box */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={14} className="text-orange-500" />
                <span className="font-bold text-slate-800">Log Note or Quick Update</span>
              </div>
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  rows={3}
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Write a note about this customer (e.g. Next call scheduled, quotation feedback)..."
                  className="w-full p-3 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none placeholder-slate-400 bg-slate-50/50"
                />
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[11px]">Visible to team members</span>
                  </div>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-[#ff7a59] hover:bg-[#ff5c35] text-white font-semibold rounded text-xs shadow-xs transition-all active:scale-95"
                  >
                    <Send size={12} />
                    <span>Save note</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Activity Stream Tabs */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex-1">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setActiveTab('activity')}
                    className={`pb-1 font-semibold text-xs border-b-2 transition-colors ${
                      activeTab === 'activity'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Activity ({activities.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`pb-1 font-semibold text-xs border-b-2 transition-colors ${
                      activeTab === 'notes'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Notes ({notes.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('emails')}
                    className={`pb-1 font-semibold text-xs border-b-2 transition-colors ${
                      activeTab === 'emails'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Emails (2)
                  </button>
                  <button
                    onClick={() => setActiveTab('calls')}
                    className={`pb-1 font-semibold text-xs border-b-2 transition-colors ${
                      activeTab === 'calls'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Calls (1)
                  </button>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <Clock size={12} />
                  <span>Timeline</span>
                </div>
              </div>

              {/* Timeline Items */}
              <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                {activities.map((act) => (
                  <div key={act.id} className="relative flex items-start space-x-3 pl-1">
                    <div className="w-6 h-6 rounded-full bg-orange-100 border border-orange-300 text-orange-600 flex items-center justify-center shrink-0 z-10">
                      {act.type === 'call' && <Phone size={12} />}
                      {act.type === 'email' && <Mail size={12} />}
                      {act.type === 'meeting' && <Calendar size={12} />}
                      {act.type === 'note' && <MessageSquare size={12} />}
                    </div>
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-800">{act.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{act.timestamp}</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">{act.description}</p>
                      <div className="mt-2 text-[10px] text-slate-400">
                        Logged by <span className="font-semibold text-slate-600">{act.user}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ========================================================
              COLUMN 3 (Right 3 cols): Associations (Deals, Companies, Lists)
             ======================================================== */}
          <div className="col-span-12 lg:col-span-3 bg-white p-5 overflow-y-auto space-y-4 text-xs">
            {/* Associated Company Card */}
            <div className="border border-slate-200 rounded-lg p-3.5 bg-white shadow-2xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Building2 size={14} className="text-amber-600" />
                  <span>Companies (1)</span>
                </div>
                <button className="text-orange-600 hover:text-orange-700 font-semibold text-[11px]">+ Add</button>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-orange-300 transition-colors">
                <div className="font-bold text-[#0066cc] hover:underline cursor-pointer">
                  {contact.company.name}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{contact.company.domain}</div>
                <div className="text-[11px] text-slate-600 font-medium mt-1 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block">
                  {contact.company.industry}
                </div>
              </div>
            </div>

            {/* Associated Deals Card */}
            <div className="border border-slate-200 rounded-lg p-3.5 bg-white shadow-2xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Briefcase size={14} className="text-purple-600" />
                  <span>Deals ({contact.associatedDeals?.length || 0})</span>
                </div>
                <button className="text-orange-600 hover:text-orange-700 font-semibold text-[11px]">+ Add deal</button>
              </div>

              <div className="space-y-2">
                {contact.associatedDeals?.map((deal) => (
                  <div key={deal.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-purple-300 transition-colors">
                    <div className="font-bold text-slate-900 text-[11px] hover:text-purple-700 cursor-pointer">
                      {deal.name}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="font-mono font-bold text-emerald-700 text-xs">
                        ฿{deal.amount.toLocaleString()}
                      </span>
                      <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full border border-purple-200">
                        {deal.stage}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      Close: {deal.closeDate}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Associated Tickets Card */}
            <div className="border border-slate-200 rounded-lg p-3.5 bg-white shadow-2xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Ticket size={14} className="text-emerald-600" />
                  <span>Tickets ({contact.associatedTickets?.length || 0})</span>
                </div>
                <button className="text-orange-600 hover:text-orange-700 font-semibold text-[11px]">+ Add ticket</button>
              </div>

              {contact.associatedTickets && contact.associatedTickets.length > 0 ? (
                <div className="space-y-2">
                  {contact.associatedTickets.map((t) => (
                    <div key={t.id} className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px]">
                      <span className="font-bold text-slate-800">{t.subject}</span>
                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                        <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-medium">{t.status}</span>
                        <span className="text-slate-500">Priority: {t.priority}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No open support tickets.</p>
              )}
            </div>

            {/* List Memberships Card */}
            <div className="border border-slate-200 rounded-lg p-3.5 bg-white shadow-2xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 pb-2 mb-2 border-b border-slate-100">
                <Tag size={14} className="text-orange-500" />
                <span>List Memberships (3)</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="bg-orange-50/70 border border-orange-200 text-orange-800 p-1.5 rounded font-medium">
                  🌟 High Intent Enterprise Leads (2026)
                </div>
                <div className="bg-slate-100 border border-slate-200 text-slate-700 p-1.5 rounded font-medium">
                  🏢 Key Account CXOs & VP Level
                </div>
                <div className="bg-slate-100 border border-slate-200 text-slate-700 p-1.5 rounded font-medium">
                  📊 Inbound Demo Requests Q3
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
