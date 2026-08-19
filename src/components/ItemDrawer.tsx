'use client';

import React, { useState } from 'react';
import { 
  X, 
  Send, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign, 
  Percent, 
  Sparkles, 
  Paperclip, 
  Smile, 
  Clock,
  Zap,
  Building,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { CRMItem, StatusType, PriorityType, ActivityItem } from '@/types/crm';
import { StatusPicker } from './StatusPicker';
import { PriorityPicker } from './PriorityPicker';
import { STATUS_CONFIGS } from '@/data/mockData';

interface ItemDrawerProps {
  item: CRMItem | null;
  groupId: string | null;
  boardType?: string;
  onClose: () => void;
  onUpdateItem: (groupId: string, itemId: string, updates: Partial<CRMItem>) => void;
  onConvertLead?: (item: CRMItem, groupId: string) => void;
}

export const ItemDrawer: React.FC<ItemDrawerProps> = ({
  item,
  groupId,
  boardType = 'deals',
  onClose,
  onUpdateItem,
  onConvertLead,
}) => {
  const [activeTab, setActiveTab] = useState<'updates' | 'details'>('updates');
  const [newUpdateText, setNewUpdateText] = useState('');

  if (!item || !groupId) return null;

  const handlePostUpdate = () => {
    if (!newUpdateText.trim()) return;

    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      user: 'Isara Chootip',
      avatar: '👨‍💼',
      action: newUpdateText.trim(),
      timestamp: 'Just now',
    };

    const currentActivities = item.activities || [];
    onUpdateItem(groupId, item.id, {
      activities: [newActivity, ...currentActivities],
    });

    setNewUpdateText('');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val);
  };

  const isLead = boardType === 'leads';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/30 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 transform transition-transform duration-300 ease-in-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-gray-200 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">
                  {boardType.toUpperCase()} Record
                </span>
                {isLead && (
                  <button
                    onClick={() => onConvertLead && onConvertLead(item, groupId)}
                    className="flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 px-2.5 py-0.5 rounded-full transition-colors"
                  >
                    <Zap size={11} className="fill-purple-700" />
                    <span>Convert to Active Deal</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={item.name}
                onChange={(e) => onUpdateItem(groupId, item.id, { name: e.target.value })}
                className="w-full text-xl font-bold text-gray-900 mt-2 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded p-1"
              />
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Property Strip */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-gray-100 text-xs">
            <div>
              <span className="text-gray-400 block mb-1">Status / Stage</span>
              <StatusPicker
                currentStatus={item.status}
                onChange={(newSt) => onUpdateItem(groupId, item.id, { status: newSt })}
              />
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Value / Quota</span>
              <div className="font-extrabold text-sm text-emerald-600 py-1">
                {formatCurrency(item.dealValue)}
              </div>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Owner</span>
              <div className="flex items-center gap-1.5 py-1">
                <span>{item.owner.avatar}</span>
                <span className="font-medium text-gray-800 truncate">{item.owner.name}</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-4 mt-5 border-b border-gray-200 -mb-5">
            <button
              onClick={() => setActiveTab('updates')}
              className={`pb-2.5 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'updates'
                  ? 'border-[#0073ea] text-[#0073ea]'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              Updates & Notes ({item.activities?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-2.5 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'details'
                  ? 'border-[#0073ea] text-[#0073ea]'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              Details & Strategic Parameters
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#f9fafb]">
          {activeTab === 'updates' ? (
            <div className="space-y-4">
              {/* Write Update Box */}
              <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                <textarea
                  rows={3}
                  value={newUpdateText}
                  onChange={(e) => setNewUpdateText(e.target.value)}
                  placeholder="Write an update, meeting note, or mention a teammate with @..."
                  className="w-full text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none resize-none"
                />

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                  <div className="flex items-center gap-2 text-gray-400">
                    <button className="p-1 hover:text-gray-600 rounded">
                      <Paperclip size={14} />
                    </button>
                    <button className="p-1 hover:text-gray-600 rounded">
                      <Smile size={14} />
                    </button>
                    <button className="flex items-center gap-1 text-[11px] text-purple-600 hover:bg-purple-50 px-2 py-0.5 rounded font-medium">
                      <Sparkles size={12} />
                      <span>AI Enhance</span>
                    </button>
                  </div>

                  <button
                    onClick={handlePostUpdate}
                    disabled={!newUpdateText.trim()}
                    className="bg-[#0073ea] hover:bg-[#0060b9] disabled:opacity-40 text-white text-xs font-semibold px-4 py-1.5 rounded-md flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <span>Update</span>
                    <Send size={12} />
                  </button>
                </div>
              </div>

              {/* Updates Feed */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Timeline Activity
                </h4>

                {(item.activities || []).map((act) => (
                  <div key={act.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{act.avatar}</span>
                        <div>
                          <span className="text-xs font-bold text-gray-900">{act.user}</span>
                          <span className="text-[10px] text-gray-400 block">{act.timestamp}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-700 leading-relaxed bg-gray-50/70 p-2.5 rounded-lg border border-gray-100">
                      {act.action}
                    </div>
                  </div>
                ))}

                {(!item.activities || item.activities.length === 0) && (
                  <div className="py-8 text-center text-xs text-gray-400">
                    No updates logged yet. Post the first update above!
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Details Tab */
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4 text-xs">
              <h4 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">
                Company & Contact Information
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 block mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={item.companyName || ''}
                    onChange={(e) => onUpdateItem(groupId, item.id, { companyName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Industry</label>
                  <input
                    type="text"
                    value={item.industry || ''}
                    onChange={(e) => onUpdateItem(groupId, item.id, { industry: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={item.contactPerson}
                    onChange={(e) => onUpdateItem(groupId, item.id, { contactPerson: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={item.contactEmail}
                    onChange={(e) => onUpdateItem(groupId, item.id, { contactEmail: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={item.contactPhone || ''}
                    onChange={(e) => onUpdateItem(groupId, item.id, { contactPhone: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Lead Source</label>
                  <input
                    type="text"
                    value={item.leadSource || ''}
                    onChange={(e) => onUpdateItem(groupId, item.id, { leadSource: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <h4 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2 pt-3">
                Commercial Parameters & Forecast
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 block mb-1">Deal Value (THB)</label>
                  <input
                    type="number"
                    value={item.dealValue}
                    onChange={(e) => onUpdateItem(groupId, item.id, { dealValue: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Probability (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={item.probability}
                    onChange={(e) => onUpdateItem(groupId, item.id, { probability: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Target Close Date</label>
                  <input
                    type="date"
                    value={item.expectedCloseDate}
                    onChange={(e) => onUpdateItem(groupId, item.id, { expectedCloseDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Priority</label>
                  <PriorityPicker
                    currentPriority={item.priority}
                    onChange={(newPr) => onUpdateItem(groupId, item.id, { priority: newPr })}
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="text-gray-400 block mb-1">Internal Strategic Notes</label>
                <textarea
                  rows={4}
                  value={item.notes || ''}
                  onChange={(e) => onUpdateItem(groupId, item.id, { notes: e.target.value })}
                  placeholder="Add strategic background info, competitors, negotiation plan..."
                  className="w-full px-3 py-2 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none text-xs"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
