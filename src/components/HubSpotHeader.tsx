'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Search, 
  Plus, 
  Bell, 
  Settings, 
  ChevronDown,
  LogOut,
  LogIn,
  Key,
  Menu,
  BookOpen
} from 'lucide-react';
import { useLanguage, Language, SUPPORTED_LANGUAGES } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

export interface HubSpotHeaderProps {
  currentTab?: string;
  onTabChange?: (tab: string) => void;
  onOpenCreateModal?: () => void;
  onOpenLineSettings?: () => void;
  onOpenSOPManual?: () => void;
  selectedBu?: string;
  onBuChange?: (bu: string) => void;
  onToggleMobileSidebar?: () => void;
}

export const HubSpotHeader: React.FC<HubSpotHeaderProps> = ({
  currentTab = 'dashboard',
  onTabChange,
  onOpenCreateModal,
  onOpenLineSettings,
  onOpenSOPManual,
  selectedBu = 'ALL',
  onBuChange,
  onToggleMobileSidebar,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogoClick = () => {
    if (pathname === '/chat') {
      const buQuery = selectedBu && selectedBu !== 'ALL' ? `/?bu=${selectedBu}` : '/';
      router.push(buQuery);
      return;
    }
    if (onTabChange) {
      onTabChange('dashboard');
    }
  };

  return (
    <header className="bg-card/95 backdrop-blur-md text-card-foreground border-b border-border select-none text-sm z-30 shrink-0 sticky top-0 transition-colors">
      {/* Sleek Minimal Single-Line Utility Header Bar */}
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left: VCRMX Brand Logo & Title */}
        <div className="flex items-center space-x-1 sm:space-x-3">
          {onToggleMobileSidebar && (
            <button
              type="button"
              onClick={onToggleMobileSidebar}
              className="md:hidden p-1.5 -ml-1 mr-1 rounded-lg border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Toggle Menu"
              aria-label="Toggle navigation menu"
            >
              <Menu size={18} />
            </button>
          )}
          <div 
            onClick={handleLogoClick}
            className="flex items-center gap-2.5 cursor-pointer pr-2 group transition-opacity"
            title="VCRMX Home"
          >
            {/* VCRMX Signature Geometric Logo Badge */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-purple-400 flex items-center justify-center text-white shadow-md shadow-violet-500/20 font-black text-base ring-1 ring-white/20 group-hover:scale-105 transition-transform">
              <span className="tracking-tighter font-extrabold text-white text-base">V</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-foreground text-sm tracking-tight leading-none flex items-center gap-1.5">
                VCRMX
                <span className="text-[10px] bg-violet-500/10 text-violet-600 font-semibold px-1.5 py-0.5 rounded-md border border-violet-500/20">
                  Enterprise
                </span>
              </span>
              <span className="text-[9px] text-muted-foreground font-medium tracking-wider uppercase mt-0.5">
                Sales &amp; Workforce OS
              </span>
            </div>
          </div>
        </div>

        {/* Right: Essential Top Utilities (Search ⌘K, + Create, Language Switcher, Notifications, Settings, Profile) */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* VCRMX Global Command Search (⌘K) */}
          <div className="relative hidden md:flex items-center">
            <Search className="absolute left-2.5 text-muted-foreground pointer-events-none" size={13} />
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Global Command Search (Press Command K)"
              placeholder={t('search_vcrm') || "Search dashboard..."}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  searchInputRef.current?.blur();
                }
              }}
              className="bg-muted/40 hover:bg-muted/60 text-xs text-foreground placeholder:text-muted-foreground rounded-lg pl-8 pr-12 py-1.5 w-44 lg:w-56 focus:outline-none focus:ring-1 focus:ring-primary border border-input transition-colors"
            />
            <kbd className="absolute right-2 pointer-events-none hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex items-center gap-0.5">
              ⌘K
            </kbd>
          </div>

          {/* Primary Action Button (Cruip Signature Violet) */}
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-all active:scale-95 shadow-violet-500/25 cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>{t('create')}</span>
            <ChevronDown size={12} className="opacity-80" />
          </button>

          {/* SOP System Manual Guide Button */}
          {onOpenSOPManual && (
            <button
              type="button"
              onClick={onOpenSOPManual}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 font-semibold border border-violet-500/30 text-xs transition-colors cursor-pointer shadow-2xs"
              title="เปิดคู่มือระบบ (SOP Guide) ประจำหน้านี้"
            >
              <BookOpen size={13} className="text-violet-600" />
              <span className="hidden sm:inline">คู่มือระบบ SOP</span>
            </button>
          )}

          {/* Language Switcher Dropdown */}
          <div className="relative flex items-center">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-muted/40 text-xs text-foreground border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer appearance-none pr-6 hover:bg-accent transition-colors font-medium h-8"
              style={{ 
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill='%2394a3b8'><path d='M7 10l5 5 5-5z'/></svg>")`, 
                backgroundPosition: 'right 4px center', 
                backgroundSize: '14px', 
                backgroundRepeat: 'no-repeat' 
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-card text-foreground">
                  {lang.code.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Notification Bell */}
          <button 
            type="button"
            className="w-8 h-8 rounded-lg border border-border hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground relative transition-colors cursor-pointer" 
            title="Notifications"
          >
            <Bell size={15} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-background"></span>
          </button>

          {/* Settings */}
          <button 
            type="button"
            onClick={onOpenLineSettings} 
            className="w-8 h-8 rounded-lg border border-border hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer" 
            title="Integrations & Settings"
          >
            <Settings size={15} />
          </button>

          {/* User Profile & Auth Menu */}
          <div className="relative pl-1">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-accent border border-border transition-colors text-left cursor-pointer"
                  title="Click to view profile & actions"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                    {user.name ? user.name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden md:flex flex-col">
                    <span className="text-xs font-semibold text-foreground leading-tight">
                      {user.name || user.username}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      @{user.username}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${
                      user.role === 'ADMIN'
                        ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30'
                        : user.role === 'SUPERVISOR'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {user.username === 'sysadmin' ? 'SYSADMIN' : user.role === 'AGENT' ? 'SALES' : user.role}
                  </span>
                  <ChevronDown size={12} className="text-muted-foreground" />
                </button>

                {/* Profile Dropdown Menu */}
                {showProfileMenu && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl py-2 z-50 animate-fadeIn">
                    <div className="px-3 py-2 border-b border-border">
                      <div className="text-xs font-semibold text-foreground">{user.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">{user.email}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Signed in as:</span>
                        <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 font-mono">@{user.username}</span>
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          router.push('/login');
                        }}
                        className="w-full px-3 py-1.5 text-xs text-foreground hover:bg-accent flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Key size={14} className="text-muted-foreground" />
                        <span>Switch Account / Preset</span>
                      </button>
                    </div>

                    <div className="pt-1 border-t border-border">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          logout();
                        }}
                        className="w-full px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 flex items-center gap-2 cursor-pointer transition-colors"
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30 text-xs font-medium transition-colors cursor-pointer"
              >
                <LogIn size={14} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
