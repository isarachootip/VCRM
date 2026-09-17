'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Search, 
  ChevronRight, 
  ChevronDown, 
  Users, 
  Briefcase, 
  TrendingUp, 
  Settings, 
  Contact,
  Building2,
  Truck,
  Wrench,
  Hammer,
  ShieldAlert,
  LucideIcon,
  LayoutDashboard,
  MessageSquare,
  ListFilter,
  Globe,
  ExternalLink,
  Sparkles, 
  Award, 
  QrCode, 
  Layers,
  X,
  BookOpen,
  GraduationCap,
  UserCog
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export interface PortalToolLink {
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
    url: 'https://aipx.vcrm.internal',
    icon: 'sparkles',
    category: 'CATALOG',
    businessUnits: ['MUJI', 'SSP', 'B2S'],
  },
  {
    id: 'tool_the1',
    title: 'The 1 Portal',
    url: 'https://the1.vcrm.internal/portal',
    icon: 'award',
    category: 'LOYALTY',
    businessUnits: [],
  },
  {
    id: 'tool_ops',
    title: 'Operation Portal',
    url: 'https://ops.vcrm.internal',
    icon: 'settings',
    category: 'OPERATIONS',
    businessUnits: ['MUJI', 'SSP', 'B2S'],
  },
  {
    id: 'tool_qr',
    title: 'QR Portal',
    url: 'https://qr.vcrm.internal',
    icon: 'qr',
    category: 'PAYMENTS',
    businessUnits: [],
  },
  {
    id: 'tool_delivery',
    title: 'Delivery Portal',
    url: 'https://logistics.vcrm.internal',
    icon: 'truck',
    category: 'LOGISTICS',
    businessUnits: ['MUJI', 'SSP', 'B2S'],
  },
];

export interface SidebarProps {
  currentTab?: string;
  onTabChange?: (tab: string) => void;
  currentBoardId: string;
  onSelectBoard: (boardId: string) => void;
  boardsCountMap?: Record<string, number>;
  onOpenLineSettings?: () => void;
  onOpenSOPManual?: () => void;
  selectedBu?: string;
  onBuChange?: (bu: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentTab = 'dashboard',
  onTabChange,
  currentBoardId, 
  onSelectBoard,
  boardsCountMap = {},
  onOpenLineSettings,
  onOpenSOPManual,
  selectedBu = 'ALL',
  onBuChange,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();

  // Collapsible section states
  const [isSalesOpen, setIsSalesOpen] = useState(true);
  const [isServicesOpen, setIsServicesOpen] = useState(true);
  const [isPortalOpen, setIsPortalOpen] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState('');

  // Portal Tools state
  const [portalTools, setPortalTools] = useState<PortalToolLink[]>(DEFAULT_PORTAL_TOOLS);

  // Fetch dynamic portal tools if available
  useEffect(() => {
    async function loadPortalLinks() {
      try {
        const res = await fetch('/api/portal-links');
        if (res.ok) {
          const data = await res.json();
          const links = Array.isArray(data) 
            ? data 
            : (data?.links && Array.isArray(data.links) ? data.links : []);
          if (links.length > 0) {
            setPortalTools(links);
          }
        }
      } catch (err) {
        console.log('Using default portal tools fallback', err);
      }
    }
    loadPortalLinks();
  }, []);

  // Keyboard Escape listener to dismiss mobile drawer
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const handleNavClick = (tab: string) => {
    onCloseMobile?.();
    if (pathname === '/chat') {
      if (tab === 'chat') return;
      const buQuery = selectedBu && selectedBu !== 'ALL' ? `&bu=${selectedBu}` : '';
      router.push(`/?tab=${tab}${buQuery}`);
      return;
    }
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const handleBoardClick = (boardId: string) => {
    onCloseMobile?.();
    onSelectBoard(boardId);
    if (pathname === '/chat') {
      const buQuery = selectedBu && selectedBu !== 'ALL' ? `&bu=${selectedBu}` : '';
      router.push(`/?tab=deals&board=${boardId}${buQuery}`);
    }
  };

  const handleLaunchTool = (url: string) => {
    onCloseMobile?.();
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const renderToolIcon = (iconName?: string | null) => {
    switch (iconName?.toLowerCase()) {
      case 'sparkles':
        return <Sparkles size={14} className="text-amber-500 shrink-0" />;
      case 'award':
        return <Award size={14} className="text-violet-500 shrink-0" />;
      case 'qr':
        return <QrCode size={14} className="text-blue-500 shrink-0" />;
      case 'truck':
        return <Truck size={14} className="text-emerald-500 shrink-0" />;
      case 'settings':
        return <Settings size={14} className="text-muted-foreground shrink-0" />;
      default:
        return <ExternalLink size={14} className="text-violet-500 shrink-0" />;
    }
  };

  // Filter tools based on selected BU
  const displayedTools = portalTools.filter((tool) => {
    if (selectedBu === 'ALL' || !selectedBu) return true;
    if (!tool.businessUnits || tool.businessUnits.length === 0) return true;
    return tool.businessUnits.some((b) => b.toUpperCase() === selectedBu.toUpperCase());
  });

  // Core Apps
  const coreApps = [
    { 
      id: 'dashboard', 
      name: 'Dashboard (Executive Overview)', 
      shortName: 'Dashboard',
      icon: LayoutDashboard, 
      badge: 'Overview' 
    },
    { 
      id: 'chat', 
      name: 'Omni Chat Desk', 
      icon: MessageSquare, 
      isLive: true 
    },
    { 
      id: 'contacts', 
      name: 'Contacts & 360°', 
      icon: Users,
      badge: '360°'
    },
    { 
      id: 'lists', 
      name: 'Lists & Segments', 
      icon: ListFilter, 
      count: '25' 
    },
    { 
      id: 'supervisor', 
      name: 'Supervisor Workforce Hub', 
      icon: ShieldAlert, 
      badge: 'Hub' 
    },
    { 
      id: 'users', 
      name: 'User Management', 
      shortName: 'Users',
      icon: UserCog, 
      badge: 'Admin' 
    },
  ];

  // CRM & Sales Pipelines
  const salesBoards: { id: string; name: string; icon: LucideIcon; color: string; badge?: string }[] = [
    { id: 'board-5030723273', name: 'Deals & Pipeline', icon: Briefcase, color: 'text-violet-500', badge: 'Active' },
    { id: 'board-leads', name: 'Inbound Leads 2026', icon: Users, color: 'text-amber-500', badge: 'Funnel' },
    { id: 'board-accounts', name: 'Enterprise Accounts', icon: Building2, color: 'text-purple-500', badge: '360°' },
    { id: 'board-contacts', name: 'Contacts & Stakeholders', icon: Contact, color: 'text-emerald-500' },
    { id: 'board-growth', name: 'Sales Forecast', icon: TrendingUp, color: 'text-rose-500' },
  ];

  // Field Services & Logistics
  const serviceBoards: { id: string; name: string; icon: LucideIcon; color: string; badge?: string }[] = [
    { id: 'board-delivery', name: 'Delivery Fleet', icon: Truck, color: 'text-amber-500', badge: 'Fleet' },
    { id: 'board-install', name: 'Installation Tech', icon: Wrench, color: 'text-blue-500', badge: 'Tech' },
    { id: 'board-renovate', name: 'Renovation Projects', icon: Hammer, color: 'text-purple-500', badge: 'PM' },
    { id: 'board-maintain', name: 'Maintenance SLA', icon: ShieldAlert, color: 'text-rose-500', badge: 'SLA' },
  ];

  // Filter lists based on sidebarSearch
  const searchLower = sidebarSearch.trim().toLowerCase();
  const filteredCoreApps = coreApps.filter((app) =>
    !searchLower || app.name.toLowerCase().includes(searchLower)
  );
  const filteredSalesBoards = salesBoards.filter((b) =>
    !searchLower || b.name.toLowerCase().includes(searchLower)
  );
  const filteredServiceBoards = serviceBoards.filter((b) =>
    !searchLower || b.name.toLowerCase().includes(searchLower)
  );
  const filteredTools = displayedTools.filter((tool) =>
    !searchLower || tool.title.toLowerCase().includes(searchLower)
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Cruip Artifact Left Sidebar */}
      <aside 
        className={`
          ${isMobileOpen ? 'fixed inset-y-0 left-0 z-50 flex shadow-2xl' : 'hidden md:flex'}
          w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col justify-between select-none shrink-0 h-full transition-colors
        `}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Cruip Artifact Workspace Header with BU Switching */}
          <div className="p-3 border-b border-sidebar-border/60">
            <div className="flex items-center justify-between p-2 rounded-xl bg-sidebar-accent/50 hover:bg-sidebar-accent border border-sidebar-border/60 transition-colors">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs shadow-violet-500/20">
                  V
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-xs tracking-tight truncate text-sidebar-foreground">
                    VCRMX
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    Enterprise Sales OS
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] bg-violet-500/10 text-violet-600 font-bold px-1.5 py-0.5 rounded border border-violet-500/20">
                  {selectedBu === 'ALL' ? 'GLOBAL' : selectedBu}
                </span>
                {onCloseMobile && (
                  <button
                    type="button"
                    onClick={onCloseMobile}
                    className="md:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent cursor-pointer"
                    aria-label="Close sidebar"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

          {/* Business Unit (BU) Switching Selector directly in Workspace Header */}
          <div className="mt-2 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-sidebar-accent/30 border border-sidebar-border/50 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
              <Building2 size={13} className="text-violet-500" />
              <span className="text-[11px] font-medium">BU Scope:</span>
            </div>
            <select
              aria-label="Business Unit Scope"
              value={selectedBu}
              onChange={(e) => onBuChange?.(e.target.value)}
              className="bg-sidebar text-sidebar-foreground text-[11px] font-semibold border border-sidebar-border/70 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer hover:bg-sidebar-accent/50 transition-colors"
            >
              <option value="ALL">All BUs</option>
              <option value="MUJI">Muji</option>
              <option value="SSP">SuperSports</option>
              <option value="B2S">B2S</option>
            </select>
          </div>

          {/* Quick Search inside Sidebar */}
          <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-sidebar-accent/40 rounded-lg text-xs text-muted-foreground border border-sidebar-border/40 focus-within:ring-1 focus-within:ring-violet-500/50 transition-colors">
            <Search size={13} className="shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder={t('search_crm') || "Search workspace..."}
              className="bg-transparent text-sidebar-foreground text-xs placeholder:text-muted-foreground focus:outline-none w-full min-w-0"
            />
            {sidebarSearch && (
              <button
                type="button"
                onClick={() => setSidebarSearch('')}
                className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

          {/* Scrollable Navigation Groups */}
          <nav aria-label="Sidebar Navigation" className="flex-1 overflow-y-auto p-2.5 space-y-4">
            {/* Group 0: Core Apps (Dashboard, Chat Desk, Contacts 360, Lists, Supervisor Hub) */}
            {filteredCoreApps.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('main_menu') || 'Core Apps'}
                </div>
                <div className="mt-1 space-y-0.5 pl-1">
                  {filteredCoreApps.map((app) => {
                    const Icon = app.icon;
                    const isSelected = currentTab === app.id;

                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => handleNavClick(app.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold border border-violet-500/25 shadow-2xs' 
                            : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Icon size={15} className={isSelected ? 'text-violet-600 dark:text-violet-400 shrink-0' : 'text-muted-foreground shrink-0'} />
                          <span className="truncate">{app.name}</span>
                        </div>

                        {app.isLive && (
                          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Live
                          </span>
                        )}

                        {app.count && (
                          <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.2 rounded-md font-semibold border border-border shrink-0">
                            {app.count}
                          </span>
                        )}

                        {app.badge && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold shrink-0 ${
                            isSelected 
                              ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30' 
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}>
                            {app.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Group 1: CRM & Sales Pipelines */}
            {filteredSalesBoards.length > 0 && (
              <div>
                <div 
                  className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-sidebar-foreground transition-colors"
                  onClick={() => setIsSalesOpen(!isSalesOpen)}
                >
                  <div className="flex items-center gap-1.5">
                    {isSalesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <span>CRM &amp; Sales Pipelines</span>
                  </div>
                  <span className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 px-1.5 py-0.2 rounded-md font-bold">
                    {filteredSalesBoards.length}
                  </span>
                </div>

                {isSalesOpen && (
                  <div className="mt-1 space-y-0.5 pl-1">
                    {filteredSalesBoards.map((b) => {
                      const Icon = b.icon;
                      const isActive = (currentTab === 'deals' || currentTab === 'companies' || currentTab === 'reports') && currentBoardId === b.id;
                      const count = boardsCountMap[b.id] ?? 0;

                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleBoardClick(b.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold border border-violet-500/25 shadow-2xs' 
                              : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Icon size={14} className={isActive ? 'text-violet-600 dark:text-violet-400 shrink-0' : `${b.color} shrink-0`} />
                            <span className="truncate">{b.name}</span>
                          </div>
                          {count > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold shrink-0 ${
                              isActive 
                                ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Group 2: Field Services & Logistics */}
            {filteredServiceBoards.length > 0 && (
              <div>
                <div 
                  className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-sidebar-foreground transition-colors"
                  onClick={() => setIsServicesOpen(!isServicesOpen)}
                >
                  <div className="flex items-center gap-1.5">
                    {isServicesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <span>Field Services &amp; Logistics</span>
                  </div>
                  <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded-md font-bold">
                    {filteredServiceBoards.length}
                  </span>
                </div>

                {isServicesOpen && (
                  <div className="mt-1 space-y-0.5 pl-1">
                    {filteredServiceBoards.map((b) => {
                      const Icon = b.icon;
                      const isActive = (currentTab === 'deals' || currentTab === 'companies' || currentTab === 'reports') && currentBoardId === b.id;
                      const count = boardsCountMap[b.id] ?? 0;

                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleBoardClick(b.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold border border-violet-500/25 shadow-2xs' 
                              : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Icon size={14} className={isActive ? 'text-violet-600 dark:text-violet-400 shrink-0' : `${b.color} shrink-0`} />
                            <span className="truncate">{b.name}</span>
                          </div>
                          {count > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold shrink-0 ${
                              isActive 
                                ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Group 3: Portal Hub & Tools Group */}
            {filteredTools.length > 0 && (
              <div>
                <div 
                  className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-sidebar-foreground transition-colors"
                  onClick={() => setIsPortalOpen(!isPortalOpen)}
                >
                  <div className="flex items-center gap-1.5">
                    {isPortalOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <Globe size={13} className="text-violet-500" />
                    <span>Portal Hub &amp; Tools</span>
                  </div>
                  <span className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 px-1.5 py-0.2 rounded-md font-bold">
                    {filteredTools.length}
                  </span>
                </div>

                {isPortalOpen && (
                  <div className="mt-1 space-y-0.5 pl-1">
                    {filteredTools.map((tool) => (
                      <a
                        key={tool.id}
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onCloseMobile?.()}
                        aria-label={`${tool.title} (opens external portal in new tab)`}
                        title={`${tool.title} - External Portal Tool (${tool.url})`}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground border border-transparent transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {renderToolIcon(tool.icon)}
                          <span className="truncate">{tool.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {tool.category && (
                            <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-muted/60 text-muted-foreground group-hover:text-sidebar-foreground border border-border/50">
                              {tool.category}
                            </span>
                          )}
                          <ExternalLink size={12} className="text-muted-foreground group-hover:text-violet-500 shrink-0 transition-colors" />
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty search state */}
            {sidebarSearch.trim() && 
             filteredCoreApps.length === 0 && 
             filteredSalesBoards.length === 0 && 
             filteredServiceBoards.length === 0 && 
             filteredTools.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No matching navigation items found
              </div>
            )}
          </nav>
      </div>

      {/* VCRMX Sidebar Footer */}
      <div className="p-3 border-t border-sidebar-border/60 space-y-2">
        {onOpenSOPManual && (
          <button
            type="button"
            onClick={onOpenSOPManual}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/15 text-violet-700 border border-violet-500/25 transition-colors text-xs font-semibold cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <GraduationCap size={14} className="text-violet-600" />
              <span>คู่มือระบบ (SOP Guide)</span>
            </div>
            <span className="text-[10px] bg-white text-violet-600 font-bold px-1.5 py-0.5 rounded border border-violet-500/20">
              SOP
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenLineSettings}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 border border-emerald-500/20 transition-colors text-xs font-medium cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>LINE OA Webhook</span>
          </div>
          <span className="text-[10px] bg-background text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 shadow-2xs">
            Live
          </span>
        </button>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
          <div 
            onClick={onOpenLineSettings}
            className="flex items-center gap-2 hover:text-foreground cursor-pointer transition-colors"
          >
            <Settings size={13} />
            <span>{t('workspace_settings') || 'Workspace Settings'}</span>
          </div>
          <span className="text-[10px] bg-violet-500/10 text-violet-600 px-1.5 py-0.5 rounded font-bold border border-violet-500/20">
            VCRMX Pro
          </span>
        </div>
      </div>
    </aside>
    </>
  );
};
