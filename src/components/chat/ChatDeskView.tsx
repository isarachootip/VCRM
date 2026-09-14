'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { HubSpotHeader } from '@/components/HubSpotHeader';
import { Sidebar } from '@/components/Sidebar';
import { QueueFilterBar, CaseListItem } from '@/components/chat/QueueFilterBar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { CaseDetailSidebar, CaseDetail } from '@/components/chat/CaseDetailSidebar';
import { FormattedMessage } from '@/components/chat/MessageList';
import { SendMessagePayload } from '@/components/chat/MessageComposer';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ChatDeskViewProps {
  embedded?: boolean;
  selectedBu?: string;
  onBuChange?: (bu: string) => void;
}

export function ChatDeskView({ embedded = false, selectedBu: externalBu, onBuChange: setExternalBu }: ChatDeskViewProps) {
  const router = useRouter();

  // Queue & Filters
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [internalBU, setInternalBU] = useState<string>('ALL');
  const selectedBU = externalBu !== undefined ? externalBu : internalBU;
  const setSelectedBU = (bu: string) => {
    setInternalBU(bu);
    if (setExternalBu) {
      setExternalBu(bu);
    }
    if (!embedded && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (bu === 'ALL') {
        url.searchParams.delete('bu');
      } else {
        url.searchParams.set('bu', bu);
      }
      window.history.replaceState(null, '', url.toString());
    }
  };

  useEffect(() => {
    if (!embedded && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const buParam = urlParams.get('bu');
      if (buParam) {
        setInternalBU(buParam);
      }
    }
  }, [embedded]);

  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [countsByStatus, setCountsByStatus] = useState<Record<string, number>>({});

  // Active Case Detail & Messages
  const [activeCase, setActiveCase] = useState<CaseDetail | null>(null);
  const [messages, setMessages] = useState<FormattedMessage[]>([]);

  // UI State
  const [isLoadingCases, setIsLoadingCases] = useState<boolean>(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type?: 'success' | 'error' } | null>(null);

  const selectedCaseIdRef = useRef(selectedCaseId);
  selectedCaseIdRef.current = selectedCaseId;

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 1. Fetch Cases list from API
  const fetchCases = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoadingCases(true);
    try {
      const params = new URLSearchParams();
      if (selectedBU !== 'ALL') {
        params.append('bu', selectedBU);
      }
      if (selectedStatus !== 'ALL') {
        params.append('status', selectedStatus);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      params.append('limit', '50');

      const res = await fetch(`/api/cases?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const rawCases: CaseListItem[] = data.cases || [];
        setCases(rawCases);

        // Compute counts
        const counts: Record<string, number> = {
          OPEN: 0,
          IN_PROGRESS: 0,
          RESOLVED: 0,
          CLOSED: 0,
        };
        rawCases.forEach((c) => {
          const s = (c.status || '').toUpperCase();
          if (counts[s] !== undefined) {
            counts[s] = (counts[s] || 0) + 1;
          }
        });
        setCountsByStatus(counts);

        // If no case is selected and cases exist, auto-select first
        if (!selectedCaseIdRef.current && rawCases.length > 0) {
          setSelectedCaseId(rawCases[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch cases:', err);
    } finally {
      if (showLoading) setIsLoadingCases(false);
    }
  }, [selectedBU, selectedStatus, searchQuery]);

  // 2. Fetch Active Case Detail and its Messages
  const fetchCaseDetailAndMessages = useCallback(async (caseId: string, showLoading = false) => {
    if (showLoading) setIsLoadingMessages(true);
    try {
      const [caseRes, msgRes] = await Promise.all([
        fetch(`/api/cases/${caseId}`),
        fetch(`/api/cases/${caseId}/messages`),
      ]);

      if (caseRes.ok) {
        const caseData = await caseRes.json();
        const normalizedCase: CaseDetail = caseData.case || caseData;
        setActiveCase(normalizedCase);
      }

      if (msgRes.ok) {
        const msgData = await msgRes.json();
        const rawMessages: FormattedMessage[] = msgData.messages || [];
        setMessages(rawMessages);
      }
    } catch (err) {
      console.error(`Failed to fetch details for case ${caseId}:`, err);
    } finally {
      if (showLoading) setIsLoadingMessages(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchCases(true);
  }, [fetchCases]);

  // When selectedCaseId changes, load details
  useEffect(() => {
    if (selectedCaseId) {
      fetchCaseDetailAndMessages(selectedCaseId, true);
    } else {
      setActiveCase(null);
      setMessages([]);
    }
  }, [selectedCaseId, fetchCaseDetailAndMessages]);

  // Real-time synchronization polling (every 4.5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCases(false);
      const currentId = selectedCaseIdRef.current;
      if (currentId) {
        fetchCaseDetailAndMessages(currentId, false);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [fetchCases, fetchCaseDetailAndMessages]);

  // 3. Send Message Handler
  const handleSendMessage = async (payload: SendMessagePayload) => {
    if (!selectedCaseId) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/cases/${selectedCaseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to send message (${res.status})`);
      }

      // Reload messages & case
      await fetchCaseDetailAndMessages(selectedCaseId, false);
      showToast(
        payload.isInternal ? 'Internal whisper note added' : 'Reply dispatched to Zwiz gateway'
      );
    } catch (err: any) {
      console.error('Error sending message:', err);
      showToast(err.message || 'Failed to send message', 'error');
      throw err;
    } finally {
      setIsSending(false);
    }
  };

  // 4. Status Transition Handler
  const handleStatusChange = async (
    newStatus: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
    meta?: { closureReason?: string; resolutionNotes?: string; resolutionCategory?: string }
  ) => {
    if (!selectedCaseId) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/cases/${selectedCaseId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          closureReason: meta?.closureReason,
          resolutionCategory: meta?.resolutionCategory,
          resolutionNotes: meta?.resolutionNotes,
          actorId: 'agent_sarah_01',
          actorName: 'Sarah Connor',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Status transition failed (${res.status})`);
      }

      await fetchCaseDetailAndMessages(selectedCaseId, false);
      await fetchCases(false);

      if (newStatus === 'CLOSED') {
        showToast(
          'Case closed & locked. Bot state reset sent to Zwiz and CSAT survey triggered on Qualtrics!'
        );
      } else {
        showToast(`Case status updated to ${newStatus}`);
      }
    } catch (err: any) {
      console.error('Error updating status:', err);
      showToast(err.message || 'Failed to update status', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 5. Assignment Change Handler
  const handleAssignChange = async (meta: { ownerId?: string; queueId?: string; priority?: string }) => {
    if (!selectedCaseId) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/cases/${selectedCaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meta),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Assignment update failed (${res.status})`);
      }

      await fetchCaseDetailAndMessages(selectedCaseId, false);
      await fetchCases(false);
      showToast('Assignment details updated');
    } catch (err: any) {
      console.error('Error updating assignment:', err);
      showToast(err.message || 'Failed to update assignment', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const content = (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-5 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold text-white ${
              toastMessage.type === 'error' ? 'bg-rose-600' : 'bg-card text-foreground ring-1 ring-border shadow-lg'
            }`}
          >
            {toastMessage.type === 'error' ? (
              <AlertCircle size={15} className="text-white" />
            ) : (
              <CheckCircle2 size={15} className="text-emerald-500" />
            )}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 opacity-70 hover:opacity-100"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* 3-Column Master Layout */}
      <main className="flex-1 flex overflow-hidden bg-background min-w-0">
        {/* Column 1: Queue Filter & Case List (Left) */}
        <QueueFilterBar
          cases={cases}
          selectedCaseId={selectedCaseId}
          onSelectCase={(id) => setSelectedCaseId(id)}
          selectedBU={selectedBU}
          onSelectBU={(bu) => setSelectedBU(bu)}
          selectedStatus={selectedStatus}
          onSelectStatus={(status) => setSelectedStatus(status)}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          countsByStatus={countsByStatus}
          isLoading={isLoadingCases}
          onRefresh={() => fetchCases(true)}
        />

        {/* Column 2: Chat Window (Center Stream & Composer) */}
        <ChatWindow
          caseData={activeCase}
          messages={messages}
          isLoading={isLoadingMessages}
          isSending={isSending}
          onSendMessage={handleSendMessage}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
          currentAgentId="agent_sarah_01"
        />

        {/* Column 3: Case Intelligence & SLA Sidebar (Right) */}
        {isSidebarOpen && activeCase && (
          <CaseDetailSidebar
            caseData={activeCase}
            onStatusChange={handleStatusChange}
            onAssignChange={handleAssignChange}
            isUpdating={isUpdatingStatus}
            onCloseSidebar={() => setIsSidebarOpen(false)}
          />
        )}
      </main>
    </>
  );

  if (embedded) {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {content}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground font-sans transition-colors">
      {/* Sleek Minimal Single-Line Top Header Navigation */}
      <HubSpotHeader
        currentTab="chat"
        onTabChange={(tab) => {
          if (tab !== 'chat') {
            const buParam = selectedBU !== 'ALL' ? `&bu=${selectedBU}` : '';
            router.push(`/?tab=${tab}${buParam}`);
          }
        }}
        onOpenCreateModal={() => {
          const buParam = selectedBU !== 'ALL' ? `&bu=${selectedBU}` : '';
          router.push(`/?tab=deals${buParam}`);
        }}
        selectedBu={selectedBU}
        onBuChange={(bu) => setSelectedBU(bu)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* Persistent Left Sidebar Navigation */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab="chat"
          onTabChange={(tab) => {
            if (tab !== 'chat') {
              const buParam = selectedBU !== 'ALL' ? `&bu=${selectedBU}` : '';
              router.push(`/?tab=${tab}${buParam}`);
            }
          }}
          currentBoardId="board-5030723273"
          onSelectBoard={() => {
            // Sidebar.handleBoardClick already navigates cleanly to /?tab=deals&board=...&bu=...
          }}
          selectedBu={selectedBU}
          onBuChange={(bu) => setSelectedBU(bu)}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
        {content}
      </div>
    </div>
  );
}
