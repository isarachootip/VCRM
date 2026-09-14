'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  LayoutDashboard,
  ShieldCheck,
  MessageSquare,
  ExternalLink,
  QrCode,
  Truck,
  Award,
  Globe,
  LogOut,
  LogIn,
  Key
} from 'lucide-react';
import { useLanguage, Language, SUPPORTED_LANGUAGES } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

interface HubSpotHeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenCreateModal?: () => void;
  onOpenLineSettings?: () => void;
  selectedBu?: string;
  onBuChange?: (bu: string) => void;
}

interface PortalToolLink {
  id: string;
  title: string;
  url: string;
  icon?: string | null;
  category?: string | null;
  businessUnits: string[];
}

const DEFAULT_PORTAL_TOOLS: PortalToolLink[] = [
  {
    id: 'tool_aipx',
    title: 'AIPX',
    url: 'https://aipx.central.co.th',
    icon: 'sparkles',
    category: 'CATALOG',
    businessUnits: ['CENTRAL', 'CDS', 'ROBINSON'],
  },
  {
    id: 'tool_the1',
    title: 'The 1 Portal',
    url: 'https://the1.central.co.th/portal',
    icon: 'award',
    category: 'LOYALTY',
    businessUnits: [],
  },
  {
    id: 'tool_ops',
    title: 'Operation Portal',
    url: 'https://ops.central.co.th',
    icon: 'settings',
    category: 'OPERATIONS',
    businessUnits: [],
  },
  {
    id: 'tool_qr',
    title: 'QR Portal',
    url: 'https://qr.central.co.th',
    icon: 'qr',
    category: 'PAYMENTS',
    businessUnits: [],
  },
  {
    id: 'tool_delivery',
    title: 'Central Delivery Portal',
    url: 'https://logistics.central.co.th',
    icon: 'truck',
    category: 'LOGISTICS',
    businessUnits: ['CENTRAL', 'CDS'],
  },
];

export const HubSpotHeader: React.FC<HubSpotHeaderProps> = ({
  currentTab,
  onTabChange,
  onOpenCreateModal,
  onOpenLineSettings,
  selectedBu = 'ALL',
  onBuChange,
}) => {
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();

  const [buFilter, setBuFilter] = useState<string>(selectedBu);
  const [portalTools, setPortalTools] = useState<PortalToolLink[]>(DEFAULT_PORTAL_TOOLS);
  const [showPortalMenu, setShowPortalMenu] = useState<boolean>(false);
  const { user, role, logout, isAuthenticated } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);

  useEffect(() => {
    async function loadPortalLinks() {
      try {
        const query = buFilter && buFilter !== 'ALL' ? `?bu=${encodeURIComponent(buFilter)}` : '';
        const res = await fetch(`/api/portal-links${query}`);
        if (res.ok) {
          const data = await res.json();
          if (data.links && data.links.length > 0) {
            setPortalTools(data.links);
          } else {
            setPortalTools(DEFAULT_PORTAL_TOOLS);
          }
        }
      } catch {
        // Fallback to static defaults
        setPortalTools(DEFAULT_PORTAL_TOOLS);
      }
    }
    loadPortalLinks();
  }, [buFilter]);

  const handleBuSelect = (newBu: string) => {
    setBuFilter(newBu);
    if (onBuChange) {
      onBuChange(newBu);
    }
  };

  const handleTabClick = (tab: string) => {
    if (tab === 'chat') {
      if (pathname !== '/chat') {
        router.push('/chat');
      }
    } else {
      if (pathname === '/chat') {
        router.push(`/?tab=${tab}`);
      }
    }
    onTabChange(tab);
  };

  const handleLogoClick = () => {
    if (pathname === '/chat') {
      router.push('/');
    }
    onTabChange('dashboard');
  };

  const handleLaunchTool = (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const renderToolIcon = (iconName?: string | null) => {
    switch (iconName?.toLowerCase()) {
      case 'sparkles':
        return <Sparkles size={12} className="text-amber-400" />;
      case 'award':
        return <Award size={12} className="text-purple-400" />;
      case 'qr':
        return <QrCode size={12} className="text-blue-400" />;
      case 'truck':
        return <Truck size={12} className="text-emerald-400" />;
      case 'settings':
        return <Settings size={12} className="text-slate-400" />;
      default:
        return <ExternalLink size={12} className="text-orange-400" />;
    }
  };

  // Filter tools based on selected BU
  const displayedTools = portalTools.filter((tool) => {
    if (buFilter === 'ALL' || !buFilter) return true;
    if (!tool.businessUnits || tool.businessUnits.length === 0) return true;
    return tool.businessUnits.some((b) => b.toUpperCase() === buFilter.toUpperCase());
  });

  return (
    <header className="bg-[#1f2937] text-white border-b border-slate-700 select-none text-sm z-30 shrink-0">
      {/* Top Main Navigation Bar */}
      <div className="flex items-center justify-between px-4 h-13">
        {/* Left: VCRM Brand & Primary Navigation */}
        <div className="flex items-center space-x-1 sm:space-x-4">
          {/* VCRM Brand Logo */}
          <div 
            onClick={handleLogoClick}
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
            {/* Executive CRM Dashboard Tab */}
            <button
              onClick={() => handleTabClick('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                currentTab === 'dashboard'
                  ? 'bg-slate-800 text-orange-400 border border-orange-500/30 shadow-xs ring-1 ring-orange-500/30'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <LayoutDashboard size={14} className={currentTab === 'dashboard' ? 'text-orange-400' : 'text-slate-400'} />
              <span>{t('dashboard')}</span>
            </button>

            {/* Central Chat & Shop Desk Tab */}
            <button
              onClick={() => handleTabClick('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                currentTab === 'chat'
                  ? 'bg-slate-800 text-orange-400 border border-orange-500/30 shadow-xs ring-1 ring-orange-500/30'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <MessageSquare size={14} className={currentTab === 'chat' ? 'text-orange-400' : 'text-slate-400'} />
              <span>Central Chat &amp; Shop</span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live
              </span>
            </button>

            <button
              onClick={() => handleTabClick('lists')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                currentTab === 'lists'
                  ? 'bg-slate-800 text-orange-400 border border-orange-500/30 shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <ListFilter size={14} className={currentTab === 'lists' ? 'text-orange-400' : 'text-slate-400'} />
              <span>{t('lists_segments')}</span>
              <span className="bg-orange-500/20 text-orange-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">25</span>
            </button>

            <button
              onClick={() => handleTabClick('contacts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                currentTab === 'contacts'
                  ? 'bg-slate-800 text-orange-400 border border-orange-500/30 shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Users size={14} className={currentTab === 'contacts' ? 'text-orange-400' : 'text-slate-400'} />
              <span>{t('contacts')}</span>
            </button>

            <button
              onClick={() => handleTabClick('deals')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                currentTab === 'deals'
                  ? 'bg-slate-800 text-orange-400 border border-orange-500/30 shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Briefcase size={14} className={currentTab === 'deals' ? 'text-orange-400' : 'text-slate-400'} />
              <span>{t('sales_pipeline')}</span>
            </button>

            <button
              onClick={() => handleTabClick('companies')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors hidden lg:flex ${
                currentTab === 'companies'
                  ? 'bg-slate-800 text-orange-400 border border-orange-500/30 shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Building2 size={14} className="text-slate-400" />
              <span>{t('companies')}</span>
            </button>

            <button
              onClick={() => handleTabClick('reports')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors hidden xl:flex ${
                currentTab === 'reports'
                  ? 'bg-slate-800 text-orange-400 border border-orange-500/30 shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <BarChart3 size={14} className="text-slate-400" />
              <span>{t('reports')}</span>
            </button>

            <button
              onClick={() => handleTabClick('supervisor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                currentTab === 'supervisor'
                  ? 'bg-slate-800 text-orange-400 border border-orange-500/30 shadow-xs ring-1 ring-orange-500/30'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <ShieldCheck size={14} className={currentTab === 'supervisor' ? 'text-orange-400' : 'text-slate-400'} />
              <span>Supervisor Hub</span>
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
              placeholder={t('search_vcrm')}
              className="bg-slate-800/90 text-xs text-white placeholder-slate-400 rounded pl-8 pr-3 py-1.5 w-44 lg:w-56 focus:outline-none focus:ring-1 focus:ring-orange-400 border border-slate-700"
            />
          </div>

          {/* Create Button (+ VCRM Orange Accent) */}
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 bg-[#ff7a59] hover:bg-[#ff5c35] text-white px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>{t('create')}</span>
            <ChevronDown size={12} className="opacity-80" />
          </button>

          {/* VCRM Portal ID badge */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded text-[11px] text-slate-300 font-mono border border-slate-700">
            <ShieldCheck size={13} className="text-emerald-400" />
            <span className="text-slate-400">{t('portal_id')}:</span>
            <span className="font-semibold text-orange-300">247092555</span>
          </div>

          {/* Language Selector Dropdown */}
          <div className="relative flex items-center">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400 cursor-pointer appearance-none pr-6 hover:bg-slate-700/80 transition-colors font-medium h-7"
              style={{ 
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill='%2394a3b8'><path d='M7 10l5 5 5-5z'/></svg>")`, 
                backgroundPosition: 'right 4px center', 
                backgroundSize: '14px', 
                backgroundRepeat: 'no-repeat' 
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.code.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Action Icons */}
          <button className="w-8 h-8 rounded hover:bg-slate-800 flex items-center justify-center text-slate-300 relative transition-colors" title="Notifications">
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-slate-800"></span>
          </button>

          <button 
            type="button"
            onClick={onOpenLineSettings} 
            className="w-8 h-8 rounded hover:bg-slate-800 flex items-center justify-center text-slate-300 hover:text-orange-400 transition-colors cursor-pointer" 
            title="LINE Integration & Settings"
          >
            <Settings size={16} />
          </button>

          {/* User Profile & Auth Menu */}
          <div className="relative pl-1">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-800 border border-slate-700/60 transition-colors text-left cursor-pointer"
                  title="Click to view profile & actions"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white text-xs font-bold border border-orange-400/80 shadow-xs">
                    {user.name ? user.name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden md:flex flex-col">
                    <span className="text-xs font-semibold text-slate-200 leading-tight">
                      {user.name || user.username}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      @{user.username}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                      user.role === 'ADMIN'
                        ? user.username === 'sysadmin'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        : user.role === 'SUPERVISOR'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {user.username === 'sysadmin' ? 'SYSADMIN' : user.role === 'AGENT' ? 'SALES' : user.role}
                  </span>
                  <ChevronDown size={12} className="text-slate-400" />
                </button>

                {/* Profile Dropdown Menu */}
                {showProfileMenu && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50 animate-fadeIn">
                    <div className="px-3 py-2 border-b border-slate-800">
                      <div className="text-xs font-semibold text-white">{user.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">{user.email}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">Signed in as:</span>
                        <span className="text-[10px] font-bold text-orange-400 font-mono">@{user.username}</span>
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          router.push('/login');
                        }}
                        className="w-full px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Key size={14} className="text-slate-400" />
                        <span>Switch Account / Preset</span>
                      </button>
                    </div>

                    <div className="pt-1 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          logout();
                        }}
                        className="w-full px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/40 text-xs font-medium transition-colors cursor-pointer"
              >
                <LogIn size={14} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* R4: Enterprise Operations Portal Link Hub Navigation Bar */}
      <div className="bg-slate-900/95 border-t border-slate-800 px-4 py-1.5 flex items-center justify-between overflow-x-auto scrollbar-none text-xs">
        {/* Left: Portal Brand & Quick Launchers */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold uppercase text-[10px] tracking-wider pr-2 border-r border-slate-700">
            <Globe size={13} className="text-orange-400" />
            <span>Portal Hub</span>
          </div>

          {/* Single-Click Tool Launchers */}
          <div className="flex items-center gap-1.5">
            {displayedTools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => handleLaunchTool(tool.url)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 transition-all text-[11px] font-medium active:scale-95 shadow-xs"
                title={`${tool.title} (${tool.url})`}
              >
                {renderToolIcon(tool.icon)}
                <span>{tool.title}</span>
                <ExternalLink size={10} className="text-slate-500 hover:text-orange-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: BU Scope Selector */}
        <div className="flex items-center space-x-2 shrink-0 pl-4">
          <span className="text-[10px] text-slate-400 font-medium uppercase">Scope:</span>
          <select
            value={buFilter}
            onChange={(e) => handleBuSelect(e.target.value)}
            className="bg-slate-800 text-[11px] text-slate-200 border border-slate-700 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-400 cursor-pointer"
          >
            <option value="ALL">All BUs</option>
            <option value="CENTRAL">Central Dept</option>
            <option value="CDS">Central Direct</option>
            <option value="MUJI">Muji</option>
            <option value="SSP">SuperSports</option>
            <option value="B2S">B2S</option>
          </select>
        </div>
      </div>
    </header>
  );
};
