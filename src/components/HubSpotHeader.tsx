'use client';

import React from 'react';
import { 
  Search, 
  Plus, 
  Bell, 
  Settings, 
  HelpCircle, 
  ChevronDown,
  Sparkles,
  Layers,
  Users,
  Building2,
  Briefcase,
  ListFilter,
  BarChart3,
  ShieldCheck
} from 'lucide-react';

interface HubSpotHeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenCreateModal?: () => void;
}

export const HubSpotHeader: React.FC<HubSpotHeaderProps> = ({
  currentTab,
  onTabChange,
  onOpenCreateModal
}) => {
  return (
    <header className="bg-[#1f2937] text-white border-b border-slate-700 select-none text-sm z-30 shrink-0">
      {/* Top Main Navigation Bar */}
      <div className="flex items-center justify-between px-4 h-13">
        {/* Left: VCRM Brand & Primary Navigation */}
        <div className="flex items-center space-x-1 sm:space-x-4">
          {/* VCRM Brand Logo */}
          <div 
            onClick={() => onTabChange('lists')}
            className="flex items-center gap-2.5 cursor-pointer pr-2 hover:opacity-95 transition-opacity"
          >
            {/* VCRM Geometric Logo Badge */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#ff5c35] via-[#ff7a59] to-[#ff9e7d] flex items-center justify-center text-white shadow-md font-black text-base ring-1 ring-white/20">
              <span className="tracking-tighter font-extrabold text-white text-lg">V</span>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-white text-base tracking-tight leading-none flex items-center gap-1.5">
                VCRM
                <span className="text-[10px] bg-orange-500/20 text-orange-400 font-semibold px-1.5 py-0.2 rounded border border-orange-500/30">
                  PRO
                </span>
              </span>
              <span className="text-[9px] text-slate-400 font-medium tracking-wider uppercase mt-0.5">
                OmniService & Lists
              </span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-slate-700 hidden sm:block"></div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1">
            <button
              onClick={() => onTabChange('lists')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                currentTab === 'lists'
                  ? 'bg-slate-800 text-orange-400 border border-orange-500/30 shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <ListFilter size={14} className={currentTab === 'lists' ? 'text-orange-400' : 'text-slate-400'} />
              <span>Lists & Segments</span>
              <span className="bg-orange-500/20 text-orange-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">25</span>
            </button>

            <button
              onClick={() => onTabChange('contacts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                currentTab === 'contacts'
                  ? 'bg-slate-800 text-orange-400 border border-orange-500/30 shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Users size={14} className={currentTab === 'contacts' ? 'text-orange-400' : 'text-slate-400'} />
              <span>Contacts</span>
            </button>

            <button
              onClick={() => onTabChange('deals')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                currentTab === 'deals'
                  ? 'bg-slate-800 text-orange-400 border border-orange-500/30 shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Briefcase size={14} className={currentTab === 'deals' ? 'text-orange-400' : 'text-slate-400'} />
              <span>Sales Pipeline</span>
            </button>

            <button
              onClick={() => onTabChange('companies')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors hidden lg:flex ${
                currentTab === 'companies'
                  ? 'bg-slate-800 text-orange-400 border border-orange-500/30 shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Building2 size={14} className="text-slate-400" />
              <span>Companies</span>
            </button>

            <button
              onClick={() => onTabChange('reports')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors hidden xl:flex ${
                currentTab === 'reports'
                  ? 'bg-slate-800 text-orange-400 border border-orange-500/30 shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <BarChart3 size={14} className="text-slate-400" />
              <span>Reports</span>
            </button>
          </nav>
        </div>

        {/* Right: Search, Create Button, VCRM Portal ID & Profile */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Quick Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search VCRM (Ctrl+K)..."
              className="bg-slate-800/90 text-xs text-white placeholder-slate-400 rounded pl-8 pr-3 py-1.5 w-44 lg:w-56 focus:outline-none focus:ring-1 focus:ring-orange-400 border border-slate-700"
            />
          </div>

          {/* Create Button (+ VCRM Orange Accent) */}
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 bg-[#ff7a59] hover:bg-[#ff5c35] text-white px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Create</span>
            <ChevronDown size={12} className="opacity-80" />
          </button>

          {/* VCRM Portal ID badge */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded text-[11px] text-slate-300 font-mono border border-slate-700">
            <ShieldCheck size={13} className="text-emerald-400" />
            <span className="text-slate-400">Portal ID:</span>
            <span className="font-semibold text-orange-300">247092555</span>
          </div>

          {/* Quick Action Icons */}
          <button className="w-8 h-8 rounded hover:bg-slate-800 flex items-center justify-center text-slate-300 relative transition-colors" title="Notifications">
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-slate-800"></span>
          </button>

          <button className="w-8 h-8 rounded hover:bg-slate-800 flex items-center justify-center text-slate-300 transition-colors" title="Settings">
            <Settings size={16} />
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-1 cursor-pointer">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces"
              alt="Admin Profile"
              className="w-7 h-7 rounded-full border border-orange-400/80 object-cover ring-1 ring-white/10"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
