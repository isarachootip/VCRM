'use client';

import React, { useState, useEffect } from 'react';
import { HubSpotHeader } from '@/components/HubSpotHeader';
import { HubSpotListsView } from '@/components/HubSpotListsView';
import { HubSpotContactsView } from '@/components/HubSpotContactsView';
import { Sidebar } from '@/components/Sidebar';
import { BoardHeader } from '@/components/BoardHeader';
import { TableView } from '@/components/TableView';
import { KanbanView } from '@/components/KanbanView';
import { DashboardView } from '@/components/DashboardView';
import { ActivityLogView } from '@/components/ActivityLogView';
import { DispatchBoardView } from '@/components/DispatchBoardView';
import { ItemDrawer } from '@/components/ItemDrawer';
import { ImportModal } from '@/components/ImportModal';
import { LineSettingsModal } from '@/components/settings/LineSettingsModal';
import { SupervisorDashboard } from '@/components/supervisor/SupervisorDashboard';
import { ExecutiveDashboard } from '@/components/dashboard/ExecutiveDashboard';
import { ChatDeskView } from '@/components/chat/ChatDeskView';
import { CRMBoard, CRMGroup, CRMItem, ActiveView, StatusType } from '@/types/crm';
import { INITIAL_BOARDS, TEAM_MEMBERS } from '@/data/mockData';
import { exportBoardToExcel } from '@/utils/excelHelper';
import { CheckCircle2, AlertCircle, Sparkles, LayoutList, Kanban, Layers } from 'lucide-react';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';

const VALID_TABS = new Set([
  'dashboard',
  'chat',
  'contacts',
  'lists',
  'supervisor',
  'deals',
  'companies',
  'reports',
]);

const VALID_BOARDS = new Set([
  'board-5030723273',
  'board-leads',
  'board-accounts',
  'board-contacts',
  'board-growth',
  'board-delivery',
  'board-install',
  'board-renovate',
  'board-maintain',
]);

function HomeContent() {
  const { t } = useLanguage();
  // Navigation Mode: 'dashboard' | 'lists' | 'contacts' | 'deals' | 'companies' | 'reports' | 'supervisor' | 'chat'
  const [hubspotNavTab, setHubspotNavTab] = useState<string>('dashboard');
  const [selectedBu, setSelectedBu] = useState<string>('ALL');

  // Boards State
  const [allBoards, setAllBoards] = useState<Record<string, CRMBoard>>(INITIAL_BOARDS);
  const [currentBoardId, setCurrentBoardId] = useState<string>('board-5030723273');
  const [activeView, setActiveView] = useState<ActiveView>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState<{ item: CRMItem; groupId: string } | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isLineSettingsOpen, setIsLineSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const currentBoard = allBoards[currentBoardId] || allBoards['board-5030723273'] || INITIAL_BOARDS['board-5030723273'];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Load from API and LocalStorage on mount
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/boards');
        if (res.ok) {
          const data = await res.json();
          if (data.boards && Object.keys(data.boards).length > 0) {
            setAllBoards(data.boards);
            setIsLoaded(true);
            return;
          }
        }
      } catch (err) {
        console.log('API fetch fallback to localStorage', err);
      }

      try {
        const saved = localStorage.getItem('monday_crm_all_boards');
        if (saved) {
          setAllBoards(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Failed to load boards from localStorage', e);
      }
      setIsLoaded(true);
    }

    // Check URL query param for initial tab, board, and bu
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam) {
        if (VALID_TABS.has(tabParam)) {
          setHubspotNavTab(tabParam);
        } else {
          setHubspotNavTab('dashboard');
          const url = new URL(window.location.href);
          url.searchParams.delete('tab');
          url.searchParams.delete('board');
          window.history.replaceState(null, '', url.toString());
          showToast('Unrecognized navigation tab, defaulting to Dashboard');
        }
      }
      const boardParam = urlParams.get('board');
      if (boardParam) {
        if (VALID_BOARDS.has(boardParam)) {
          setCurrentBoardId(boardParam);
        } else {
          setCurrentBoardId('board-5030723273');
          const url = new URL(window.location.href);
          url.searchParams.set('board', 'board-5030723273');
          window.history.replaceState(null, '', url.toString());
          showToast('Unrecognized board ID, defaulting to Deals & Pipeline');
        }
      }
      const buParam = urlParams.get('bu');
      if (buParam) {
        setSelectedBu(buParam);
      }
    }

    loadData();
  }, []);

  // Save to API & LocalStorage whenever allBoards change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('monday_crm_all_boards', JSON.stringify(allBoards));
      
      // Sync with API
      fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: currentBoardId,
          boardData: currentBoard,
        }),
      }).catch((err) => console.log('API sync background notice', err));
    }
  }, [allBoards, currentBoardId, isLoaded]);

  // Update item properties
  const handleUpdateItem = (groupId: string, itemId: string, updates: Partial<CRMItem>) => {
    setAllBoards((prev) => {
      const board = prev[currentBoardId];
      if (!board) return prev;

      const newGroups = board.groups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          items: group.items.map((item) => {
            if (item.id !== itemId) return item;
            const updated = { ...item, ...updates };
            if (selectedItem && selectedItem.item.id === itemId) {
              setSelectedItem({ item: updated, groupId });
            }
            return updated;
          }),
        };
      });

      return {
        ...prev,
        [currentBoardId]: {
          ...board,
          groups: newGroups,
        },
      };
    });
    showToast(t('toast_updated_success'));
  };

  const handleUpdateItemStatus = (itemId: string, newStatus: StatusType) => {
    setAllBoards((prev) => {
      const board = prev[currentBoardId];
      if (!board) return prev;

      let targetGroupId = '';
      board.groups.forEach((g) => {
        if (g.items.some((i) => i.id === itemId)) {
          targetGroupId = g.id;
        }
      });

      if (!targetGroupId) return prev;

      const newGroups = board.groups.map((group) => {
        if (group.id !== targetGroupId) return group;
        return {
          ...group,
          items: group.items.map((item) => {
            if (item.id !== itemId) return item;
            const updated = { ...item, status: newStatus };
            if (selectedItem && selectedItem.item.id === itemId) {
              setSelectedItem({ item: updated, groupId: targetGroupId });
            }
            return updated;
          }),
        };
      });

      return {
        ...prev,
        [currentBoardId]: {
          ...board,
          groups: newGroups,
        },
      };
    });
    showToast(`${t('toast_status_updated')} ${t(newStatus)}`);
  };

  const handleDeleteItem = (groupId: string, itemId: string) => {
    setAllBoards((prev) => {
      const board = prev[currentBoardId];
      if (!board) return prev;

      const newGroups = board.groups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          items: group.items.filter((item) => item.id !== itemId),
        };
      });

      return {
        ...prev,
        [currentBoardId]: {
          ...board,
          groups: newGroups,
        },
      };
    });
    if (selectedItem && selectedItem.item.id === itemId) {
      setSelectedItem(null);
    }
    showToast(t('toast_item_deleted'));
  };

  const handleAddItem = (groupId: string, name: string) => {
    if (!name.trim()) return;

    const newItem: CRMItem = {
      id: `item-${Date.now()}`,
      name,
      contactPerson: 'New Contact',
      contactEmail: 'contact@company.com',
      dealValue: 50000,
      status: 'Working on it',
      priority: 'Medium',
      owner: TEAM_MEMBERS[0],
      expectedCloseDate: '2026-09-30',
      probability: 50,
      createdAt: new Date().toISOString().split('T')[0],
      notes: 'Initial discussion',
    };

    setAllBoards((prev) => {
      const board = prev[currentBoardId];
      if (!board) return prev;

      const newGroups = board.groups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          items: [...group.items, newItem],
        };
      });

      return {
        ...prev,
        [currentBoardId]: {
          ...board,
          groups: newGroups,
        },
      };
    });
    showToast(`${t('toast_added')} "${name}"`);
  };

  const handleAddGroup = (title: string) => {
    const newGroup: CRMGroup = {
      id: `group-${Date.now()}`,
      title: title || 'New Stage Group',
      color: '#ff7a59',
      items: [],
    };

    setAllBoards((prev) => {
      const board = prev[currentBoardId];
      if (!board) return prev;

      return {
        ...prev,
        [currentBoardId]: {
          ...board,
          groups: [...board.groups, newGroup],
        },
      };
    });
    showToast(`${t('toast_added_group')} "${title}"`);
  };

  const handleToggleGroupCollapse = (groupId: string) => {
    setAllBoards((prev) => {
      const board = prev[currentBoardId];
      if (!board) return prev;

      const newGroups = board.groups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          isCollapsed: !group.isCollapsed,
        };
      });

      return {
        ...prev,
        [currentBoardId]: {
          ...board,
          groups: newGroups,
        },
      };
    });
  };

  const handleConvertLead = (leadItem: CRMItem) => {
    const dealItem: CRMItem = {
      ...leadItem,
      id: `deal-${Date.now()}`,
      status: 'Qualified',
      notes: `Converted from Lead on ${new Date().toLocaleDateString()}`,
    };

    setAllBoards((prev) => {
      const dealsBoard = prev['board-5030723273'];
      if (!dealsBoard) return prev;

      const targetGroup = dealsBoard.groups[0];
      if (!targetGroup) return prev;

      const updatedDealsGroups = dealsBoard.groups.map((g, idx) => {
        if (idx === 0) {
          return {
            ...g,
            items: [dealItem, ...g.items],
          };
        }
        return g;
      });

      return {
        ...prev,
        ['board-5030723273']: {
          ...dealsBoard,
          groups: updatedDealsGroups,
        },
      };
    });

    showToast(`${t('toast_converted')} "${leadItem.name}" ${t('toast_to_deals')}`);
  };

  const handleImportItems = (items: Partial<CRMItem>[], targetGroupName: string) => {
    setAllBoards((prev) => {
      const board = prev[currentBoardId];
      if (!board) return prev;

      const formattedItems: CRMItem[] = items.map((item, idx) => ({
        id: `import-${Date.now()}-${idx}`,
        name: item.name || 'Imported Deal',
        contactPerson: item.contactPerson || 'Unknown Contact',
        contactEmail: item.contactEmail || '',
        contactPhone: item.contactPhone || '',
        dealValue: Number(item.dealValue) || 0,
        status: (item.status as StatusType) || 'Working on it',
        priority: (item.priority as any) || 'Medium',
        owner: item.owner || TEAM_MEMBERS[0],
        expectedCloseDate: item.expectedCloseDate || '2026-10-31',
        probability: Number(item.probability) || 50,
        notes: item.notes || 'Imported from Excel',
        createdAt: new Date().toISOString().split('T')[0],
      }));

      const newGroups = board.groups.map((g) => {
        if (g.title === targetGroupName || g.id === targetGroupName) {
          return { ...g, items: [...g.items, ...formattedItems] };
        }
        return g;
      });

      return {
        ...prev,
        [currentBoardId]: {
          ...board,
          groups: newGroups,
        },
      };
    });

    showToast(`${t('toast_imported')} ${items.length} ${t('items')}!`);
  };

  const handleExportExcel = () => {
    exportBoardToExcel(currentBoard);
    showToast(`${t('toast_exported')} "${t(currentBoard.id) || currentBoard.name}" ${t('toast_to_excel')}`);
  };

  // Filter groups by search and owner
  const filteredGroups = currentBoard.groups.map((group) => {
    const items = group.items.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.companyName && item.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.address && item.address.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchOwner = selectedOwner === 'ALL' || item.owner.name === selectedOwner;
      return matchSearch && matchOwner;
    });

    return {
      ...group,
      items,
    };
  });

  const handleTabChange = (tab: string) => {
    setHubspotNavTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tab === 'dashboard') {
        url.searchParams.delete('tab');
        url.searchParams.delete('board');
      } else {
        url.searchParams.set('tab', tab);
        if (tab !== 'deals') {
          url.searchParams.delete('board');
        }
      }
      window.history.replaceState(null, '', url.toString());
    }
  };

  const handleSelectBoard = (id: string) => {
    setCurrentBoardId(id);
    setHubspotNavTab('deals');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'deals');
      url.searchParams.set('board', id);
      window.history.replaceState(null, '', url.toString());
    }
  };

  const handleBuChange = (bu: string) => {
    setSelectedBu(bu);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (bu === 'ALL') {
        url.searchParams.delete('bu');
      } else {
        url.searchParams.set('bu', bu);
      }
      window.history.replaceState(null, '', url.toString());
    }
  };

  const handleOpenCreateModal = () => {
    if (hubspotNavTab !== 'deals') {
      handleTabChange('deals');
    }
    if (currentBoard.groups[0]) {
      handleAddItem(currentBoard.groups[0].id, 'New Item');
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background font-sans antialiased text-foreground">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-popover text-popover-foreground px-4 py-2.5 rounded-xl shadow-2xl text-xs animate-bounce border border-border">
          <CheckCircle2 size={16} className="text-violet-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Global Minimal Single-Line Header */}
      <HubSpotHeader
        currentTab={hubspotNavTab}
        onTabChange={handleTabChange}
        onOpenCreateModal={handleOpenCreateModal}
        onOpenLineSettings={() => setIsLineSettingsOpen(true)}
        selectedBu={selectedBu}
        onBuChange={handleBuChange}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* 2. Main Content Body with Persistent Left Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Persistent Left Sidebar Navigation */}
        <Sidebar
          currentTab={hubspotNavTab}
          onTabChange={handleTabChange}
          currentBoardId={currentBoardId}
          onSelectBoard={handleSelectBoard}
          onOpenLineSettings={() => setIsLineSettingsOpen(true)}
          selectedBu={selectedBu}
          onBuChange={handleBuChange}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          boardsCountMap={Object.keys(allBoards).reduce((acc, key) => {
            const b = allBoards[key];
            acc[key] = b ? b.groups.reduce((cnt, g) => cnt + g.items.length, 0) : 0;
            return acc;
          }, {} as Record<string, number>)}
        />

        {/* Right Main Dynamic Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          {/* VIEW 0: Executive CRM & Sales Dashboard */}
          {hubspotNavTab === 'dashboard' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <ExecutiveDashboard selectedBu={selectedBu} onBuChange={handleBuChange} />
            </div>
          )}

          {/* VIEW: Omni Chat Desk */}
          {hubspotNavTab === 'chat' && (
            <div className="flex-1 flex overflow-hidden">
              <ChatDeskView embedded selectedBu={selectedBu} onBuChange={handleBuChange} />
            </div>
          )}

          {/* VIEW 1: HubSpot Object Lists & Segments View */}
          {hubspotNavTab === 'lists' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <HubSpotListsView />
            </div>
          )}

          {/* VIEW 2: HubSpot Contacts & 3-Column Profile */}
          {hubspotNavTab === 'contacts' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <HubSpotContactsView />
            </div>
          )}

          {/* VIEW: Supervisor Workforce & Adherence Center */}
          {hubspotNavTab === 'supervisor' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <SupervisorDashboard selectedBu={selectedBu} onBuChange={handleBuChange} />
            </div>
          )}

          {/* VIEW 3: Deals / Sales Pipeline / Field Service Boards */}
          {(hubspotNavTab === 'deals' || hubspotNavTab === 'companies' || hubspotNavTab === 'reports') && (
            <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
              <BoardHeader
                currentBoard={currentBoard}
                activeView={activeView}
                setActiveView={setActiveView}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                selectedOwner={selectedOwner}
                setSelectedOwner={setSelectedOwner}
                onAddNewItem={() => {
                  if (currentBoard.groups[0]) {
                    handleAddItem(currentBoard.groups[0].id, 'New Item');
                  }
                }}
                onExportExcel={handleExportExcel}
                onOpenImport={() => setIsImportOpen(true)}
              />

              <div className="flex-1 overflow-y-auto bg-background">
                {activeView === 'table' && (
                  <TableView
                    currentBoard={currentBoard}
                    groups={filteredGroups}
                    onUpdateItem={handleUpdateItem}
                    onDeleteItem={handleDeleteItem}
                    onAddItem={handleAddItem}
                    onToggleGroupCollapse={handleToggleGroupCollapse}
                    onAddGroup={handleAddGroup}
                    onSelectItem={(item, groupId) => setSelectedItem({ item, groupId })}
                    onConvertLead={handleConvertLead}
                  />
                )}

                {activeView === 'kanban' && (
                  <KanbanView
                    groups={filteredGroups}
                    onUpdateItemStatus={handleUpdateItemStatus}
                    onSelectItem={(item, groupId) => setSelectedItem({ item, groupId })}
                  />
                )}

                {activeView === 'dispatch' && (
                  <DispatchBoardView
                    groups={filteredGroups}
                    onUpdateItemStatus={handleUpdateItemStatus}
                    onSelectItem={(item, groupId) => setSelectedItem({ item, groupId })}
                  />
                )}

                {activeView === 'dashboard' && (
                  <DashboardView groups={currentBoard.groups} />
                )}

                {activeView === 'activity' && (
                  <ActivityLogView groups={currentBoard.groups} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Item Detail / Notes Drawer */}
      {selectedItem && (
        <ItemDrawer
          item={selectedItem.item}
          groupId={selectedItem.groupId}
          boardType={currentBoard.type}
          onClose={() => setSelectedItem(null)}
          onUpdateItem={handleUpdateItem}
          onConvertLead={handleConvertLead}
        />
      )}

      {/* 4. Import Excel / CSV Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={(items) => handleImportItems(items, currentBoard.groups[0]?.title || 'First Group')}
        targetGroupName={currentBoard.groups[0]?.title || 'First Group'}
      />

      {/* 5. LINE Messaging API & Channel Settings Modal */}
      <LineSettingsModal
        isOpen={isLineSettingsOpen}
        onClose={() => setIsLineSettingsOpen(false)}
      />
    </div>
  );
}

export default function Home() {
  return <HomeContent />;
}
