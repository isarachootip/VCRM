'use client';

import React from 'react';
import { CRMItem, CRMGroup, StatusType } from '@/types/crm';
import { STATUS_CONFIGS, PRIORITY_CONFIGS } from '@/data/mockData';
import { DollarSign, Calendar, User, ArrowRight, CheckCircle2 } from 'lucide-react';

interface KanbanViewProps {
  groups: CRMGroup[];
  onUpdateItemStatus: (itemId: string, newStatus: StatusType) => void;
  onSelectItem: (item: CRMItem, groupId: string) => void;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  groups,
  onUpdateItemStatus,
  onSelectItem,
}) => {
  // Collect all items across groups
  const allItemsWithGroup: { item: CRMItem; groupId: string }[] = [];
  groups.forEach((g) => {
    g.items.forEach((item) => {
      allItemsWithGroup.push({ item, groupId: g.id });
    });
  });

  const stages: StatusType[] = [
    'New Lead',
    'Qualified',
    'Working on it',
    'Proposal Sent',
    'Negotiation',
    'Closed Won',
    'Closed Lost',
  ];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="p-6 overflow-x-auto select-none min-h-[calc(100vh-210px)]">
      <div className="flex gap-4 items-start min-w-max pb-8">
        {stages.map((stage) => {
          const config = STATUS_CONFIGS[stage];
          const stageItems = allItemsWithGroup.filter((x) => x.item.status === stage);
          const stageValue = stageItems.reduce((sum, x) => sum + (x.item.dealValue || 0), 0);

          return (
            <div 
              key={stage}
              className="w-72 bg-[#f0f2f5] rounded-xl flex flex-col max-h-[calc(100vh-240px)] shadow-sm border border-gray-200/80 shrink-0"
            >
              {/* Kanban Column Header */}
              <div className="p-3 bg-white rounded-t-xl border-b border-gray-200">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: config.bgColor }}
                    />
                    <span className="font-bold text-xs text-gray-800 tracking-tight">{stage}</span>
                  </div>
                  <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {stageItems.length}
                  </span>
                </div>

                <div className="text-[11px] font-bold text-emerald-600">
                  {formatCurrency(stageValue)}
                </div>
              </div>

              {/* Kanban Cards List */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                {stageItems.map(({ item, groupId }) => {
                  const priorityCfg = PRIORITY_CONFIGS[item.priority];
                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectItem(item, groupId)}
                      className="bg-white p-3 rounded-lg border border-gray-200/90 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group"
                    >
                      {/* Priority Tag */}
                      <div className="flex items-center justify-between mb-2">
                        <span 
                          className="text-[10px] font-bold px-2 py-0.5 rounded text-white"
                          style={{ backgroundColor: priorityCfg.bgColor }}
                        >
                          {item.priority}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {item.probability}% Win Prob
                        </span>
                      </div>

                      {/* Deal Name */}
                      <h4 className="font-bold text-xs text-gray-900 leading-snug group-hover:text-[#0073ea] transition-colors mb-1.5 line-clamp-2">
                        {item.name}
                      </h4>

                      {/* Customer / Contact */}
                      <div className="text-[11px] text-gray-500 mb-2 truncate">
                        👤 {item.contactPerson}
                      </div>

                      {/* Value & Owner */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                        <span className="font-extrabold text-xs text-gray-900">
                          {formatCurrency(item.dealValue)}
                        </span>
                        
                        <div className="flex items-center gap-1.5" title={`Owner: ${item.owner.name}`}>
                          <span className="text-xs">{item.owner.avatar}</span>
                          <span className="text-[10px] font-medium text-gray-600">
                            {item.owner.name.split(' ')[0]}
                          </span>
                        </div>
                      </div>

                      {/* Quick Move Stage dropdown */}
                      <div className="mt-2.5 pt-2 border-t border-dashed border-gray-200 flex items-center justify-between text-[10px] text-gray-500">
                        <span>Close: {item.expectedCloseDate || 'TBD'}</span>
                        <select
                          value={item.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onUpdateItemStatus(item.id, e.target.value as StatusType)}
                          className="bg-gray-100 hover:bg-gray-200 text-[10px] rounded px-1 py-0.5 text-gray-700 outline-none font-medium cursor-pointer"
                        >
                          {stages.map((st) => (
                            <option key={st} value={st}>Move: {st}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}

                {stageItems.length === 0 && (
                  <div className="py-8 text-center text-xs text-gray-400 italic">
                    No deals in this stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
