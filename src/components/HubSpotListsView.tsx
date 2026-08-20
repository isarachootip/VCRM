'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  ListFilter, 
  Sparkles, 
  Download, 
  Upload, 
  MoreHorizontal, 
  Trash2, 
  Copy, 
  Edit3, 
  FolderPlus, 
  Users, 
  Building2, 
  Briefcase, 
  Ticket, 
  RefreshCw, 
  Pin, 
  ExternalLink,
  CheckCircle2,
  ChevronDown,
  X,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { HubSpotList, HubSpotObjectType, HubSpotListType } from '@/types/hubspot';
import { HUBSPOT_OBJECT_LISTS } from '@/data/hubspotMockData';

interface HubSpotListsViewProps {
  onSelectList?: (list: HubSpotList) => void;
  onOpenCreateList?: () => void;
}

export const HubSpotListsView: React.FC<HubSpotListsViewProps> = ({
  onSelectList,
  onOpenCreateList
}) => {
  const [lists, setLists] = useState<HubSpotList[]>(HUBSPOT_OBJECT_LISTS);
  const [activeTab, setActiveTab] = useState<'all' | 'contacts' | 'companies' | 'deals' | 'my'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedObjectType, setSelectedObjectType] = useState<string>('ALL');
  const [selectedListType, setSelectedListType] = useState<string>('ALL');
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<keyof HubSpotList>('lastUpdated');
  const [sortAsc, setSortAsc] = useState(false);
  const [activeListModal, setActiveListModal] = useState<HubSpotList | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form State for new list
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [newListObjType, setNewListObjType] = useState<HubSpotObjectType>('CONTACTS');
  const [newListType, setNewListType] = useState<HubSpotListType>('ACTIVE');
  const [newListFolder, setNewListFolder] = useState('Marketing Funnel');

  // Filtered lists
  const filteredLists = useMemo(() => {
    return lists.filter((list) => {
      // Tab filter
      if (activeTab === 'contacts' && list.objectType !== 'CONTACTS') return false;
      if (activeTab === 'companies' && list.objectType !== 'COMPANIES') return false;
      if (activeTab === 'deals' && list.objectType !== 'DEALS') return false;
      if (activeTab === 'my' && !list.createdBy.name.includes('Thanakorn')) return false;

      // Object dropdown
      if (selectedObjectType !== 'ALL' && list.objectType !== selectedObjectType) return false;

      // List type dropdown
      if (selectedListType !== 'ALL' && list.listType !== selectedListType) return false;

      // Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = list.name.toLowerCase().includes(term);
        const matchDesc = list.description?.toLowerCase().includes(term);
        const matchCreator = list.createdBy.name.toLowerCase().includes(term);
        const matchFolder = list.folder?.toLowerCase().includes(term);
        if (!matchName && !matchDesc && !matchCreator && !matchFolder) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(String(valB)) : String(valB).localeCompare(valA);
      }
      if (typeof valA === 'number') {
        return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      }
      return 0;
    });
  }, [lists, activeTab, selectedObjectType, selectedListType, searchTerm, sortField, sortAsc]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedListIds(filteredLists.map((l) => l.id));
    } else {
      setSelectedListIds([]);
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedListIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSort = (field: keyof HubSpotList) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleDeleteSelected = () => {
    setLists((prev) => prev.filter((l) => !selectedListIds.includes(l.id)));
    setSelectedListIds([]);
  };

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    const created: HubSpotList = {
      id: `list-${Date.now()}`,
      name: newListName,
      description: newListDesc || 'Custom segment list created via VCRM Lists Engine',
      objectType: newListObjType,
      listType: newListType,
      size: Math.floor(Math.random() * 200) + 15,
      createdDate: new Date().toISOString().split('T')[0],
      createdBy: {
        name: 'Thanakorn W.',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'
      },
      lastUpdated: 'Just now',
      folder: newListFolder
    };

    setLists([created, ...lists]);
    setIsCreateModalOpen(false);
    setNewListName('');
    setNewListDesc('');
  };

  const getObjectTypeIcon = (type: HubSpotObjectType) => {
    switch (type) {
      case 'CONTACTS': return <Users size={14} className="text-blue-600" />;
      case 'COMPANIES': return <Building2 size={14} className="text-amber-600" />;
      case 'DEALS': return <Briefcase size={14} className="text-purple-600" />;
      case 'TICKETS': return <Ticket size={14} className="text-emerald-600" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f5f8fa] overflow-hidden text-slate-800">
      {/* 1. HubSpot Sub-Header & Breadcrumb */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
              <span>CRM</span>
              <span>/</span>
              <span className="text-slate-700">Contacts & Objects</span>
              <span>/</span>
              <span className="text-orange-600 font-semibold">Lists</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lists</h1>
              <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-200">
                {lists.length} lists total
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                alert('Exporting 25 lists to Excel / CSV format...');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded shadow-sm transition-colors"
            >
              <Download size={14} className="text-slate-500" />
              <span>Export lists</span>
            </button>

            <button 
              onClick={() => alert('Opening VCRM Excel/CSV List Import Wizard...')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded shadow-sm transition-colors"
            >
              <Upload size={14} className="text-slate-500" />
              <span>Import</span>
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#ff7a59] hover:bg-[#ff5c35] rounded shadow-sm transition-all active:scale-95"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Create list</span>
              <ChevronDown size={12} className="opacity-80" />
            </button>
          </div>
        </div>

        {/* Tabs Bar (HubSpot Style) */}
        <div className="flex items-center space-x-6 mt-4 border-b border-transparent text-sm">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-2 font-semibold text-xs border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>All lists</span>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-bold">{lists.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('contacts')}
            className={`pb-2 font-semibold text-xs border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'contacts'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users size={13} />
            <span>Contact lists</span>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-bold">
              {lists.filter(l => l.objectType === 'CONTACTS').length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('companies')}
            className={`pb-2 font-semibold text-xs border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'companies'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 size={13} />
            <span>Company lists</span>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-bold">
              {lists.filter(l => l.objectType === 'COMPANIES').length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('deals')}
            className={`pb-2 font-semibold text-xs border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'deals'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase size={13} />
            <span>Deal lists</span>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-bold">
              {lists.filter(l => l.objectType === 'DEALS').length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('my')}
            className={`pb-2 font-semibold text-xs border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'my'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Pin size={13} />
            <span>My lists</span>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-bold">
              {lists.filter(l => l.createdBy.name.includes('Thanakorn')).length}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Search, Filters & Bulk Actions Toolbar */}
      <div className="bg-[#f5f8fa] px-6 py-3 border-b border-slate-200 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="flex items-center gap-3 flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by list name, description, or owner..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded shadow-xs focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder-slate-400"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Object Type Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium hidden lg:inline">Object:</span>
              <select
                value={selectedObjectType}
                onChange={(e) => setSelectedObjectType(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="ALL">All objects</option>
                <option value="CONTACTS">Contacts</option>
                <option value="COMPANIES">Companies</option>
                <option value="DEALS">Deals</option>
                <option value="TICKETS">Tickets</option>
              </select>
            </div>

            {/* List Type Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium hidden lg:inline">Type:</span>
              <select
                value={selectedListType}
                onChange={(e) => setSelectedListType(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="ALL">All types</option>
                <option value="ACTIVE">Active (Dynamic)</option>
                <option value="STATIC">Static (Snapshot)</option>
              </select>
            </div>
          </div>

          {/* Bulk Action Bar (when selected) */}
          {selectedListIds.length > 0 ? (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded animate-fadeIn text-xs">
              <span className="font-semibold text-orange-800">
                {selectedListIds.length} list{selectedListIds.length > 1 ? 's' : ''} selected
              </span>
              <div className="h-4 w-[1px] bg-orange-200"></div>
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1 text-red-600 hover:text-red-700 font-medium hover:underline"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
              <button
                onClick={() => alert(`Moving ${selectedListIds.length} lists to folder...`)}
                className="flex items-center gap-1 text-slate-700 hover:text-slate-900 font-medium hover:underline"
              >
                <FolderPlus size={13} />
                <span>Move to folder</span>
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-semibold text-slate-700">{filteredLists.length}</span> of {lists.length} lists
            </div>
          )}
        </div>
      </div>

      {/* 3. HubSpot Main Data Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#f5f8fa] border-b border-slate-200 text-slate-600 font-semibold select-none sticky top-0 z-10">
              <th className="py-3 px-4 w-10">
                <input
                  type="checkbox"
                  checked={selectedListIds.length === filteredLists.length && filteredLists.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
              </th>
              <th 
                onClick={() => handleSort('name')}
                className="py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-200/50 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Name</span>
                  <ArrowUpDown size={12} className="text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 font-semibold text-slate-700">Object Type</th>
              <th className="py-3 px-4 font-semibold text-slate-700">List Type</th>
              <th 
                onClick={() => handleSort('size')}
                className="py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-200/50 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Size (Records)</span>
                  <ArrowUpDown size={12} className="text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 font-semibold text-slate-700">Folder</th>
              <th className="py-3 px-4 font-semibold text-slate-700">Created by</th>
              <th 
                onClick={() => handleSort('lastUpdated')}
                className="py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-200/50 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Last updated</span>
                  <ArrowUpDown size={12} className="text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {filteredLists.map((list) => {
              const isSelected = selectedListIds.includes(list.id);
              return (
                <tr
                  key={list.id}
                  className={`hover:bg-slate-50/80 transition-colors group ${
                    isSelected ? 'bg-orange-50/40' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectOne(list.id)}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                    />
                  </td>

                  {/* Name + Description */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <button
                        onClick={() => setActiveListModal(list)}
                        className="text-left font-semibold text-[#0066cc] hover:text-[#004d99] hover:underline flex items-center gap-1.5 group-hover:translate-x-0.5 transition-transform"
                      >
                        <span>{list.name}</span>
                        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-slate-400" />
                      </button>
                      <span className="text-[11px] text-slate-500 line-clamp-1 max-w-md mt-0.5">
                        {list.description}
                      </span>
                    </div>
                  </td>

                  {/* Object Type Badge */}
                  <td className="py-3 px-4">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 border border-slate-200 text-slate-700">
                      {getObjectTypeIcon(list.objectType)}
                      <span>{list.objectType}</span>
                    </div>
                  </td>

                  {/* List Type Badge */}
                  <td className="py-3 px-4">
                    {list.listType === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <RefreshCw size={11} className="text-emerald-600 animate-spin-slow" />
                        <span>Active (Dynamic)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        <Pin size={11} className="text-slate-500" />
                        <span>Static</span>
                      </span>
                    )}
                  </td>

                  {/* Size */}
                  <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                    {list.size.toLocaleString()}
                  </td>

                  {/* Folder */}
                  <td className="py-3 px-4 text-slate-600">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium text-slate-600">
                      {list.folder || 'General'}
                    </span>
                  </td>

                  {/* Created By */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <img
                        src={list.createdBy.avatar}
                        alt={list.createdBy.name}
                        className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-300"
                      />
                      <span className="text-slate-700 font-medium">{list.createdBy.name}</span>
                    </div>
                  </td>

                  {/* Last Updated */}
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                    {list.lastUpdated}
                  </td>

                  {/* Actions Dropdown */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                      <button
                        onClick={() => setActiveListModal(list)}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800"
                        title="View list details & filters"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => {
                          const cloned: HubSpotList = {
                            ...list,
                            id: `list-${Date.now()}`,
                            name: `${list.name} (Copy)`,
                            lastUpdated: 'Just now'
                          };
                          setLists([cloned, ...lists]);
                        }}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800"
                        title="Clone list"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => {
                          setLists(lists.filter(l => l.id !== list.id));
                        }}
                        className="p-1.5 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                        title="Delete list"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredLists.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
            <ListFilter size={36} className="text-slate-300 mb-3" />
            <h3 className="text-base font-semibold text-slate-700">No lists found matching your filter</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Try adjusting your search keywords or clear the object and list type filters.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedObjectType('ALL');
                setSelectedListType('ALL');
                setActiveTab('all');
              }}
              className="mt-4 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* 4. Modal: Create New List Dialog (HubSpot Style) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-scaleIn">
            <div className="bg-[#2d3e50] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#ff7a59] flex items-center justify-center text-white text-xs font-bold">
                  +
                </div>
                <h2 className="text-base font-bold">Create new list (VCRM Segment)</h2>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-300 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateList} className="p-6 space-y-4 text-xs">
              {/* List Type Option Cards */}
              <div>
                <label className="block text-slate-700 font-semibold mb-2">Select List Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setNewListType('ACTIVE')}
                    className={`border-2 rounded-lg p-3.5 cursor-pointer transition-all ${
                      newListType === 'ACTIVE'
                        ? 'border-orange-500 bg-orange-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-900 mb-1">
                      <RefreshCw size={14} className="text-orange-500" />
                      <span>Active list</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Automatically adds or removes records based on filter criteria in real-time.
                    </p>
                  </div>

                  <div
                    onClick={() => setNewListType('STATIC')}
                    className={`border-2 rounded-lg p-3.5 cursor-pointer transition-all ${
                      newListType === 'STATIC'
                        ? 'border-orange-500 bg-orange-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-900 mb-1">
                      <Pin size={14} className="text-slate-600" />
                      <span>Static list</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Saves a snapshot of specific records. Does not update automatically over time.
                    </p>
                  </div>
                </div>
              </div>

              {/* Object Type */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Object to segment</label>
                <select
                  value={newListObjType}
                  onChange={(e) => setNewListObjType(e.target.value as HubSpotObjectType)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-xs font-medium text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                >
                  <option value="CONTACTS">Contacts (People / Leads)</option>
                  <option value="COMPANIES">Companies (Accounts / Organizations)</option>
                  <option value="DEALS">Deals (Sales Opportunities & Pipelines)</option>
                  <option value="TICKETS">Tickets (Service / Work Orders)</option>
                </select>
              </div>

              {/* List Name */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">List name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Retail Decision Makers Q3 2026"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Explain the purpose and segment rules of this list..."
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              {/* Folder */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Folder</label>
                <select
                  value={newListFolder}
                  onChange={(e) => setNewListFolder(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-xs font-medium text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                >
                  <option value="Enterprise Segments">Enterprise Segments</option>
                  <option value="Inbound Campaigns">Inbound Campaigns</option>
                  <option value="VIP Lists">VIP Lists</option>
                  <option value="Pipeline">Pipeline</option>
                  <option value="Industry Segments">Industry Segments</option>
                  <option value="Event Leads">Event Leads</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#ff7a59] hover:bg-[#ff5c35] text-white font-semibold rounded text-xs shadow-sm transition-all active:scale-95"
                >
                  Next: Add Filter Criteria & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: View List Details & Filter Breakdown */}
      {activeListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-scaleIn">
            <div className="bg-[#2d3e50] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-white/10 text-orange-400">
                  {getObjectTypeIcon(activeListModal.objectType)}
                </div>
                <div>
                  <h2 className="text-base font-bold">{activeListModal.name}</h2>
                  <span className="text-[11px] text-slate-300">{activeListModal.folder} • {activeListModal.objectType}</span>
                </div>
              </div>
              <button 
                onClick={() => setActiveListModal(null)}
                className="text-slate-300 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">List Type</span>
                  <p className="font-bold text-slate-800 mt-0.5">{activeListModal.listType}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Records</span>
                  <p className="font-bold text-orange-600 font-mono text-base">{activeListModal.size.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Created Date</span>
                  <p className="font-bold text-slate-800 mt-0.5">{activeListModal.createdDate}</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-1">Description & Objective</h4>
                <p className="text-slate-600 bg-slate-50 p-3 rounded border border-slate-200 leading-relaxed">
                  {activeListModal.description}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Filter size={13} className="text-orange-500" />
                  <span>VCRM Filter Rules (AND/OR Logic)</span>
                </h4>
                <div className="bg-orange-50/50 border border-orange-200 rounded p-3 space-y-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="bg-orange-600 text-white px-2 py-0.5 rounded font-bold">Rule 1</span>
                    <span className="text-slate-800 font-medium">Lifecycle Stage is any of <span className="font-bold text-orange-700">Lead, Opportunity, Customer</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="bg-slate-600 text-white px-2 py-0.5 rounded font-bold">AND</span>
                    <span className="text-slate-800 font-medium">Last Activity Date was less than <span className="font-bold text-slate-900">30 days ago</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="bg-slate-600 text-white px-2 py-0.5 rounded font-bold">AND</span>
                    <span className="text-slate-800 font-medium">Country / Region is equal to <span className="font-bold text-slate-900">Thailand (TH)</span></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 text-slate-500">
                  <img src={activeListModal.createdBy.avatar} alt="Creator" className="w-5 h-5 rounded-full" />
                  <span>Created by {activeListModal.createdBy.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      alert(`Exporting "${activeListModal.name}" (${activeListModal.size} records) to Excel.`);
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded text-xs"
                  >
                    Export Records
                  </button>
                  <button
                    onClick={() => setActiveListModal(null)}
                    className="px-4 py-1.5 bg-[#ff7a59] hover:bg-[#ff5c35] text-white font-semibold rounded text-xs shadow-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
