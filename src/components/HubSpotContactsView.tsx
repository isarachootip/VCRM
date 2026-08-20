'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  Download, 
  Upload, 
  Users, 
  Building2, 
  Briefcase, 
  ChevronDown, 
  SlidersHorizontal,
  ArrowUpDown,
  CheckCircle2,
  Trash2,
  Mail,
  Phone,
  UserCheck,
  Tag,
  ExternalLink,
  X
} from 'lucide-react';
import { HubSpotContactRecord, HubSpotViewTab } from '@/types/hubspot';
import { HUBSPOT_CONTACTS_DATA, HUBSPOT_DEFAULT_VIEWS } from '@/data/hubspotMockData';
import { HubSpotRecordDetail } from './HubSpotRecordDetail';

interface HubSpotContactsViewProps {
  onOpenCreateContact?: () => void;
}

export const HubSpotContactsView: React.FC<HubSpotContactsViewProps> = () => {
  const [contacts, setContacts] = useState<HubSpotContactRecord[]>(HUBSPOT_CONTACTS_DATA);
  const [views, setViews] = useState<HubSpotViewTab[]>(HUBSPOT_DEFAULT_VIEWS);
  const [activeViewId, setActiveViewId] = useState<string>('view-all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('ALL');
  const [selectedStage, setSelectedStage] = useState('ALL');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedContact, setSelectedContact] = useState<HubSpotContactRecord | null>(null);

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      // Tab View Filter
      if (activeViewId === 'view-my' && !c.owner.name.includes('Thanakorn')) return false;
      if (activeViewId === 'view-unassigned' && c.owner.name !== 'Unassigned') return false;
      if (activeViewId === 'view-mql' && c.lifecycleStage !== 'MARKETING_QUALIFIED') return false;
      if (activeViewId === 'view-closed' && c.lifecycleStage !== 'CUSTOMER') return false;

      // Owner filter
      if (selectedOwner !== 'ALL' && !c.owner.name.includes(selectedOwner)) return false;

      // Stage filter
      if (selectedStage !== 'ALL' && c.lifecycleStage !== selectedStage) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = c.name.toLowerCase().includes(term);
        const matchEmail = c.email.toLowerCase().includes(term);
        const matchCompany = c.company.name.toLowerCase().includes(term);
        const matchJob = c.jobTitle.toLowerCase().includes(term);
        if (!matchName && !matchEmail && !matchCompany && !matchJob) return false;
      }

      return true;
    });
  }, [contacts, activeViewId, selectedOwner, selectedStage, searchTerm]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedContactIds(filteredContacts.map(c => c.id));
    } else {
      setSelectedContactIds([]);
    }
  };

  const handleToggleOne = (id: string) => {
    setSelectedContactIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'CUSTOMER': return <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded text-[11px] border border-emerald-200">Customer</span>;
      case 'OPPORTUNITY': return <span className="bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded text-[11px] border border-purple-200">Opportunity</span>;
      case 'MARKETING_QUALIFIED': return <span className="bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded text-[11px] border border-amber-200">MQL</span>;
      case 'SALES_QUALIFIED': return <span className="bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded text-[11px] border border-blue-200">SQL</span>;
      case 'LEAD': return <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[11px] border border-slate-200">Lead</span>;
      default: return <span className="bg-gray-100 text-gray-700 font-semibold px-2 py-0.5 rounded text-[11px]">{stage}</span>;
    }
  };

  const getLeadStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN_DEAL': return <span className="text-purple-700 font-bold">Open Deal</span>;
      case 'CONNECTED': return <span className="text-blue-700 font-bold">Connected</span>;
      case 'IN_PROGRESS': return <span className="text-amber-700 font-bold">In Progress</span>;
      case 'NEW': return <span className="text-emerald-700 font-bold">New</span>;
      default: return <span className="text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f5f8fa] overflow-hidden text-slate-800">
      {/* 1. HubSpot Breadcrumb & Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
              <span>CRM</span>
              <span>/</span>
              <span className="text-orange-600 font-semibold">Contacts</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Contacts</h1>
              <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-200">
                {contacts.length} records
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => alert('Exporting contacts to Excel...')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded shadow-sm transition-colors"
            >
              <Download size={14} className="text-slate-500" />
              <span>Export</span>
            </button>

            <button 
              onClick={() => alert('Importing contacts...')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded shadow-sm transition-colors"
            >
              <Upload size={14} className="text-slate-500" />
              <span>Import</span>
            </button>

            <button
              onClick={() => alert('Opening Create Contact modal...')}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#ff7a59] hover:bg-[#ff5c35] rounded shadow-sm transition-all active:scale-95"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Create contact</span>
            </button>
          </div>
        </div>

        {/* Views Tabs (HubSpot Saved Views) */}
        <div className="flex items-center space-x-6 mt-4 border-b border-transparent text-sm">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveViewId(view.id)}
              className={`pb-2 font-semibold text-xs border-b-2 transition-colors flex items-center gap-1.5 ${
                activeViewId === view.id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{view.name}</span>
            </button>
          ))}
          <button 
            onClick={() => alert('Add new custom view tab')}
            className="pb-2 text-xs font-medium text-slate-400 hover:text-slate-600 flex items-center gap-1"
          >
            <Plus size={12} />
            <span>Add view</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Pills Bar (HubSpot Property Quick Filters) */}
      <div className="bg-[#f5f8fa] px-6 py-3 border-b border-slate-200 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search contacts, company, email..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded shadow-2xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Contact Owner Filter Chip */}
            <div className="flex items-center bg-white border border-slate-300 rounded px-2.5 py-1.5 shadow-2xs">
              <span className="text-slate-500 mr-1.5 font-medium">Contact owner:</span>
              <select
                value={selectedOwner}
                onChange={(e) => setSelectedOwner(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All owners</option>
                <option value="Thanakorn">Thanakorn W.</option>
                <option value="Pimchanok">Pimchanok S.</option>
                <option value="Somchai">Somchai P.</option>
                <option value="Nattawut">Nattawut K.</option>
              </select>
            </div>

            {/* Lifecycle Stage Filter Chip */}
            <div className="flex items-center bg-white border border-slate-300 rounded px-2.5 py-1.5 shadow-2xs">
              <span className="text-slate-500 mr-1.5 font-medium">Lifecycle stage:</span>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All stages</option>
                <option value="LEAD">Lead</option>
                <option value="MARKETING_QUALIFIED">MQL</option>
                <option value="SALES_QUALIFIED">SQL</option>
                <option value="OPPORTUNITY">Opportunity</option>
                <option value="CUSTOMER">Customer</option>
              </select>
            </div>

            <button 
              onClick={() => alert('Opening VCRM Advanced Filter Builder (AND/OR Logic)...')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-medium shadow-2xs"
            >
              <Filter size={13} className="text-slate-500" />
              <span>More filters</span>
            </button>
          </div>

          {/* Edit Columns */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => alert('Opening VCRM Property / Column Customizer Drawer...')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-medium shadow-2xs"
            >
              <SlidersHorizontal size={13} className="text-slate-500" />
              <span>Edit columns</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Contacts Data Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#f5f8fa] border-b border-slate-200 text-slate-600 font-semibold select-none sticky top-0 z-10">
              <th className="py-3 px-4 w-10">
                <input
                  type="checkbox"
                  checked={selectedContactIds.length === filteredContacts.length && filteredContacts.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
              </th>
              <th className="py-3 px-4 font-semibold text-slate-700">Name & Title</th>
              <th className="py-3 px-4 font-semibold text-slate-700">Email</th>
              <th className="py-3 px-4 font-semibold text-slate-700">Phone Number</th>
              <th className="py-3 px-4 font-semibold text-slate-700">Associated Company</th>
              <th className="py-3 px-4 font-semibold text-slate-700">Lead Status</th>
              <th className="py-3 px-4 font-semibold text-slate-700">Lifecycle Stage</th>
              <th className="py-3 px-4 font-semibold text-slate-700">Contact Owner</th>
              <th className="py-3 px-4 font-semibold text-slate-700">Associated Deals</th>
              <th className="py-3 px-4 font-semibold text-slate-700">Last Activity</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {filteredContacts.map((contact) => {
              const isSelected = selectedContactIds.includes(contact.id);
              return (
                <tr
                  key={contact.id}
                  className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${
                    isSelected ? 'bg-orange-50/40' : ''
                  }`}
                  onClick={() => setSelectedContact(contact)}
                >
                  {/* Checkbox */}
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleOne(contact.id)}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                    />
                  </td>

                  {/* Name & Title */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center">
                        {contact.firstName.charAt(0)}
                      </div>
                      <div>
                        <span className="font-semibold text-[#0066cc] hover:underline flex items-center gap-1">
                          {contact.name}
                        </span>
                        <span className="text-[11px] text-slate-500 block">{contact.jobTitle}</span>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="py-3 px-4 font-mono text-slate-700">
                    {contact.email}
                  </td>

                  {/* Phone */}
                  <td className="py-3 px-4 font-mono text-slate-700">
                    {contact.phone}
                  </td>

                  {/* Company */}
                  <td className="py-3 px-4">
                    <span className="font-medium text-slate-800 hover:text-orange-600">
                      {contact.company.name}
                    </span>
                  </td>

                  {/* Lead Status */}
                  <td className="py-3 px-4">
                    {getLeadStatusBadge(contact.leadStatus)}
                  </td>

                  {/* Lifecycle Stage */}
                  <td className="py-3 px-4">
                    {getStageBadge(contact.lifecycleStage)}
                  </td>

                  {/* Owner */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <img src={contact.owner.avatar} alt="Owner" className="w-4 h-4 rounded-full object-cover" />
                      <span className="text-slate-700 font-medium">{contact.owner.name}</span>
                    </div>
                  </td>

                  {/* Deals */}
                  <td className="py-3 px-4 font-mono">
                    {contact.associatedDeals && contact.associatedDeals.length > 0 ? (
                      <span className="text-emerald-700 font-bold">
                        ฿{contact.associatedDeals.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
                        <span className="text-slate-400 font-normal ml-1">({contact.associatedDeals.length})</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* Last Activity */}
                  <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                    {contact.lastActivityDate}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. HubSpot 3-Column Record Detail Modal */}
      {selectedContact && (
        <HubSpotRecordDetail
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
        />
      )}
    </div>
  );
};
