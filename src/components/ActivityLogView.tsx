'use client';

import React from 'react';
import { CRMGroup } from '@/types/crm';
import { History, User, Clock, CheckCircle, ArrowRightCircle } from 'lucide-react';

interface ActivityLogViewProps {
  groups: CRMGroup[];
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({ groups }) => {
  const allActivities: {
    dealName: string;
    user: string;
    avatar: string;
    action: string;
    timestamp: string;
  }[] = [];

  groups.forEach((g) => {
    g.items.forEach((item) => {
      (item.activities || []).forEach((act) => {
        allActivities.push({
          dealName: item.name,
          user: act.user,
          avatar: act.avatar,
          action: act.action,
          timestamp: act.timestamp,
        });
      });
    });
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <History className="text-[#0073ea]" size={20} />
            <h3 className="font-bold text-base text-gray-900">Board Activity & Audit Trail</h3>
          </div>
          <span className="text-xs text-gray-400">
            {allActivities.length} Historical logs recorded
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {allActivities.map((act, idx) => (
            <div 
              key={idx} 
              className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100 hover:bg-blue-50/40 transition-colors"
            >
              <span className="text-2xl shrink-0">{act.avatar}</span>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">{act.user}</span>
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Clock size={12} />
                    {act.timestamp}
                  </span>
                </div>
                <div className="text-gray-700 mt-1">
                  {act.action}
                </div>
                <div className="mt-1.5 text-[11px] font-semibold text-[#0073ea] bg-blue-50/80 inline-block px-2 py-0.5 rounded">
                  📌 {act.dealName}
                </div>
              </div>
            </div>
          ))}

          {allActivities.length === 0 && (
            <div className="py-12 text-center text-xs text-gray-400">
              No activity logged yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
