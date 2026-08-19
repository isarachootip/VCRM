'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PriorityType } from '@/types/crm';
import { PRIORITY_CONFIGS } from '@/data/mockData';

interface PriorityPickerProps {
  currentPriority: PriorityType;
  onChange: (newPriority: PriorityType) => void;
}

export const PriorityPicker: React.FC<PriorityPickerProps> = ({ currentPriority, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentConfig = PRIORITY_CONFIGS[currentPriority] || {
    label: currentPriority,
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

  const priorities: PriorityType[] = ['Critical', 'High', 'Medium', 'Low', 'None'];

  return (
    <div className="relative w-full h-full flex items-center justify-center" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-full h-8 px-2 flex items-center justify-center font-medium text-xs text-white rounded transition-transform active:scale-95 shadow-sm truncate hover:brightness-105"
        style={{ 
          backgroundColor: currentConfig.bgColor,
          color: currentPriority === 'None' ? '#676879' : '#ffffff'
        }}
      >
        <span className="truncate">{currentConfig.label}</span>
      </button>

      {isOpen && (
        <div 
          className="absolute z-50 top-full left-0 mt-1 w-36 bg-white rounded-lg shadow-xl border border-gray-200 p-1.5 grid grid-cols-1 gap-1 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] uppercase font-semibold text-gray-400 px-2 py-1">
            Priority
          </div>
          {priorities.map((p) => {
            const config = PRIORITY_CONFIGS[p];
            const isSelected = p === currentPriority;
            return (
              <button
                key={p}
                onClick={() => {
                  onChange(p);
                  setIsOpen(false);
                }}
                className={`w-full py-1.5 px-2.5 rounded text-xs font-medium flex items-center justify-between transition-all hover:opacity-90 ${
                  isSelected ? 'ring-2 ring-blue-500 ring-offset-1 font-bold' : ''
                }`}
                style={{ 
                  backgroundColor: config.bgColor,
                  color: p === 'None' ? '#4a5568' : '#ffffff'
                }}
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
