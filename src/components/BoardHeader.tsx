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
    <div className="bg-white border-b border-[#e6e9ef] px-6 pt-5 pb-0">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#323338] tracking-tight flex items-center gap-2">
            {t(currentBoard.id) || currentBoard.name}
            <Star size={18} className="text-gray-300 hover:text-amber-400 cursor-pointer transition-colors" />
          </h1>
          <span className="text-xs bg-blue-50 text-[#0073ea] font-medium px-2.5 py-0.5 rounded-full border border-blue-200/60">
            {t(currentBoard.badge || 'CRM Module')}
          </span>
        </div>

        {/* Action Buttons Top Right (Export, Import, Automate, Share) */}
        <div className="flex items-center gap-2">
          {/* Excel Export Button */}
          <button
            onClick={onExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors shadow-xs"
            title="Export to Excel (.xlsx)"
          >
            <Download size={14} className="text-emerald-600" />
            <span>{t('export_excel')}</span>
          </button>

          {/* Excel / CSV Import Button */}
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors shadow-xs"
            title="Import Excel or CSV file"
          >
            <Upload size={14} className="text-blue-600" />
            <span>{t('import_excel')}</span>
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded border border-gray-200 transition-colors">
            <Bot size={14} className="text-[#0073ea]" />
            <span>{t('Automate')} / 3</span>
          </button>
          
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded border border-gray-200 transition-colors">
            <Share2 size={14} />
            <span>{t('Share')}</span>
          </button>

          <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded border border-gray-200 transition-colors">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="text-xs text-gray-500 pb-4">
        {t(currentBoard.description || '') || currentBoard.description}
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-1 border-b border-[#e6e9ef] -mb-[1px]">
        {views.map((v) => {
          const Icon = v.icon;
          const isActive = activeView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-[#0073ea] text-[#0073ea] bg-blue-50/30'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              <Icon size={15} />
              <span>{v.label}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar: Search, Filter, New Item Button */}
      <div className="py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* New Item Button */}
          <div className="inline-flex rounded-md shadow-sm">
            <button
              onClick={onAddNewItem}
              className="bg-[#0073ea] hover:bg-[#0060b9] text-white px-3.5 py-1.5 rounded-l-md text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus size={15} />
              <span>{getNewItemLabel()}</span>
            </button>
            <button className="bg-[#0060b9] hover:bg-[#0050a0] text-white px-2 py-1.5 rounded-r-md text-xs border-l border-blue-400">
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={`${t('search_items')}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white w-64 transition-all"
            />
          </div>

          {/* Filter by Person */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 hover:bg-gray-100 cursor-pointer">
            <UserCircle size={14} className="text-gray-500" />
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="bg-transparent text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL">{t('all_owners')}</option>
              <option value="Isara Chootip">Isara Chootip</option>
              <option value="Somchai S.">Somchai S.</option>
              <option value="Kanya P.">Kanya P.</option>
              <option value="Anan T.">Anan T.</option>
            </select>
          </div>

          {/* Filter & Sort Buttons */}
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 hover:bg-gray-100 transition-colors">
            <Filter size={13} />
            <span>{t('Filter')}</span>
          </button>
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 hover:bg-gray-100 transition-colors">
            <ArrowUpDown size={13} />
            <span>{t('Sort')}</span>
          </button>
        </div>

        {/* Metrics Summary Badge */}
        <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full">
          <Sparkles size={13} />
          <span>{t('total_pipeline_value')}: <strong>{formatCurrency(totalValue)}</strong> ({allItems.length} {t('items')})</span>
        </div>
      </div>
    </div>
  );
};
