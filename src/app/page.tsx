'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { BoardHeader } from '@/components/BoardHeader';
import { TableView } from '@/components/TableView';
import { KanbanView } from '@/components/KanbanView';
import { DashboardView } from '@/components/DashboardView';
import { ActivityLogView } from '@/components/ActivityLogView';
import { ItemDrawer } from '@/components/ItemDrawer';
import { CRMBoard, CRMGroup, CRMItem, ActiveView, StatusType } from '@/types/crm';
import { INITIAL_BOARD_DATA, TEAM_MEMBERS } from '@/data/mockData';

export default function Home() {
  const [boardData, setBoardData] = useState<CRMBoard>(INITIAL_BOARD_DATA);
  const [activeView, setActiveView] = useState<ActiveView>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState<{ item: CRMItem; groupId: string } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('monday_crm_board_data');
      if (saved) {
        setBoardData(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load board data from localStorage', e);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('monday_crm_board_data', JSON.stringify(boardData));
    }
  }, [boardData, isLoaded]);

  // Update item properties
  const handleUpdateItem = (groupId: string, itemId: string, updates: Partial<CRMItem>) => {
    setBoardData((prev) => {
      const newGroups = prev.groups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          items: group.items.map((item) => {
            if (item.id !== itemId) return item;
            const updated = { ...item, ...updates };
            // Also sync selectedItem state if it's currently open in drawer
            if (selectedItem && selectedItem.item.id === itemId) {
              setSelectedItem({ item: updated, groupId });
            }
            return updated;
          }),
        };
      });
      return { ...prev, groups: newGroups };
    });
  };

  // Update item status directly across any group
  const handleUpdateItemStatus = (itemId: string, newStatus: StatusType) => {
    setBoardData((prev) => {
      const newGroups = prev.groups.map((group) => ({
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
      return { ...prev, groups: newGroups };
    });
  };

  // Delete item
  const handleDeleteItem = (groupId: string, itemId: string) => {
    setBoardData((prev) => {
      const newGroups = prev.groups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          items: group.items.filter((item) => item.id !== itemId),
        };
      });
      return { ...prev, groups: newGroups };
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
      status: 'Working on it',
      priority: 'Medium',
      owner: TEAM_MEMBERS[0],
      expectedCloseDate: new Date().toISOString().split('T')[0],
      probability: 50,
      leadSource: 'Direct Outreach',
      createdAt: new Date().toISOString().split('T')[0],
      activities: [
        {
          id: `act-${Date.now()}`,
          user: 'Isara Chootip',
          avatar: '👨‍💼',
          action: `Created new deal "${itemName}"`,
          timestamp: 'Just now',
        }
      ]
    };

    setBoardData((prev) => {
      const newGroups = prev.groups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          items: [...group.items, newItem],
        };
      });
      return { ...prev, groups: newGroups };
    });
  };

  // Quick Add from Board Header button (adds to first group)
  const handleHeaderAddNewItem = () => {
    if (boardData.groups.length > 0) {
      const firstGroupId = boardData.groups[0].id;
      handleAddItem(firstGroupId, 'New Enterprise Opportunity');
    }
  };

  // Toggle group collapse
  const handleToggleGroupCollapse = (groupId: string) => {
    setBoardData((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId ? { ...g, isCollapsed: !g.isCollapsed } : g
      ),
    }));
  };

  // Add new group
  const handleAddGroup = (title: string) => {
    const colors = ['#0073ea', '#00c875', '#fdab3d', '#a25ddc', '#579bfc', '#e2445c'];
    const randomColor = colors[boardData.groups.length % colors.length];

    const newGroup: CRMGroup = {
      id: `grp-${Date.now()}`,
      title,
      color: randomColor,
      isCollapsed: false,
      items: [],
    };

    setBoardData((prev) => ({
      ...prev,
      groups: [...prev.groups, newGroup],
    }));
  };

  // Filter groups and items based on search and owner filter
  const filteredGroups: CRMGroup[] = boardData.groups.map((group) => {
    const items = group.items.filter((item) => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.status.toLowerCase().includes(searchTerm.toLowerCase());
      
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
        currentBoardId={boardData.id}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {/* Board Header & View Switcher */}
        <BoardHeader
          activeView={activeView}
          setActiveView={setActiveView}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedOwner={selectedOwner}
          setSelectedOwner={setSelectedOwner}
          onAddNewItem={handleHeaderAddNewItem}
        />

        {/* View Body */}
        <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
          {activeView === 'table' && (
            <TableView
              groups={filteredGroups}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onAddItem={handleAddItem}
              onToggleGroupCollapse={handleToggleGroupCollapse}
              onAddGroup={handleAddGroup}
              onSelectItem={(item, groupId) => setSelectedItem({ item, groupId })}
            />
          )}

          {activeView === 'kanban' && (
            <KanbanView
              groups={filteredGroups}
              onUpdateItemStatus={handleUpdateItemStatus}
              onSelectItem={(item, groupId) => setSelectedItem({ item, groupId })}
            />
          )}

          {activeView === 'dashboard' && (
            <DashboardView groups={boardData.groups} />
          )}

          {activeView === 'activity' && (
            <ActivityLogView groups={boardData.groups} />
          )}
        </div>
      </div>

      {/* 3. Item Detail / Notes Drawer */}
      {selectedItem && (
        <ItemDrawer
          item={selectedItem.item}
          groupId={selectedItem.groupId}
          onClose={() => setSelectedItem(null)}
          onUpdateItem={handleUpdateItem}
        />
      )}
    </div>
  );
}
