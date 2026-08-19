'use client';

import React, { useState, useRef, useEffect } from 'react';
import { StatusType } from '@/types/crm';
import { STATUS_CONFIGS } from '@/data/mockData';

interface StatusPickerProps {
  currentStatus: StatusType;
  onChange: (newStatus: StatusType) => void;
}

export const StatusPicker: React.FC<StatusPickerProps> = ({ currentStatus, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentConfig = STATUS_CONFIGS[currentStatus] || {
    label: currentStatus,
    color: '#ffffff',
    bgColor: '#c4c4c4',
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const statuses: StatusType[] = [
    'Proposal Sent',
    'Negotiation',
    'Working on it',
    'Qualified',
    'New Lead',
    'Closed Won',
    'Closed Lost',
    'Waiting',
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-full h-8 px-2 flex items-center justify-center font-medium text-xs text-white rounded transition-transform active:scale-95 shadow-sm truncate hover:brightness-105"
        style={{ backgroundColor: currentConfig.bgColor }}
      >
        <span className="truncate">{currentConfig.label}</span>
      </button>

      {isOpen && (
        <div 
          className="absolute z-50 top-full left-0 mt-1 w-44 bg-white rounded-lg shadow-xl border border-gray-200 p-1.5 grid grid-cols-1 gap-1 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] uppercase font-semibold text-gray-400 px-2 py-1">
            Change Stage
          </div>
          {statuses.map((st) => {
            const config = STATUS_CONFIGS[st];
            const isSelected = st === currentStatus;
            return (
              <button
                key={st}
                onClick={() => {
                  onChange(st);
                  setIsOpen(false);
                }}
                className={`w-full py-1.5 px-2.5 rounded text-xs font-medium text-white flex items-center justify-between transition-all hover:opacity-90 ${
                  isSelected ? 'ring-2 ring-blue-500 ring-offset-1 font-bold' : ''
                }`}
                style={{ backgroundColor: config.bgColor }}
              >
                <span>{config.label}</span>
                {isSelected && <span className="text-[10px]">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
