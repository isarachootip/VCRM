'use client';

import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  MessageSquare, 
  MoreHorizontal, 
  Trash2,
  Zap,
  ArrowRight,
  CheckCircle2,
  Building,
  UserCheck
} from 'lucide-react';
import { CRMGroup, CRMItem, CRMBoard } from '@/types/crm';
import { StatusPicker } from './StatusPicker';
import { PriorityPicker } from './PriorityPicker';

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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val);
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
          <div key={group.id} className="rounded-lg bg-white shadow-sm border border-[#e6e9ef] overflow-hidden">
            {/* Group Header Bar */}
            <div 
              className="flex items-center justify-between px-4 py-2.5 border-b border-[#e6e9ef] cursor-pointer hover:bg-gray-50/80 transition-colors"
              onClick={() => onToggleGroupCollapse(group.id)}
            >
              <div className="flex items-center gap-2">
                <button className="text-gray-400 hover:text-gray-600">
                  {group.isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                </button>
                <div 
                  className="w-3 h-3 rounded-full shrink-0" 
                  style={{ backgroundColor: group.color }}
                />
                <h2 
                  className="font-bold text-sm tracking-tight"
                  style={{ color: group.color }}
                >
                  {group.title}
                </h2>
                <span className="text-xs text-gray-400 font-normal">
                  ({group.items.length} {group.items.length === 1 ? 'record' : 'records'})
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <span className="font-semibold text-gray-600">
                  Total Value: <span className="text-emerald-600 font-bold">{formatCurrency(totalValue)}</span>
                </span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                  }} 
                  className="p-1 hover:bg-gray-200 rounded text-gray-400"
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
                    <tr className="bg-[#f5f6f8] text-gray-500 font-medium border-b border-[#e6e9ef]">
                      <th className="w-8 px-3 py-2 text-center">
                        <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-0" />
                      </th>
                      
                      {/* Dynamic Column Headers */}
                      <th className="px-4 py-2 min-w-[240px] font-semibold text-gray-600">
                        {isLeadsBoard ? 'Lead / Opportunity' : isAccountsBoard ? 'Company / Account' : isContactsBoard ? 'Contact Name' : isGrowthBoard ? 'Sales Representative' : 'Deal / Account'}
                      </th>

                      {isContactsBoard && (
                        <th className="px-3 py-2 min-w-[150px] font-semibold text-gray-600">Job Title / Role</th>
                      )}

                      {isAccountsBoard && (
                        <th className="px-3 py-2 min-w-[150px] font-semibold text-gray-600">Industry</th>
                      )}

                      <th className="px-3 py-2 min-w-[140px] font-semibold text-gray-600 text-center">
                        {isAccountsBoard ? 'Account Tier' : isContactsBoard ? 'Role Type' : 'Stage / Status'}
                      </th>

                      <th className="px-3 py-2 min-w-[130px] font-semibold text-gray-600 text-right">
                        {isGrowthBoard ? 'Target Quota (THB)' : 'Value (THB)'}
                      </th>

                      {!isContactsBoard && (
                        <th className="px-3 py-2 min-w-[140px] font-semibold text-gray-600">Primary Contact</th>
                      )}

                      {isContactsBoard && (
                        <th className="px-3 py-2 min-w-[160px] font-semibold text-gray-600">Organization / Company</th>
                      )}

                      <th className="px-3 py-2 min-w-[110px] font-semibold text-gray-600 text-center">Priority</th>
                      <th className="px-3 py-2 min-w-[130px] font-semibold text-gray-600 text-center">Owner</th>
                      <th className="px-3 py-2 min-w-[120px] font-semibold text-gray-600 text-center">Close Date</th>
                      <th className="px-3 py-2 min-w-[110px] font-semibold text-gray-600 text-center">
                        {isGrowthBoard ? 'Achievement %' : 'Probability'}
                      </th>

                      {isLeadsBoard && (
                        <th className="px-3 py-2 min-w-[130px] font-semibold text-purple-600 text-center">Convert</th>
                      )}

                      <th className="w-10 px-2 py-2 text-center"></th>
                    </tr>
                  </thead>

                  {/* Table Rows */}
                  <tbody className="divide-y divide-[#e6e9ef]">
                    {group.items.map((item) => (
                      <tr 
                        key={item.id} 
                        className="hover:bg-[#f7f9fd] group transition-colors cursor-pointer"
                        onClick={() => onSelectItem(item, group.id)}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-0" />
                        </td>

                        {/* Name + Open Drawer Icon */}
                        <td className="px-4 py-2 font-medium text-gray-800 flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onUpdateItem(group.id, item.id, { name: e.target.value })}
                            className="bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-1 w-full text-xs font-semibold text-[#323338] outline-none"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectItem(item, group.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-[#0073ea] hover:bg-blue-50 rounded transition-all shrink-0"
                            title="Open Updates / Notes"
                          >
                            <MessageSquare size={14} />
                          </button>
                        </td>

                        {/* Job Title (if Contacts board) */}
                        {isContactsBoard && (
                          <td className="px-3 py-2 text-gray-700" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={item.jobTitle || 'Decision Maker'}
                              onChange={(e) => onUpdateItem(group.id, item.id, { jobTitle: e.target.value })}
                              className="bg-transparent hover:bg-white px-1 py-0.5 rounded outline-none w-full"
                            />
                          </td>
                        )}

                        {/* Industry (if Accounts board) */}
                        {isAccountsBoard && (
                          <td className="px-3 py-2 text-gray-700" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={item.industry || 'General Industry'}
                              onChange={(e) => onUpdateItem(group.id, item.id, { industry: e.target.value })}
                              className="bg-transparent hover:bg-white px-1 py-0.5 rounded outline-none w-full"
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
                            className="bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-1 text-right text-xs font-bold text-gray-800 outline-none w-28"
                          />
                        </td>

                        {/* Primary Contact Person / Company */}
                        {!isContactsBoard && (
                          <td className="px-3 py-2 text-gray-600" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col">
                              <input
                                type="text"
                                value={item.contactPerson}
                                onChange={(e) => onUpdateItem(group.id, item.id, { contactPerson: e.target.value })}
                                className="bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 text-xs text-gray-800 outline-none"
                              />
                              <span className="text-[10px] text-gray-400 px-1 truncate">{item.contactEmail}</span>
                            </div>
                          </td>
                        )}

                        {isContactsBoard && (
                          <td className="px-3 py-2 text-gray-600 font-semibold" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={item.companyName || 'Client Company'}
                              onChange={(e) => onUpdateItem(group.id, item.id, { companyName: e.target.value })}
                              className="bg-transparent hover:bg-white px-1 py-0.5 rounded outline-none w-full"
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
                            <span className="text-xs text-gray-700 font-medium truncate max-w-[80px]">
                              {item.owner.name.split(' ')[0]}
                            </span>
                          </div>
                        </td>

                        {/* Close Date */}
                        <td className="px-3 py-2 text-center text-gray-600" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="date"
                            value={item.expectedCloseDate}
                            onChange={(e) => onUpdateItem(group.id, item.id, { expectedCloseDate: e.target.value })}
                            className="bg-transparent hover:bg-white text-[11px] rounded px-1 py-0.5 outline-none cursor-pointer"
                          />
                        </td>

                        {/* Probability Progress Bar */}
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 justify-center">
                            <div className="w-14 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  item.probability >= 80 ? 'bg-emerald-500' :
                                  item.probability >= 50 ? 'bg-blue-500' :
                                  item.probability >= 30 ? 'bg-amber-500' : 'bg-red-400'
                                }`}
                                style={{ width: `${item.probability}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-semibold text-gray-500 w-7 text-right">
                              {item.probability}%
                            </span>
                          </div>
                        </td>

                        {/* Convert Lead Action Button (for Leads Board) */}
                        {isLeadsBoard && (
                          <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => onConvertLead && onConvertLead(item, group.id)}
                              className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded text-[11px] border border-purple-200 flex items-center gap-1 mx-auto transition-colors shadow-xs"
                              title="Convert Lead into Active Deal & Company Account"
                            >
                              <Zap size={11} className="text-amber-500 fill-amber-500" />
                              <span>Convert</span>
                            </button>
                          </td>
                        )}

                        {/* Delete Row Button */}
                        <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onDeleteItem(group.id, item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                            title="Delete Item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Quick Add Row Input */}
                    <tr className="bg-white hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-center text-gray-300">
                        <Plus size={14} className="mx-auto" />
                      </td>
                      <td colSpan={isLeadsBoard ? 11 : isContactsBoard || isAccountsBoard ? 11 : 10} className="px-2 py-1.5">
                        <input
                          type="text"
                          placeholder={`+ Add new ${isLeadsBoard ? 'lead' : isAccountsBoard ? 'account' : isContactsBoard ? 'contact' : 'item'}...`}
                          value={newRowInputs[group.id] || ''}
                          onChange={(e) => setNewRowInputs({ ...newRowInputs, [group.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddNewItemSubmit(group.id);
                          }}
                          className="w-full px-2 py-1 text-xs placeholder:text-gray-400 bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 rounded"
                        />
                      </td>
                    </tr>
                  </tbody>

                  {/* Group Summary Footer */}
                  <tfoot>
                    <tr className="bg-[#fcfdfe] text-xs font-semibold text-gray-600 border-t border-[#e6e9ef]">
                      <td className="px-3 py-2 text-center">Σ</td>
                      <td className="px-4 py-2 text-gray-500 font-normal">
                        Count: <strong>{group.items.length} items</strong>
                      </td>
                      <td className="px-3 py-2 text-center text-gray-400">
                        Summary
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-600 font-bold">
                        {formatCurrency(totalValue)}
                      </td>
                      <td colSpan={8} className="px-3 py-2 text-gray-400 text-right">
                        Average: {group.items.length ? formatCurrency(totalValue / group.items.length) : '฿0'}
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
          <form onSubmit={handleAddNewGroupSubmit} className="flex items-center gap-2 max-w-md bg-white p-2 rounded-lg border border-blue-400 shadow-sm">
            <input
              type="text"
              placeholder="e.g. 🎯 Enterprise Accounts Q4"
              value={newGroupTitle}
              onChange={(e) => setNewGroupTitle(e.target.value)}
              autoFocus
              className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button 
              type="submit" 
              className="bg-[#0073ea] text-white text-xs px-3 py-1.5 rounded font-medium hover:bg-[#0060b9]"
            >
              Add Group
            </button>
            <button 
              type="button" 
              onClick={() => setIsAddingGroup(false)}
              className="text-gray-500 text-xs px-2 py-1.5 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsAddingGroup(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-[#0073ea] hover:text-[#0073ea] hover:bg-blue-50/40 text-xs font-semibold transition-all shadow-sm bg-white"
          >
            <Plus size={16} />
            <span>Add New Group</span>
          </button>
        )}
      </div>
    </div>
  );
};
