'use client';

import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  UserCheck, 
  Truck, 
  Wrench, 
  Hammer, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Filter, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  ExternalLink,
  Camera,
  FileSignature,
  Package,
  Layers,
  Phone,
  Eye
} from 'lucide-react';
import { CRMGroup, CRMItem, StatusType } from '@/types/crm';
import { STATUS_CONFIGS, PRIORITY_CONFIGS } from '@/data/mockData';

interface DispatchBoardViewProps {
  groups: CRMGroup[];
  onUpdateItemStatus?: (itemId: string, newStatus: StatusType) => void;
  onSelectItem?: (item: CRMItem, groupId: string) => void;
}

interface TechnicianResource {
  id: string;
  name: string;
  avatar: string;
  role: string;
  phone: string;
  status: 'available' | 'busy' | 'transit';
  skills: string[];
  vehicle?: string;
}

const TECHNICIANS: TechnicianResource[] = [
  {
    id: 'tech-1',
    name: 'Somchai Prasert (สมชาย)',
    avatar: '👨‍🔧',
    role: 'Senior HVAC & Electrician',
    phone: '081-998-1122',
    status: 'busy',
    skills: ['⚡ Electrical', '❄️ HVAC/Aircon', '🔧 Inverter'],
    vehicle: 'Van 1ฒฮ-4521 BKK'
  },
  {
    id: 'tech-2',
    name: 'Wichai Rungruang (วิชัย)',
    avatar: '🚛',
    role: 'Logistics & Heavy Delivery',
    phone: '089-445-6677',
    status: 'transit',
    skills: ['🚛 6-Wheel Truck', '📦 Heavy Rigging', '🗺️ BKK Route'],
    vehicle: 'Truck 70-8912 BKK'
  },
  {
    id: 'tech-3',
    name: 'Ekachai Builder (เอกชัย)',
    avatar: '🏗️',
    role: 'Site Supervisor / PM',
    phone: '086-332-9900',
    status: 'busy',
    skills: ['🏗️ Civil Eng', '📐 Interior Fitout', '📋 BOQ Audit'],
    vehicle: 'Pickup 2ฒค-9011 BKK'
  },
  {
    id: 'tech-4',
    name: 'Niran Repairman (นิรันดร์)',
    avatar: '⚡',
    role: 'Preventive Maintenance Tech',
    phone: '082-114-8833',
    status: 'available',
    skills: ['⚡ High Voltage', '🔄 Pump/Motor', '🛡️ Fire Alarm'],
    vehicle: 'Motorbike 1กก-3344 BKK'
  },
  {
    id: 'tech-5',
    name: 'Kittisak Solar (กิตติศักดิ์)',
    avatar: '☀️',
    role: 'Solar & Smart Home Specialist',
    phone: '095-223-1199',
    status: 'available',
    skills: ['☀️ Solar Rooftop', '🏠 IoT Smart Home', '🔋 ESS Battery'],
    vehicle: 'Van 3ฒผ-1289 BKK'
  }
];

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', 
  '14:00', '15:00', '16:00', '17:00', '18:00'
];

export const DispatchBoardView: React.FC<DispatchBoardViewProps> = ({
  groups,
  onUpdateItemStatus,
  onSelectItem,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('2026-08-19');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [activeJobPreview, setActiveJobPreview] = useState<CRMItem | null>(null);

  // Extract all service items across groups
  const allItems = groups.flatMap((g) => g.items.map(item => ({ item, groupId: g.id })));

  // Filter items by service type
  const filteredJobs = allItems.filter(({ item }) => {
    if (filterType === 'ALL') return true;
    return item.serviceType === filterType;
  });

  // Helper to map service type badge
  const getServiceBadge = (type?: string) => {
    switch (type) {
      case 'DELIVERY':
        return { label: '🚚 Delivery', bg: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'INSTALL':
        return { label: '🛠️ Install', bg: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'RENOVATE':
        return { label: '🏗️ Renovate', bg: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'MAINTAIN':
        return { label: '⚡ Maintenance', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      default:
        return { label: '📋 Service Job', bg: 'bg-gray-100 text-gray-800 border-gray-300' };
    }
  };

  // Get color by service type
  const getCardColor = (type?: string) => {
    switch (type) {
      case 'DELIVERY':
        return 'border-l-4 border-l-amber-500 bg-amber-50/80 hover:bg-amber-100/90 text-amber-950';
      case 'INSTALL':
        return 'border-l-4 border-l-blue-500 bg-blue-50/80 hover:bg-blue-100/90 text-blue-950';
      case 'RENOVATE':
        return 'border-l-4 border-l-purple-500 bg-purple-50/80 hover:bg-purple-100/90 text-purple-950';
      case 'MAINTAIN':
        return 'border-l-4 border-l-emerald-500 bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-950';
      default:
        return 'border-l-4 border-l-indigo-500 bg-indigo-50/80 hover:bg-indigo-100/90 text-indigo-950';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-[#e6e9ef] p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Date Selector & Live Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#f5f6f8] px-3 py-1.5 rounded-lg border border-gray-200">
            <button className="text-gray-500 hover:text-gray-800 p-1">
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
              <CalendarIcon size={15} className="text-[#0073ea]" />
              <span>Today: Wednesday, 19 Aug 2026</span>
            </div>
            <button className="text-gray-500 hover:text-gray-800 p-1">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              GPS Live Dispatch
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600 font-medium">{TECHNICIANS.length} Active Field Units</span>
          </div>
        </div>

        {/* Right: Service Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Services (ทั้งหมด)' },
            { id: 'DELIVERY', label: '🚚 ส่งสินค้า (Delivery)' },
            { id: 'INSTALL', label: '🛠️ ติดตั้ง (Install)' },
            { id: 'RENOVATE', label: '🏗️ รีโนเวท (Renovate)' },
            { id: 'MAINTAIN', label: '⚡ ซ่อมบำรุง (Maintenance)' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setFilterType(pill.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterType === pill.id
                  ? 'bg-[#0073ea] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Gantt / Calendar Dispatch Matrix */}
      <div className="bg-white rounded-xl shadow-xs border border-[#e6e9ef] overflow-hidden">
        {/* Matrix Header */}
        <div className="border-b border-[#e6e9ef] bg-gray-50/75 grid grid-cols-12 text-xs font-bold text-gray-700 select-none">
          {/* Technician / Resource Column */}
          <div className="col-span-3 p-3 border-r border-[#e6e9ef] flex items-center justify-between">
            <span>FIELD TECHNICIAN & VEHICLE</span>
            <span className="text-[10px] text-gray-400 font-normal">Skills / Vehicle</span>
          </div>

          {/* Time Slots (08:00 - 18:00) */}
          <div className="col-span-9 grid grid-cols-11 text-center divide-x divide-[#e6e9ef]">
            {TIME_SLOTS.map((time) => (
              <div key={time} className="py-3 px-1 text-[11px] text-gray-600 font-semibold">
                {time}
              </div>
            ))}
          </div>
        </div>

        {/* Matrix Rows (Technicians) */}
        <div className="divide-y divide-[#e6e9ef]">
          {TECHNICIANS.map((tech, idx) => {
            // Find jobs assigned to this technician (or mock distribution)
            const techJobs = filteredJobs.filter(({ item }) => {
              if (item.assignedTechnician) {
                return item.assignedTechnician.toLowerCase().includes(tech.name.split(' ')[0].toLowerCase());
              }
              // Fallback demo mapping by index
              return item.owner.name.includes(tech.name.split(' ')[0]) || (allItems.indexOf({ item, groupId: '' }) % TECHNICIANS.length === idx);
            });

            return (
              <div key={tech.id} className="grid grid-cols-12 min-h-[105px] hover:bg-slate-50/50 transition-colors">
                {/* 1. Technician Card */}
                <div className="col-span-3 p-3.5 border-r border-[#e6e9ef] flex flex-col justify-between bg-white">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xl bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                          {tech.avatar}
                        </span>
                        <div className="truncate">
                          <h4 className="text-xs font-bold text-[#323338] truncate">{tech.name}</h4>
                          <p className="text-[10px] text-gray-500 truncate">{tech.role}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                        tech.status === 'available' ? 'bg-emerald-100 text-emerald-800' :
                        tech.status === 'busy' ? 'bg-blue-100 text-blue-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {tech.status}
                      </span>
                    </div>

                    {/* Skills pills */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tech.skills.map((skill, sIdx) => (
                        <span key={sIdx} className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Vehicle & Phone */}
                  <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2 border-t border-gray-100 mt-2">
                    <span className="flex items-center gap-1 text-gray-600 font-medium truncate">
                      <Truck size={12} className="text-gray-400" />
                      {tech.vehicle}
                    </span>
                    <span className="flex items-center gap-1 text-[#0073ea]">
                      <Phone size={11} />
                      {tech.phone}
                    </span>
                  </div>
                </div>

                {/* 2. Timeline Grid & Assigned Jobs */}
                <div className="col-span-9 grid grid-cols-11 relative divide-x divide-gray-100 bg-[#fafbfc]">
                  {/* Subtle vertical hour guide lines */}
                  {TIME_SLOTS.map((t) => (
                    <div key={t} className="h-full border-r border-dashed border-gray-200/60 pointer-events-none"></div>
                  ))}

                  {/* Render Assigned Job Cards Over Timeline */}
                  {techJobs.slice(0, 2).map(({ item, groupId }, jobIdx) => {
                    const badge = getServiceBadge(item.serviceType);
                    const cardTheme = getCardColor(item.serviceType);
                    
                    // Simulated time placement
                    const startSlot = jobIdx === 0 ? (idx % 2 === 0 ? 1 : 2) : 6;
                    const spanSlots = item.durationHours || (item.serviceType === 'RENOVATE' ? 4 : item.serviceType === 'INSTALL' ? 3 : 2);
                    const timeRange = `${TIME_SLOTS[startSlot]} - ${TIME_SLOTS[Math.min(startSlot + spanSlots, TIME_SLOTS.length - 1)]}`;

                    return (
                      <div
                        key={item.id}
                        onClick={() => setActiveJobPreview(item)}
                        style={{
                          left: `${(startSlot / 11) * 100 + 0.5}%`,
                          width: `${(spanSlots / 11) * 100 - 1}%`,
                          top: `${jobIdx === 0 ? 10 : 54}px`,
                        }}
                        className={`absolute z-10 p-2 rounded-lg shadow-sm border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md ${cardTheme}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${badge.bg}`}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] font-semibold text-gray-600 flex items-center gap-1">
                            <Clock size={10} />
                            {item.scheduledTime || timeRange}
                          </span>
                        </div>

                        <h5 className="text-[11px] font-bold truncate mt-1 text-[#1e293b]" title={item.name}>
                          {item.name}
                        </h5>

                        <div className="flex items-center justify-between text-[10px] text-gray-600 mt-1">
                          <span className="truncate flex items-center gap-1">
                            <MapPin size={11} className="text-rose-500 shrink-0" />
                            {item.address || item.companyName || 'Bangkok Site'}
                          </span>
                          <span className="font-bold text-gray-800">
                            ฿{(item.dealValue || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Job Details & Proof Modal / Side Panel */}
      {activeJobPreview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1e293b] to-[#334155] text-white p-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/40">
                    {getServiceBadge(activeJobPreview.serviceType).label}
                  </span>
                  <span className="text-xs text-gray-300">Ticket ID: {activeJobPreview.id}</span>
                </div>
                <h3 className="text-lg font-bold mt-1 text-white">{activeJobPreview.name}</h3>
                <p className="text-xs text-gray-300 flex items-center gap-1 mt-1">
                  <MapPin size={13} className="text-rose-400" />
                  {activeJobPreview.address || activeJobPreview.companyName || '123 Rama 9 Rd, Huai Khwang, Bangkok 10310'}
                </p>
              </div>
              <button 
                onClick={() => setActiveJobPreview(null)}
                className="text-gray-400 hover:text-white text-xl font-bold bg-white/10 rounded-full w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Content Tabs Body */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* 1. Customer & Time Info */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-400 font-semibold">Customer Contact:</span>
                  <p className="font-bold text-gray-800 mt-0.5">{activeJobPreview.contactPerson} ({activeJobPreview.contactPhone || '081-234-5678'})</p>
                  <p className="text-gray-500">{activeJobPreview.contactEmail}</p>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold">Scheduled Appointment:</span>
                  <p className="font-bold text-gray-800 mt-0.5">{activeJobPreview.expectedCloseDate} | {activeJobPreview.scheduledTime || '09:00 - 11:30'}</p>
                  <p className="text-[#0073ea] font-medium">Assigned: {activeJobPreview.assignedTechnician || 'Somchai Prasert'}</p>
                </div>
              </div>

              {/* 2. Proof of Work (Photos & Signature) */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2 mb-2.5">
                  <Camera size={15} className="text-blue-600" />
                  Proof of Work / Delivery (หลักฐานหน้างาน & ลายเซ็น)
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-100 rounded-lg p-2.5 border border-dashed border-gray-300 text-center">
                    <p className="text-[10px] font-bold text-gray-500 mb-1">📸 Before Work (ก่อนทำ)</p>
                    <div className="h-24 bg-slate-200 rounded flex items-center justify-center text-xs text-gray-400">
                      Photo Captured
                    </div>
                  </div>
                  <div className="bg-slate-100 rounded-lg p-2.5 border border-dashed border-gray-300 text-center">
                    <p className="text-[10px] font-bold text-gray-500 mb-1">📸 After Work (หลังทำ)</p>
                    <div className="h-24 bg-slate-200 rounded flex items-center justify-center text-xs text-gray-400">
                      Photo Captured
                    </div>
                  </div>
                  <div className="bg-slate-100 rounded-lg p-2.5 border border-dashed border-gray-300 text-center">
                    <p className="text-[10px] font-bold text-gray-500 mb-1">✍️ E-Signature (ลูกค้าเซ็น)</p>
                    <div className="h-24 bg-white rounded border border-gray-200 flex flex-col items-center justify-center text-[10px] text-gray-500 font-semibold p-1">
                      <span className="italic text-blue-700 font-serif text-sm">Thanaporn S.</span>
                      <span className="text-[9px] text-emerald-600 mt-1">✓ Verified E-Sign</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Milestones (If Renovate) or Spare Parts (If Maintenance/Install) */}
              {activeJobPreview.serviceType === 'RENOVATE' ? (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2 mb-2">
                    <Layers size={15} className="text-purple-600" />
                    Project Phase Milestones (งวดงานรีโนเวท)
                  </h4>
                  <div className="space-y-2">
                    {[
                      { name: 'Phase 1: Site Survey & Architectural Blueprint', progress: 100, status: 'Completed' },
                      { name: 'Phase 2: Demolition & Structural Reinforcement', progress: 80, status: 'In Progress' },
                      { name: 'Phase 3: Electrical & Piping Rough-in', progress: 20, status: 'Pending' },
                      { name: 'Phase 4: Interior Built-in & Final Handover', progress: 0, status: 'Pending' },
                    ].map((phase, pIdx) => (
                      <div key={pIdx} className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-xs">
                        <div className="flex items-center justify-between font-semibold text-gray-800">
                          <span>{phase.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            phase.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                            phase.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'
                          }`}>{phase.status} ({phase.progress}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                          <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${phase.progress}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2 mb-2">
                    <Package size={15} className="text-emerald-600" />
                    Spare Parts & Materials Used (อะไหล่/วัสดุที่ใช้)
                  </h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-gray-100 text-gray-600 font-semibold">
                        <tr>
                          <th className="p-2">Item / Part Name</th>
                          <th className="p-2 text-center">Qty</th>
                          <th className="p-2 text-right">Unit Price</th>
                          <th className="p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        <tr>
                          <td className="p-2 font-medium">Inverter Board 24,000 BTU</td>
                          <td className="p-2 text-center font-bold">1 pcs</td>
                          <td className="p-2 text-right">฿3,500</td>
                          <td className="p-2 text-right font-bold text-gray-900">฿3,500</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-medium">R32 Refrigerant Gas (2.5 kg)</td>
                          <td className="p-2 text-center font-bold">1 set</td>
                          <td className="p-2 text-right">฿850</td>
                          <td className="p-2 text-right font-bold text-gray-900">฿850</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <a
                href="https://maps.google.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-bold text-[#0073ea] hover:underline"
              >
                <ExternalLink size={14} />
                Open Google Maps Live Route
              </a>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveJobPreview(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    alert('Job status updated to COMPLETED! Client notified via LINE OA.');
                    setActiveJobPreview(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 size={15} />
                  Approve & Close Job
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
