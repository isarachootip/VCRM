'use client';

import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  MessageSquare, 
  MoreHorizontal, 
  Trash2,
  Zap
} from 'lucide-react';
import { CRMGroup, CRMItem, CRMBoard } from '@/types/crm';
import { StatusPicker } from './StatusPicker';
import { PriorityPicker } from './PriorityPicker';
import { useLanguage } from '@/context/LanguageContext';

interface TableViewProps {
  currentBoard: CRMBoard;
  groups: CRMGroup[];
  onUpdateItem: (groupId: string, itemId: string, updates: Partial<CRMItem>) => void;
  onDeleteItem: (groupId: string, itemId: string) => void;
  onAddItem: (groupId: string, itemName: string) => void;
  onToggleGroupCollapse: (groupId: string) => void;
  onAddGroup: (title: string) => void;
  onSelectItem: (item: CRMItem, groupId: string) => void;
  onConvertLead?: (item: CRMItem, groupId: string) => void;
}

export const TableView: React.FC<TableViewProps> = ({
  currentBoard,
  groups,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onToggleGroupCollapse,
  onAddGroup,
  onSelectItem,
  onConvertLead,
}) => {
  const [newRowInputs, setNewRowInputs] = useState<Record<string, string>>({});
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const { t, language } = useLanguage();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-US', { 
      style: 'currency', 
      currency: language === 'th' ? 'THB' : language === 'zh' ? 'CNY' : 'USD', 
      maximumFractionDigits: 0 
    }).format(val);
  };

  const handleAddNewItemSubmit = (groupId: string) => {
    const text = newRowInputs[groupId]?.trim();
    if (text) {
      onAddItem(groupId, text);
      setNewRowInputs((prev) => ({ ...prev, [groupId]: '' }));
    }
  };

  const handleAddNewGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGroupTitle.trim()) {
      onAddGroup(newGroupTitle.trim());
      setNewGroupTitle('');
      setIsAddingGroup(false);
    }
  };

  const isLeadsBoard = currentBoard.type === 'leads';
  const isAccountsBoard = currentBoard.type === 'accounts';
  const isContactsBoard = currentBoard.type === 'contacts';
  const isGrowthBoard = currentBoard.type === 'growth';

  return (
    <div className="p-6 space-y-8 overflow-x-auto select-none">
      {groups.map((group) => {
        const totalValue = group.items.reduce((sum, i) => sum + (i.dealValue || 0), 0);

        return (
          <div key={group.id} className="rounded-xl bg-card shadow-xs border border-border overflow-hidden transition-colors">
            {/* Group Header Bar */}
            <div 
              className="flex items-center justify-between px-4 py-3 border-b border-border cursor-pointer hover:bg-accent/40 transition-colors"
              onClick={() => onToggleGroupCollapse(group.id)}
            >
              <div className="flex items-center gap-2.5">
                <button className="text-muted-foreground hover:text-foreground">
                  {group.isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                </button>
                <div 
                  className="w-3 h-3 rounded-full shrink-0 shadow-xs" 
                  style={{ backgroundColor: group.color }}
                />
                <h2 
                  className="font-bold text-sm tracking-tight"
                  style={{ color: group.color }}
                >
                  {t(group.title) || group.title}
                </h2>
                <span className="text-xs text-muted-foreground font-normal">
                  ({group.items.length} {t('items')})
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <span className="font-semibold text-muted-foreground">
                  {t('total_pipeline_value')}: <span className="text-emerald-500 font-bold">{formatCurrency(totalValue)}</span>
                </span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                  }} 
                  className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MoreHorizontal size={15} />
                </button>
              </div>
            </div>

            {/* Table Content */}
            {!group.isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  {/* Table Header */}
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                      <th className="w-8 px-3 py-2.5 text-center">
                        <input type="checkbox" className="rounded border-border text-violet-600 focus:ring-0 bg-background" />
                      </th>
                      
                      {/* Dynamic Column Headers */}
                      <th className="px-4 py-2.5 min-w-[240px] font-semibold text-muted-foreground">
                        {t(isLeadsBoard ? 'Lead / Opportunity' : isAccountsBoard ? 'Company / Account' : isContactsBoard ? 'Contact Name' : isGrowthBoard ? 'Sales Representative' : 'Deal / Account')}
                      </th>

                      {isContactsBoard && (
                        <th className="px-3 py-2.5 min-w-[150px] font-semibold text-muted-foreground">{t('Job Title / Role')}</th>
                      )}

                      {isAccountsBoard && (
                        <th className="px-3 py-2.5 min-w-[150px] font-semibold text-muted-foreground">{t('Industry')}</th>
                      )}

                      <th className="px-3 py-2.5 min-w-[140px] font-semibold text-muted-foreground text-center">
                        {t(isAccountsBoard ? 'Account Tier' : isContactsBoard ? 'Role Type' : 'Stage / Status')}
                      </th>

                      <th className="px-3 py-2.5 min-w-[130px] font-semibold text-muted-foreground text-right">
                        {t(isGrowthBoard ? 'Target Quota (THB)' : 'Value')}
                      </th>

                      {!isContactsBoard && (
                        <th className="px-3 py-2.5 min-w-[140px] font-semibold text-muted-foreground">{t('Primary Contact')}</th>
                      )}

                      {isContactsBoard && (
                        <th className="px-3 py-2.5 min-w-[160px] font-semibold text-muted-foreground">{t('Organization / Company')}</th>
                      )}

                      <th className="px-3 py-2.5 min-w-[110px] font-semibold text-muted-foreground text-center">{t('Priority')}</th>
                      <th className="px-3 py-2.5 min-w-[130px] font-semibold text-muted-foreground text-center">{t('Owner')}</th>
                      <th className="px-3 py-2.5 min-w-[120px] font-semibold text-muted-foreground text-center">{t('Close Date')}</th>
                      <th className="px-3 py-2.5 min-w-[110px] font-semibold text-muted-foreground text-center">
                        {t(isGrowthBoard ? 'Achievement %' : 'Probability')}
                      </th>

                      {isLeadsBoard && (
                        <th className="px-3 py-2.5 min-w-[130px] font-semibold text-violet-500 text-center">{t('convert')}</th>
                      )}

                      <th className="w-10 px-2 py-2.5 text-center"></th>
                    </tr>
                  </thead>

                  {/* Table Rows */}
                  <tbody className="divide-y divide-border">
                    {group.items.map((item) => (
                      <tr 
                        key={item.id} 
                        className="hover:bg-accent/30 group transition-colors cursor-pointer"
                        onClick={() => onSelectItem(item, group.id)}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" className="rounded border-border text-violet-600 focus:ring-0 bg-background" />
                        </td>

                        {/* Name + Open Drawer Icon */}
                        <td className="px-4 py-2 font-medium text-foreground flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onUpdateItem(group.id, item.id, { name: e.target.value })}
                            className="bg-transparent hover:bg-background/80 focus:bg-background focus:ring-1 focus:ring-violet-500 rounded px-1.5 py-1 w-full text-xs font-semibold text-foreground outline-none transition-colors"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectItem(item, group.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-violet-500 hover:bg-violet-500/10 rounded transition-all shrink-0"
                            title="Open Updates / Notes"
                          >
                            <MessageSquare size={14} />
                          </button>
                        </td>

                        {/* Job Title (if Contacts board) */}
                        {isContactsBoard && (
                          <td className="px-3 py-2 text-foreground/80" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={item.jobTitle || 'Decision Maker'}
                              onChange={(e) => onUpdateItem(group.id, item.id, { jobTitle: e.target.value })}
                              className="bg-transparent hover:bg-background/80 focus:bg-background px-1.5 py-1 rounded outline-none w-full text-foreground transition-colors"
                            />
                          </td>
                        )}

                        {/* Industry (if Accounts board) */}
                        {isAccountsBoard && (
                          <td className="px-3 py-2 text-foreground/80" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={item.industry || 'General Industry'}
                              onChange={(e) => onUpdateItem(group.id, item.id, { industry: e.target.value })}
                              className="bg-transparent hover:bg-background/80 focus:bg-background px-1.5 py-1 rounded outline-none w-full text-foreground transition-colors"
                            />
                          </td>
                        )}

                        {/* Status / Stage */}
                        <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                          <StatusPicker
                            currentStatus={item.status}
                            onChange={(newStatus) => onUpdateItem(group.id, item.id, { status: newStatus })}
                          />
                        </td>

                        {/* Value */}
                        <td className="px-3 py-2 text-right font-medium" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            value={item.dealValue}
                            onChange={(e) => onUpdateItem(group.id, item.id, { dealValue: Number(e.target.value) || 0 })}
                            className="bg-transparent hover:bg-background/80 focus:bg-background focus:ring-1 focus:ring-violet-500 rounded px-1.5 py-1 text-right text-xs font-bold text-foreground outline-none w-28 transition-colors"
                          />
                        </td>

                        {/* Primary Contact Person / Company */}
                        {!isContactsBoard && (
                          <td className="px-3 py-2 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col">
                              <input
                                type="text"
                                value={item.contactPerson}
                                onChange={(e) => onUpdateItem(group.id, item.id, { contactPerson: e.target.value })}
                                className="bg-transparent hover:bg-background/80 focus:bg-background focus:ring-1 focus:ring-violet-500 rounded px-1.5 py-0.5 text-xs text-foreground outline-none transition-colors"
                              />
                              <span className="text-[10px] text-muted-foreground/70 px-1 truncate">{item.contactEmail}</span>
                            </div>
                          </td>
                        )}

                        {isContactsBoard && (
                          <td className="px-3 py-2 text-foreground font-semibold" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={item.companyName || 'Client Company'}
                              onChange={(e) => onUpdateItem(group.id, item.id, { companyName: e.target.value })}
                              className="bg-transparent hover:bg-background/80 focus:bg-background px-1.5 py-1 rounded outline-none w-full text-foreground transition-colors"
                            />
                          </td>
                        )}

                        {/* Priority */}
                        <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                          <PriorityPicker
                            currentPriority={item.priority}
                            onChange={(newPriority) => onUpdateItem(group.id, item.id, { priority: newPriority })}
                          />
                        </td>

                        {/* Owner */}
                        <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5" title={item.owner.name}>
                            <span className="text-sm">{item.owner.avatar}</span>
                            <span className="text-xs text-foreground/80 font-medium truncate max-w-[80px]">
                              {item.owner.name.split(' ')[0]}
                            </span>
                          </div>
                        </td>

                        {/* Close Date */}
                        <td className="px-3 py-2 text-center text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="date"
                            value={item.expectedCloseDate}
                            onChange={(e) => onUpdateItem(group.id, item.id, { expectedCloseDate: e.target.value })}
                            className="bg-transparent hover:bg-background/80 text-[11px] rounded px-1.5 py-1 outline-none cursor-pointer text-foreground transition-colors"
                          />
                        </td>

                        {/* Probability Progress Bar */}
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 justify-center">
                            <div className="w-14 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  item.probability >= 80 ? 'bg-emerald-500' :
                                  item.probability >= 50 ? 'bg-violet-500' :
                                  item.probability >= 30 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${item.probability}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-semibold text-muted-foreground w-7 text-right">
                              {item.probability}%
                            </span>
                          </div>
                        </td>

                        {/* Convert Lead Action Button (for Leads Board) */}
                        {isLeadsBoard && (
                          <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => onConvertLead && onConvertLead(item, group.id)}
                              className="px-2 py-1 bg-violet-500/10 hover:bg-violet-500/20 text-violet-500 font-bold rounded-lg text-[11px] border border-violet-500/30 flex items-center gap-1 mx-auto transition-colors shadow-xs"
                              title="Convert Lead into Active Deal & Company Account"
                            >
                              <Zap size={11} className="text-amber-500 fill-amber-500" />
                              <span>{t('convert')}</span>
                            </button>
                          </td>
                        )}

                        {/* Delete Row Button */}
                        <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onDeleteItem(group.id, item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded transition-all"
                            title="Delete Item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Quick Add Row Input */}
                    <tr className="bg-card hover:bg-accent/20 transition-colors">
                      <td className="px-3 py-2 text-center text-muted-foreground/40">
                        <Plus size={14} className="mx-auto" />
                      </td>
                      <td colSpan={isLeadsBoard ? 11 : isContactsBoard || isAccountsBoard ? 11 : 10} className="px-2 py-1.5">
                        <input
                          type="text"
                          placeholder={`+ ${t('add_item')}...`}
                          value={newRowInputs[group.id] || ''}
                          onChange={(e) => setNewRowInputs({ ...newRowInputs, [group.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddNewItemSubmit(group.id);
                          }}
                          className="w-full px-2 py-1.5 text-xs placeholder:text-muted-foreground/60 bg-transparent focus:outline-none focus:bg-background focus:ring-1 focus:ring-violet-500 rounded text-foreground transition-all"
                        />
                      </td>
                    </tr>
                  </tbody>

                  {/* Group Summary Footer */}
                  <tfoot>
                    <tr className="bg-muted/30 text-xs font-semibold text-muted-foreground border-t border-border">
                      <td className="px-3 py-2.5 text-center">Σ</td>
                      <td className="px-4 py-2.5 text-muted-foreground font-normal">
                        {t('records')}: <strong className="text-foreground">{group.items.length} {t('items')}</strong>
                      </td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground/70">
                        {t('Summary')}
                      </td>
                      <td className="px-3 py-2.5 text-right text-emerald-500 font-bold">
                        {formatCurrency(totalValue)}
                      </td>
                      <td colSpan={8} className="px-3 py-2.5 text-muted-foreground/70 text-right">
                        {t('Average')}: {group.items.length ? formatCurrency(totalValue / group.items.length) : formatCurrency(0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Add New Group Button */}
      <div className="pt-2">
        {isAddingGroup ? (
          <form onSubmit={handleAddNewGroupSubmit} className="flex items-center gap-2 max-w-md bg-card p-2 rounded-xl border border-violet-500/40 shadow-sm">
            <input
              type="text"
              placeholder="e.g. 🎯 Enterprise Accounts Q4"
              value={newGroupTitle}
              onChange={(e) => setNewGroupTitle(e.target.value)}
              autoFocus
              className="flex-1 px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <button 
              type="submit" 
              className="bg-violet-600 hover:bg-violet-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              {t('add_group')}
            </button>
            <button 
              type="button" 
              onClick={() => setIsAddingGroup(false)}
              className="text-muted-foreground text-xs px-2 py-1.5 hover:bg-accent rounded-lg transition-colors"
            >
              {t('Cancel')}
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsAddingGroup(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border text-muted-foreground hover:border-violet-500 hover:text-violet-500 hover:bg-violet-500/5 text-xs font-semibold transition-all shadow-xs bg-card"
          >
            <Plus size={16} />
            <span>{t('Add New Group')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
