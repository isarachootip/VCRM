'use client';

import React from 'react';
import { CRMItem, CRMGroup, StatusType } from '@/types/crm';
import { STATUS_CONFIGS, PRIORITY_CONFIGS } from '@/data/mockData';
import { useLanguage } from '@/context/LanguageContext';

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
  const { t, language } = useLanguage();

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
    return new Intl.NumberFormat(language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-US', { 
      style: 'currency', 
      currency: language === 'th' ? 'THB' : language === 'zh' ? 'CNY' : 'USD', 
      maximumFractionDigits: 0 
    }).format(val);
  };

  return (
    <div className="p-6 overflow-x-auto select-none min-h-[calc(100vh-210px)]">
      <div className="flex gap-4 items-start min-w-max pb-8">
        {stages.map((stage) => {
          const config = STATUS_CONFIGS[stage] || { label: stage, bgColor: '#c4c4c4' };
          const stageItems = allItemsWithGroup.filter((x) => x.item.status === stage);
          const stageValue = stageItems.reduce((sum, x) => sum + (x.item.dealValue || 0), 0);

          return (
            <div 
              key={stage}
              className="w-72 bg-muted/40 rounded-2xl flex flex-col max-h-[calc(100vh-240px)] shadow-xs border border-border shrink-0 transition-colors"
            >
              {/* Kanban Column Header */}
              <div className="p-3.5 bg-card rounded-t-2xl border-b border-border">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shadow-xs" 
                      style={{ backgroundColor: config.bgColor }}
                    />
                    <span className="font-bold text-xs text-foreground tracking-tight">{t(stage)}</span>
                  </div>
                  <span className="text-[11px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {stageItems.length}
                  </span>
                </div>

                <div className="text-[11px] font-bold text-emerald-500">
                  {formatCurrency(stageValue)}
                </div>
              </div>

              {/* Kanban Cards List */}
              <div className="p-3 space-y-3 overflow-y-auto flex-1">
                {stageItems.map(({ item, groupId }) => {
                  const priorityCfg = PRIORITY_CONFIGS[item.priority] || { label: item.priority, bgColor: '#c4c4c4' };
                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectItem(item, groupId)}
                      className="bg-card p-3.5 rounded-xl border border-border shadow-xs hover:shadow-md hover:border-violet-500/60 transition-all cursor-pointer group"
                    >
                      {/* Priority Tag */}
                      <div className="flex items-center justify-between mb-2">
                        <span 
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white shadow-2xs"
                          style={{ backgroundColor: priorityCfg.bgColor }}
                        >
                          {t(item.priority)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {item.probability}% {t('Probability')}
                        </span>
                      </div>

                      {/* Deal Name */}
                      <h4 className="font-bold text-xs text-foreground leading-snug group-hover:text-violet-500 transition-colors mb-1.5 line-clamp-2">
                        {item.name}
                      </h4>

                      {/* Customer / Contact */}
                      <div className="text-[11px] text-muted-foreground mb-2 truncate">
                        👤 {item.contactPerson}
                      </div>

                      {/* Value & Owner */}
                      <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
                        <span className="font-extrabold text-xs text-foreground">
                          {formatCurrency(item.dealValue)}
                        </span>
                        
                        <div className="flex items-center gap-1.5" title={`Owner: ${item.owner.name}`}>
                          <span className="text-xs">{item.owner.avatar}</span>
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {item.owner.name.split(' ')[0]}
                          </span>
                        </div>
                      </div>

                      {/* Quick Move Stage dropdown */}
                      <div className="mt-2.5 pt-2 border-t border-dashed border-border flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{t('Close Date')}: {item.expectedCloseDate || 'TBD'}</span>
                        <select
                          value={item.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onUpdateItemStatus(item.id, e.target.value as StatusType)}
                          className="bg-muted hover:bg-accent text-[10px] rounded-lg px-2 py-0.5 text-foreground outline-none font-medium cursor-pointer border border-border transition-colors"
                        >
                          {stages.map((st) => (
                            <option key={st} value={st} className="bg-card text-foreground">{t('Move')}: {t(st)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}

                {stageItems.length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground/60 italic">
                    {t('No deals in this stage')}
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
