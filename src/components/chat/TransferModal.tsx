'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRightLeft,
  Clock,
  ShieldAlert,
  Send,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Users,
} from 'lucide-react';

export interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  caseNumber?: string;
  caseTitle?: string;
  currentQueueId?: string;
  currentBU?: string;
  sessionStartTime?: string | Date;
  onTransferred?: (result: any) => void;
}

const AVAILABLE_QUEUES = [
  { id: 'queue_muji_furniture', name: 'Muji Furniture & Interior', team: 'CHAT_AND_SHOP', bu: 'Muji' },
  { id: 'queue_ssp_specialist', name: 'Supersports Athletic Gear', team: 'CHAT_AND_SHOP', bu: 'SSP' },
  { id: 'queue_b2s_general', name: 'B2S Books & Stationery', team: 'CHAT_AND_SHOP', bu: 'B2S' },
];

const PRESET_REASONS = [
  'Customer requesting warranty return on damaged item delivered from warehouse',
  'Order creation by sales team',
  'Fulfillment check & warehouse stock availability',
  'Payment assistance & link generation',
  'Product advisory & sizing consultation',
  'Customer escalation / Complaint handling',
  'Other / Custom reason',
];

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  caseId,
  caseNumber,
  caseTitle,
  currentQueueId,
  currentBU = 'Muji',
  sessionStartTime,
  onTransferred,
}) => {
  const [targetTeam, setTargetTeam] = useState<'CS' | 'COL' | 'CHAT_AND_SHOP'>('CHAT_AND_SHOP');
  const [targetQueueId, setTargetQueueId] = useState('queue_muji_furniture');
  const [transferReason, setTransferReason] = useState(PRESET_REASONS[0]);
  const [contextSummary, setContextSummary] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Timer calculation
  useEffect(() => {
    if (!isOpen) return;

    const start = sessionStartTime ? new Date(sessionStartTime).getTime() : Date.now();
    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setElapsedSeconds(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, sessionStartTime]);

  // Sync queue when team changes
  const handleTeamChange = (team: 'CS' | 'COL' | 'CHAT_AND_SHOP') => {
    setTargetTeam(team);
    const matchingQueue = AVAILABLE_QUEUES.find((q) => q.team === team);
    if (matchingQueue) {
      setTargetQueueId(matchingQueue.id);
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contextSummary.trim()) {
      setErrorMessage('Please provide a context summary for the receiving team.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/cases/${caseId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTeam,
          targetQueueId,
          transferReason,
          contextSummary: contextSummary.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transfer failed');
      }

      if (onTransferred) {
        onTransferred(data);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to transfer case');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-white" />
            <div>
              <h3 className="font-bold text-base leading-tight">Cross-Team Chat Transfer</h3>
              <p className="text-xs text-orange-100">
                Handoff {caseNumber ? `${caseNumber} — ` : ''}{caseTitle || 'Active Chat'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Productivity Timer Banner */}
        <div className="bg-orange-50 px-6 py-2.5 border-b border-orange-200 flex items-center justify-between text-xs text-orange-800">
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-orange-600" />
            <span>Current Session Handling Time:</span>
          </div>
          <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-orange-200 text-orange-900">
            {formatTimer(elapsedSeconds)}
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Team Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Select Destination Team
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTeamChange('CS')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                  targetTeam === 'CS'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Customer Service (CS)
              </button>
              <button
                type="button"
                onClick={() => handleTeamChange('COL')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                  targetTeam === 'COL'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Fulfillment (COL)
              </button>
              <button
                type="button"
                onClick={() => handleTeamChange('CHAT_AND_SHOP')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                  targetTeam === 'CHAT_AND_SHOP'
                    ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Chat &amp; Shop Sales
              </button>
            </div>
          </div>

          {/* Target Queue Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Destination Queue
            </label>
            <select
              value={targetQueueId}
              onChange={(e) => setTargetQueueId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
            >
              {AVAILABLE_QUEUES.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name} ({q.bu})
                </option>
              ))}
            </select>
          </div>

          {/* Reason Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Transfer Reason
            </label>
            <select
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500 mb-2"
            >
              {PRESET_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Context Summary Whisper Note */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Context Summary &amp; Handoff Notes
              </label>
              <span className="text-[10px] text-slate-500 font-medium">
                Internal whisper note for receiving agent
              </span>
            </div>
            <textarea
              rows={3}
              value={contextSummary}
              onChange={(e) => setContextSummary(e.target.value)}
              placeholder="e.g. Customer purchased Dyson V12 via Chat & Shop Ladprao. Item arrived with broken motorized head. Needs warranty return authorization..."
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500 placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Safe Handoff Notice */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
            <span>
              Customer chat stays uninterrupted. Zwiz bot state reset and Qualtrics survey are bypassed during transfer. Source session handling timer will be saved, and a fresh timer starts for the receiving agent.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>Transferring...</>
              ) : (
                <>
                  <ArrowRightLeft size={14} />
                  Confirm Transfer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
