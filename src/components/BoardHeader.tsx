'use client';

import React from 'react';
import { 
  Table, 
  Kanban, 
  BarChart3, 
  History, 
  CalendarDays,
  Search, 
  UserCircle, 
  Filter, 
  ArrowUpDown, 
  Plus, 
  Sparkles, 
  Share2, 
  MoreHorizontal, 
  Star, 
  Bot, 
  ChevronDown,
  Download,
  Upload,
  LucideIcon
} from 'lucide-react';
import { ActiveView, CRMBoard } from '@/types/crm';
import { useLanguage } from '@/context/LanguageContext';

interface BoardHeaderProps {
  currentBoard: CRMBoard;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedOwner: string;
  setSelectedOwner: (owner: string) => void;
  onAddNewItem: () => void;
  onExportExcel: () => void;
  onOpenImport: () => void;
}

export const BoardHeader: React.FC<BoardHeaderProps> = ({
  currentBoard,
  activeView,
  setActiveView,
  searchTerm,
  setSearchTerm,
  selectedOwner,
  setSelectedOwner,
  onAddNewItem,
  onExportExcel,
  onOpenImport,
}) => {
  const { t, language } = useLanguage();

  const views: { id: ActiveView; label: string; icon: LucideIcon }[] = [
    { id: 'table', label: t('view_table'), icon: Table },
    { id: 'kanban', label: t('view_kanban'), icon: Kanban },
    { id: 'dispatch', label: t('view_dispatch'), icon: CalendarDays },
    { id: 'dashboard', label: t('view_dashboard'), icon: BarChart3 },
    { id: 'activity', label: t('view_activity'), icon: History },
  ];

  // Total board metrics
  const allItems = currentBoard.groups.flatMap((g) => g.items);
  const totalValue = allItems.reduce((sum, i) => sum + (i.dealValue || 0), 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-US', { 
      style: 'currency', 
      currency: language === 'th' ? 'THB' : language === 'zh' ? 'CNY' : 'USD', 
      maximumFractionDigits: 0 
    }).format(val);
  };

  const getNewItemLabel = () => {
    if (currentBoard.type === 'leads') {
      return t('action_new_lead');
    } else if (currentBoard.type === 'accounts') {
      return t('action_new_account');
    } else if (currentBoard.type === 'contacts') {
      return t('action_new_contact');
    } else {
      return t('action_new_deal');
    }
  };

  return (
    <div className="bg-card border-b border-border px-6 pt-5 pb-0 text-card-foreground transition-colors">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            {t(currentBoard.id) || currentBoard.name}
            <Star size={16} className="text-muted-foreground hover:text-amber-400 cursor-pointer transition-colors" />
          </h1>
          <span className="text-xs bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold px-2.5 py-0.5 rounded-md border border-violet-500/20">
            {t(currentBoard.badge || 'CRM Module')}
          </span>
        </div>

        {/* Action Buttons Top Right (Export, Import, Automate, Share) */}
        <div className="flex items-center gap-2">
          {/* Excel Export Button */}
          <button
            onClick={onExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/20 transition-colors shadow-xs"
            title="Export to Excel (.xlsx)"
          >
            <Download size={13} className="text-emerald-500" />
            <span>{t('export_excel')}</span>
          </button>

          {/* Excel / CSV Import Button */}
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg border border-violet-500/20 transition-colors shadow-xs"
            title="Import Excel or CSV file"
          >
            <Upload size={13} className="text-violet-500" />
            <span>{t('import_excel')}</span>
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-accent rounded-lg border border-border transition-colors">
            <Bot size={13} className="text-violet-500" />
            <span>{t('Automate')} / 3</span>
          </button>
          
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-accent rounded-lg border border-border transition-colors">
            <Share2 size={13} />
            <span>{t('Share')}</span>
          </button>

          <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg border border-border transition-colors">
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="text-xs text-muted-foreground pb-4">
        {t(currentBoard.description || '') || currentBoard.description}
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-1 border-b border-border -mb-[1px]">
        {views.map((v) => {
          const Icon = v.icon;
          const isActive = activeView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-violet-600 text-violet-600 dark:text-violet-400 font-semibold bg-violet-500/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-violet-500' : 'text-muted-foreground'} />
              <span>{v.label}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar: Search, Filter, New Item Button */}
      <div className="py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* New Item Button */}
          <div className="inline-flex rounded-lg shadow-sm">
            <button
              onClick={onAddNewItem}
              className="bg-violet-600 hover:bg-violet-700 text-white px-3.5 py-1.5 rounded-l-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-violet-500/20"
            >
              <Plus size={14} />
              <span>{getNewItemLabel()}</span>
            </button>
            <button className="bg-violet-700 hover:bg-violet-800 text-white px-2 py-1.5 rounded-r-lg text-xs border-l border-violet-500">
              <ChevronDown size={13} />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder={`${t('search_items')}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-muted/40 text-foreground placeholder:text-muted-foreground border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary w-64 transition-all"
            />
          </div>

          {/* Filter by Person */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/40 border border-border rounded-lg text-xs text-foreground hover:bg-accent cursor-pointer">
            <UserCircle size={14} className="text-muted-foreground" />
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-card text-foreground">{t('all_owners')}</option>
              <option value="Isara Chootip" className="bg-card text-foreground">Isara Chootip</option>
              <option value="Somchai S." className="bg-card text-foreground">Somchai S.</option>
              <option value="Kanya P." className="bg-card text-foreground">Kanya P.</option>
              <option value="Anan T." className="bg-card text-foreground">Anan T.</option>
            </select>
          </div>

          {/* Filter & Sort Buttons */}
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/40 border border-border rounded-lg text-xs text-foreground hover:bg-accent transition-colors">
            <Filter size={13} className="text-muted-foreground" />
            <span>{t('Filter')}</span>
          </button>
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/40 border border-border rounded-lg text-xs text-foreground hover:bg-accent transition-colors">
            <ArrowUpDown size={13} className="text-muted-foreground" />
            <span>{t('Sort')}</span>
          </button>
        </div>

        {/* Metrics Summary Badge */}
        <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400 bg-violet-500/10 border border-violet-500/20 px-3 py-1 rounded-full">
          <Sparkles size={13} />
          <span>{t('total_pipeline_value')}: <strong>{formatCurrency(totalValue)}</strong> ({allItems.length} {t('items')})</span>
        </div>
      </div>
    </div>
  );
};
