'use client';

import React, { useState, useEffect } from 'react';
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
import { CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export default function Home() {
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
        [currentBoardId]: { ...board, groups: newGroups },
      };
    });
  };

  // Update item status directly across any group
  const handleUpdateItemStatus = (itemId: string, newStatus: StatusType) => {
    setAllBoards((prev) => {
      const board = prev[currentBoardId];
      if (!board) return prev;

      const newGroups = board.groups.map((group) => ({
        ...group,
        items: group.items.map((item) => {
          if (item.id !== itemId) return item;
          const updated = { ...item, status: newStatus };
          if (selectedItem && selectedItem.item.id === itemId) {
            setSelectedItem({ item: updated, groupId: group.id });
          }
          return updated;
        }),
      }));

      return {
        ...prev,
        [currentBoardId]: { ...board, groups: newGroups },
      };
    });
  };

  // Delete item
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
        [currentBoardId]: { ...board, groups: newGroups },
      };
    });

    if (selectedItem?.item.id === itemId) {
      setSelectedItem(null);
    }
  };

  // Add new item into a specific group
  const handleAddItem = (groupId: string, itemName: string) => {
    const newItem: CRMItem = {
      id: `item-${Date.now()}`,
      name: itemName,
      contactPerson: 'Contact Person',
      contactEmail: 'contact@domain.mock',
      dealValue: 500000,
      status: currentBoard.type === 'leads' ? 'New Lead' : currentBoard.type === 'accounts' ? 'Tier 2 Growth' : currentBoard.type === 'contacts' ? 'Decision Maker' : 'Working on it',
      priority: 'Medium',
      owner: TEAM_MEMBERS[0],
      expectedCloseDate: new Date().toISOString().split('T')[0],
      probability: 50,
      leadSource: 'Direct Inbound',
      createdAt: new Date().toISOString().split('T')[0],
      activities: [
        {
          id: `act-${Date.now()}`,
          user: 'Isara Chootip',
          avatar: '👨‍💼',
          action: `Created new ${currentBoard.type === 'leads' ? 'lead' : 'item'} "${itemName}"`,
          timestamp: 'Just now',
        }
      ]
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
        [currentBoardId]: { ...board, groups: newGroups },
      };
    });
  };

  // Quick Add from Board Header button
  const handleHeaderAddNewItem = () => {
    if (currentBoard.groups.length > 0) {
      const firstGroupId = currentBoard.groups[0].id;
      handleAddItem(firstGroupId, `New ${currentBoard.type === 'leads' ? 'Inbound Lead' : currentBoard.type === 'accounts' ? 'Enterprise Account' : currentBoard.type === 'contacts' ? 'Key Stakeholder' : 'Opportunity'}`);
    }
  };

  // Toggle group collapse
  const handleToggleGroupCollapse = (groupId: string) => {
    setAllBoards((prev) => {
      const board = prev[currentBoardId];
      if (!board) return prev;

      const newGroups = board.groups.map((g) =>
        g.id === groupId ? { ...g, isCollapsed: !g.isCollapsed } : g
      );

      return {
        ...prev,
        [currentBoardId]: { ...board, groups: newGroups },
      };
    });
  };

  // Add new group
  const handleAddGroup = (title: string) => {
    const colors = ['#0073ea', '#00c875', '#fdab3d', '#a25ddc', '#579bfc', '#e2445c'];
    const randomColor = colors[currentBoard.groups.length % colors.length];

    const newGroup: CRMGroup = {
      id: `grp-${Date.now()}`,
      title,
      color: randomColor,
      isCollapsed: false,
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
  };

  // Convert Lead -> Active Deal + Account
  const handleConvertLead = async (leadItem: CRMItem, groupId: string) => {
    // 1. Update local state: move lead to Qualified or remove from uncontacted
    handleUpdateItem(groupId, leadItem.id, { status: 'Qualified' });

    // 2. Add to Deals Board
    const newDeal: CRMItem = {
      id: `deal-conv-${Date.now()}`,
      name: leadItem.name,
      companyName: leadItem.companyName || leadItem.name,
      contactPerson: leadItem.contactPerson,
      contactEmail: leadItem.contactEmail,
      contactPhone: leadItem.contactPhone,
      dealValue: leadItem.dealValue || 800000,
      status: 'Working on it',
      priority: leadItem.priority || 'High',
      owner: leadItem.owner || TEAM_MEMBERS[0],
      expectedCloseDate: leadItem.expectedCloseDate,
      probability: 60,
      industry: leadItem.industry || 'Enterprise',
      leadSource: `Converted Lead (${leadItem.leadSource || 'Inbound'})`,
      notes: `Converted from Lead on ${new Date().toLocaleDateString()}. Notes: ${leadItem.notes || ''}`,
      createdAt: new Date().toISOString().split('T')[0],
      activities: [
        {
          id: `act-${Date.now()}`,
          user: 'Isara Chootip',
          avatar: '⚡',
          action: `Converted Lead "${leadItem.name}" into an Active Sales Deal`,
          timestamp: 'Just now',
        }
      ]
    };

    // 3. Add to Accounts Board
    const newAccount: CRMItem = {
      id: `acc-conv-${Date.now()}`,
      name: leadItem.companyName || leadItem.name,
      companyName: leadItem.companyName || leadItem.name,
      contactPerson: leadItem.contactPerson,
      contactEmail: leadItem.contactEmail,
      contactPhone: leadItem.contactPhone,
      dealValue: leadItem.dealValue || 800000,
      status: 'Tier 2 Growth',
      priority: leadItem.priority || 'High',
      owner: leadItem.owner || TEAM_MEMBERS[0],
      expectedCloseDate: leadItem.expectedCloseDate,
      probability: 70,
      industry: leadItem.industry || 'General Industry',
      leadSource: leadItem.leadSource || 'Inbound Lead',
      notes: `Account created from converted lead`,
      createdAt: new Date().toISOString().split('T')[0],
      activities: []
    };

    setAllBoards((prev) => {
      const dealsBoard = prev['board-5030723273'];
      const accountsBoard = prev['board-accounts'];

      const updatedDeals = dealsBoard ? {
        ...dealsBoard,
        groups: dealsBoard.groups.map((g, idx) => idx === 0 ? { ...g, items: [newDeal, ...g.items] } : g)
      } : dealsBoard;

      const updatedAccounts = accountsBoard ? {
        ...accountsBoard,
        groups: accountsBoard.groups.map((g, idx) => idx === 0 ? { ...g, items: [newAccount, ...g.items] } : g)
      } : accountsBoard;

      return {
        ...prev,
        'board-5030723273': updatedDeals,
        'board-accounts': updatedAccounts,
      };
    });

    showToast(`⚡ Lead "${leadItem.name}" has been converted into an Active Deal and Company Account!`);
  };

  // Export to Excel handler
  const handleExportExcel = () => {
    exportBoardToExcel(currentBoard);
    showToast(`📁 Exported "${currentBoard.name}" to Excel (.xlsx) successfully!`);
  };

  // Import rows handler
  const handleImportItems = (importedItems: Partial<CRMItem>[]) => {
    if (currentBoard.groups.length === 0) return;

    const firstGroup = currentBoard.groups[0];
    const fullItems: CRMItem[] = importedItems.map((raw, idx) => ({
      id: `imported-${Date.now()}-${idx}`,
      name: raw.name || 'Imported Deal',
      companyName: raw.companyName || '',
      contactPerson: raw.contactPerson || 'Contact Person',
      contactEmail: raw.contactEmail || 'contact@mock.com',
      contactPhone: raw.contactPhone || '',
      dealValue: raw.dealValue || 250000,
      status: (raw.status as StatusType) || 'New Lead',
      priority: raw.priority || 'Medium',
      owner: TEAM_MEMBERS[idx % TEAM_MEMBERS.length],
      expectedCloseDate: raw.expectedCloseDate || new Date().toISOString().split('T')[0],
      probability: raw.probability || 50,
      leadSource: raw.leadSource || 'Excel Import',
      industry: raw.industry || 'General',
      notes: raw.notes || 'Imported batch',
      createdAt: new Date().toISOString().split('T')[0],
      activities: []
    }));

    setAllBoards((prev) => {
      const board = prev[currentBoardId];
      if (!board) return prev;

      const newGroups = board.groups.map((g, i) =>
        i === 0 ? { ...g, items: [...fullItems, ...g.items] } : g
      );

      return {
        ...prev,
        [currentBoardId]: { ...board, groups: newGroups },
      };
    });

    showToast(`✅ Successfully imported ${fullItems.length} records into "${firstGroup.title}"!`);
  };

  // Boards counts map for sidebar
  const boardsCountMap: Record<string, number> = {};
  Object.keys(allBoards).forEach((key) => {
    boardsCountMap[key] = allBoards[key]?.groups.reduce((acc, g) => acc + g.items.length, 0) || 0;
  });

  // Filter groups and items based on search and owner filter
  const filteredGroups: CRMGroup[] = currentBoard.groups.map((group) => {
    const items = group.items.filter((item) => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.companyName && item.companyName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesOwner = selectedOwner === 'ALL' || item.owner.name === selectedOwner;
      return matchesSearch && matchesOwner;
    });

    return {
      ...group,
      items,
    };
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f5f6f8] font-sans">
      {/* 1. Sidebar */}
      <Sidebar
        currentBoardId={currentBoardId}
        onSelectBoard={(boardId) => {
          setCurrentBoardId(boardId);
          setSearchTerm('');
        }}
        boardsCountMap={boardsCountMap}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="absolute top-4 right-6 z-50 bg-[#1f2937] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl border border-gray-700 flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
            <Sparkles size={14} className="text-amber-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Board Header & View Switcher */}
        <BoardHeader
          currentBoard={currentBoard}
          activeView={activeView}
          setActiveView={setActiveView}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedOwner={selectedOwner}
          setSelectedOwner={setSelectedOwner}
          onAddNewItem={handleHeaderAddNewItem}
          onExportExcel={handleExportExcel}
          onOpenImport={() => setIsImportOpen(true)}
        />

        {/* View Body */}
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
        onImport={handleImportItems}
        targetGroupName={currentBoard.groups[0]?.title || 'First Group'}
      />
    </div>
  );
}
