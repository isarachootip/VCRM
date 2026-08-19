'use client';

import React, { useState } from 'react';
import { 
  Home, 
  LayoutGrid, 
  Bell, 
  Inbox, 
  Star, 
  Search, 
  Plus, 
  ChevronRight, 
  ChevronDown, 
  Table, 
  Users, 
  Briefcase, 
  TrendingUp, 
  Settings, 
  HelpCircle,
  Folder,
  Layers,
  Sparkles,
  Contact,
  Building2,
  LucideIcon
} from 'lucide-react';
import { CRMBoard } from '@/types/crm';

interface SidebarProps {
  currentBoardId: string;
  onSelectBoard: (boardId: string) => void;
  boardsCountMap?: Record<string, number>;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentBoardId, 
  onSelectBoard,
  boardsCountMap = {}
}) => {
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);

  const boards: { id: string; name: string; icon: LucideIcon; color: string; badge?: string }[] = [
    { id: 'board-5030723273', name: 'Deals & Sales Pipeline', icon: Briefcase, color: 'text-blue-500', badge: 'Active' },
    { id: 'board-leads', name: 'Inbound Leads 2026', icon: Users, color: 'text-amber-500', badge: 'Funnel' },
    { id: 'board-accounts', name: 'Key Enterprise Accounts', icon: Building2, color: 'text-purple-500', badge: '360°' },
    { id: 'board-contacts', name: 'Contacts & Stakeholders', icon: Contact, color: 'text-emerald-500' },
    { id: 'board-growth', name: 'Sales Forecast & Targets', icon: TrendingUp, color: 'text-rose-500' },
  ];

  return (
    <div className="flex h-screen select-none bg-white border-r border-[#e6e9ef] shrink-0">
      {/* 1. Leftmost Mini Icon Bar (Monday Style) */}
      <div className="w-[52px] bg-[#292f4c] flex flex-col items-center justify-between py-3 text-gray-300">
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Monday Logo */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-500 via-amber-400 to-emerald-400 flex items-center justify-center text-white font-black text-sm shadow-md cursor-pointer hover:scale-105 transition-transform" title="Monday CRM / Work OS">
            M
          </div>
          
          <div className="w-8 h-[1px] bg-gray-700/60 my-1"></div>

          {/* Primary Nav Icons */}
          <button className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/10 text-white transition-colors" title="Home">
            <Home size={18} />
          </button>
          <button className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/15 text-white transition-colors" title="Workspaces">
            <LayoutGrid size={18} />
          </button>
          <button className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-300 relative transition-colors" title="Notifications">
            <Bell size={18} />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#0073ea]"></span>
          </button>
          <button className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-300 transition-colors" title="Inbox / Updates">
            <Inbox size={18} />
          </button>
          <button className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-300 transition-colors" title="Favorites">
            <Star size={18} />
          </button>
        </div>

        {/* Bottom Bar Icons */}
        <div className="flex flex-col items-center gap-3">
          <button className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-sm hover:opacity-90" title="Monday AI Sidekick">
            <Sparkles size={16} />
          </button>
          <button className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400" title="Help & Support">
            <HelpCircle size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-[#0073ea] text-white flex items-center justify-center font-semibold text-xs border-2 border-white cursor-pointer" title="Isara Chootip (Admin)">
            IC
          </div>
        </div>
      </div>

      {/* 2. Workspace Navigation Panel */}
      <div className="w-[245px] flex flex-col justify-between bg-white text-[#323338] border-r border-[#e6e9ef]">
        <div>
          {/* Workspace Switcher Header */}
          <div className="p-3 border-b border-[#e6e9ef] flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-6 h-6 rounded bg-[#0073ea] text-white flex items-center justify-center font-bold text-xs shrink-0">
                I
              </div>
              <span className="font-semibold text-xs tracking-tight truncate text-[#323338]">
                isarachootip's Team
              </span>
            </div>
            <ChevronDown size={14} className="text-gray-400 cursor-pointer" />
          </div>

          {/* Quick Search & Add */}
          <div className="p-2 flex gap-1">
            <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 bg-[#f5f6f8] rounded-md text-xs text-gray-500 hover:bg-[#ebedf0] cursor-pointer">
              <Search size={14} />
              <span>Search CRM...</span>
            </div>
            <button className="p-1.5 bg-[#0073ea] text-white rounded-md hover:bg-[#0060b9] transition-colors" title="Add Board">
              <Plus size={14} />
            </button>
          </div>

          {/* Boards List */}
          <div className="px-2 py-2">
            <div 
              className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
              onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
            >
              <div className="flex items-center gap-1">
                {isWorkspaceOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>CRM & Sales Modules</span>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                {boards.length}
              </span>
            </div>

            {isWorkspaceOpen && (
              <div className="mt-1 space-y-0.5">
                {boards.map((board) => {
                  const Icon = board.icon;
                  const isActive = currentBoardId === board.id;
                  const count = boardsCountMap[board.id];

                  return (
                    <div
                      key={board.id}
                      onClick={() => onSelectBoard(board.id)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors ${
                        isActive 
                          ? 'bg-[#e5f2ff] text-[#0073ea] font-bold border-l-3 border-[#0073ea]' 
                          : 'text-[#323338] hover:bg-[#f5f6f8]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon size={15} className={isActive ? 'text-[#0073ea]' : 'text-gray-400'} />
                        <span className="truncate">{board.name}</span>
                      </div>
                      {typeof count === 'number' && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.2 rounded font-semibold ml-1">
                          {count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Sidebar Settings */}
        <div className="p-3 border-t border-[#e6e9ef] flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2 hover:text-[#0073ea] cursor-pointer">
            <Settings size={14} />
            <span>Workspace Settings</span>
          </div>
          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">
            Enterprise Pro
          </span>
        </div>
      </div>
    </div>
  );
};
