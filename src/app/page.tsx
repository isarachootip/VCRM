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
import { CRMBoard, CRMGroup, CRMItem, ActiveView, StatusType } from '@/types/crm';
import { INITIAL_BOARDS, TEAM_MEMBERS } from '@/data/mockData';
import { exportBoardToExcel } from '@/utils/excelHelper';
import { CheckCircle2, AlertCircle, Sparkles, LayoutList, Kanban, Layers } from 'lucide-react';

export default function Home() {
  // Navigation Mode: 'lists' (HubSpot Object Lists 25 items) | 'contacts' (HubSpot CRM) | 'deals' | 'companies' | 'reports'
  const [hubspotNavTab, setHubspotNavTab] = useState<string>('lists');

  // Boards State
  const [allBoards, setAllBoards] = useState<Record<string, CRMBoard>>(INITIAL_BOARDS);
  const [currentBoardId, setCurrentBoardId] = useState<string>('board-5030723273');
  const [activeView, setActiveView] = useState<ActiveView>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState<{ item: CRMItem; groupId: string } | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

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
    showToast('Updated record successfully');
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
    showToast(`Status updated to ${newStatus}`);
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
    showToast('Item deleted');
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
    showToast(`Added "${name}"`);
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
    showToast(`Added group "${title}"`);
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

    showToast(`Converted "${leadItem.name}" to Deals Pipeline!`);
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

    showToast(`Successfully imported ${items.length} items!`);
  };

  const handleExportExcel = () => {
    exportBoardToExcel(currentBoard);
    showToast(`Exported "${currentBoard.name}" to Excel!`);
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white font-sans antialiased text-slate-800">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs animate-bounce border border-slate-700">
          <CheckCircle2 size={16} className="text-[#ff7a59]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. HubSpot Global Header (Top Navigation with Hub ID: 247092555) */}
      <HubSpotHeader
        currentTab={hubspotNavTab}
        onTabChange={(tab) => setHubspotNavTab(tab)}
      />

      {/* 2. Main Content Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* VIEW 1: HubSpot Object Lists & Segments View (Clone of https://app-na2.hubspot.com/contacts/247092555/objectLists/views/all?count=25) */}
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

        {/* VIEW 3: Deals / Sales Pipeline / Field Service Boards */}
        {(hubspotNavTab === 'deals' || hubspotNavTab === 'companies' || hubspotNavTab === 'reports') && (
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar for Board Navigation */}
            <Sidebar
              currentBoardId={currentBoardId}
              onSelectBoard={(id) => setCurrentBoardId(id)}
              boardsCountMap={Object.keys(allBoards).reduce((acc, key) => {
                const b = allBoards[key];
                acc[key] = b ? b.groups.reduce((cnt, g) => cnt + g.items.length, 0) : 0;
                return acc;
              }, {} as Record<string, number>)}
            />

            {/* Board Workspace Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#f5f6f8] overflow-hidden">
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

              <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
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
          </div>
        )}
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
    </div>
  );
}
