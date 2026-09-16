'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  KeyRound,
  Trash2,
  Edit2,
  Search,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Building,
  Eye,
  EyeOff,
  Crown,
  BadgeCheck,
  Briefcase,
} from 'lucide-react';
import { AuthUser } from '@/lib/auth/user-store';

export type UserWithoutHash = Omit<AuthUser, 'passwordHash'>;
export type UserRole = 'SYSADMIN' | 'ADMIN' | 'SUPERVISOR' | 'SALES';

const ALL_BU_OPTIONS = [
  { id: 'CENTRAL', label: 'Central Department Store' },
  { id: 'CDS', label: 'Central Direct Sales' },
  { id: 'CENTRAL_BEAUTY_CLUB', label: 'Central Beauty Club' },
  { id: 'MUJI', label: 'MUJI Retail' },
  { id: 'SSP', label: 'SuperSports (SSP)' },
  { id: 'B2S', label: 'B2S Book & Stationery' },
];

const ROLE_CONFIG: Record<
  UserRole,
  {
    label: string;
    description: string;
    icon: React.ReactNode;
    badgeClass: string;
    cardClass: string;
    accentColor: string;
  }
> = {
  SYSADMIN: {
    label: 'System Admin',
    description: 'Full system access & configuration',
    icon: <Crown size={12} />,
    badgeClass:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    cardClass: 'border-amber-500/20 bg-amber-500/5',
    accentColor: 'text-amber-600 dark:text-amber-400',
  },
  ADMIN: {
    label: 'CRM Admin',
    description: 'CRM management & user admin',
    icon: <ShieldAlert size={12} />,
    badgeClass:
      'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
    cardClass: 'border-rose-500/20 bg-rose-500/5',
    accentColor: 'text-rose-600 dark:text-rose-400',
  },
  SUPERVISOR: {
    label: 'Supervisor',
    description: 'Team oversight & reporting',
    icon: <ShieldCheck size={12} />,
    badgeClass:
      'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
    cardClass: 'border-purple-500/20 bg-purple-500/5',
    accentColor: 'text-purple-600 dark:text-purple-400',
  },
  SALES: {
    label: 'Sales',
    description: 'CRM & sales pipeline access',
    icon: <Briefcase size={12} />,
    badgeClass:
      'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
    cardClass: 'border-blue-500/20 bg-blue-500/5',
    accentColor: 'text-blue-600 dark:text-blue-400',
  },
};

export interface UserManagementViewProps {
  selectedBu?: string;
  onBuChange?: (bu: string) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  selectedBu = 'ALL',
}) => {
  const [users, setUsers] = useState<UserWithoutHash[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [selectedBuFilter, setSelectedBuFilter] = useState<string>(selectedBu || 'ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserWithoutHash | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserWithoutHash | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserWithoutHash | null>(null);

  // Form states for Add/Edit
  const [formData, setFormData] = useState<{
    username: string;
    name: string;
    email: string;
    role: UserRole;
    businessUnits: string[];
    password: string;
  }>({
    username: '',
    name: '',
    email: '',
    role: 'SALES',
    businessUnits: ['CENTRAL'],
    password: '',
  });

  const [newPasswordValue, setNewPasswordValue] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          setUsers(data.users);
        }
      } else {
        setErrorMessage('Failed to fetch user accounts');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error connecting to user service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Update internal BU filter if parent BU prop changes
  useEffect(() => {
    if (selectedBu && selectedBu !== 'ALL') {
      setSelectedBuFilter(selectedBu);
    }
  }, [selectedBu]);

  // Statistics calculation
  const stats = useMemo(() => {
    return {
      total: users.length,
      sysadminCount: users.filter((u) => u.role === 'SYSADMIN').length,
      adminCount: users.filter((u) => u.role === 'ADMIN').length,
      supervisorCount: users.filter((u) => u.role === 'SUPERVISOR').length,
      salesCount: users.filter((u) => u.role === 'SALES').length,
      onlineCount: users.filter((u) => u.presence === 'ONLINE').length,
    };
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (selectedRoleFilter !== 'ALL' && user.role !== selectedRoleFilter) return false;
      if (
        selectedBuFilter !== 'ALL' &&
        !user.businessUnits?.some((b) => b.toUpperCase() === selectedBuFilter.toUpperCase())
      )
        return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          user.name.toLowerCase().includes(q) ||
          user.username.toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, selectedRoleFilter, selectedBuFilter, searchQuery]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormData({
      username: '',
      name: '',
      email: '',
      role: 'SALES',
      businessUnits: selectedBuFilter !== 'ALL' ? [selectedBuFilter] : ['CENTRAL'],
      password: '',
    });
    setErrorMessage(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (user: UserWithoutHash) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      businessUnits: user.businessUnits || ['CENTRAL'],
      password: '',
    });
    setErrorMessage(null);
  };

  // Open Reset Password Modal
  const handleOpenResetPasswordModal = (user: UserWithoutHash) => {
    setResetPasswordUser(user);
    setNewPasswordValue('Password@2026!');
    setShowPassword(false);
    setErrorMessage(null);
  };

  // Open Delete Confirmation Modal
  const handleOpenDeleteModal = (user: UserWithoutHash) => {
    setDeletingUser(user);
    setErrorMessage(null);
  };

  // Toggle BU in Form
  const handleToggleBu = (buId: string) => {
    setFormData((prev) => {
      const exists = prev.businessUnits.includes(buId);
      let updated: string[];
      if (exists) {
        updated = prev.businessUnits.filter((id) => id !== buId);
        if (updated.length === 0) updated = ['CENTRAL'];
      } else {
        updated = [...prev.businessUnits, buId];
      }
      return { ...prev, businessUnits: updated };
    });
  };

  // Handle Add Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFormSubmitting(true);
      setErrorMessage(null);

      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create user');
      }

      showToast(`User ${data.user.username} created successfully!`);
      setIsAddModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating user');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setFormSubmitting(true);
      setErrorMessage(null);

      const res = await fetch(`/api/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          username: formData.username,
          role: formData.role,
          businessUnits: formData.businessUnits,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update user');
      }

      showToast(`User ${data.user.username} updated successfully!`);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating user');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Reset Password Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;

    try {
      setFormSubmitting(true);
      setErrorMessage(null);

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'ADMIN',
        },
        body: JSON.stringify({
          targetUsername: resetPasswordUser.username,
          newPassword: newPasswordValue,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reset password');
      }

      showToast(`Password for ${resetPasswordUser.username} has been reset.`);
      setResetPasswordUser(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error resetting password');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Delete User Submit
  const handleDeleteSubmit = async () => {
    if (!deletingUser) return;

    try {
      setFormSubmitting(true);
      setErrorMessage(null);

      const res = await fetch(`/api/auth/users/${deletingUser.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete user');
      }

      showToast(`User account deleted.`);
      setDeletingUser(null);
      fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error deleting user');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Helper for Role Badges
  const renderRoleBadge = (role: string) => {
    const cfg = ROLE_CONFIG[role as UserRole];
    if (!cfg) return <span className="text-xs text-muted-foreground">{role}</span>;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.badgeClass}`}
      >
        {cfg.icon}
        {cfg.label}
      </span>
    );
  };

  // Role picker used in both Add/Edit modals
  const RolePicker = () => (
    <div className="grid grid-cols-2 gap-2">
      {(Object.keys(ROLE_CONFIG) as UserRole[]).map((r) => {
        const cfg = ROLE_CONFIG[r];
        const isSelected = formData.role === r;
        return (
          <button
            type="button"
            key={r}
            onClick={() => setFormData({ ...formData, role: r })}
            className={`flex items-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-left ${
              isSelected
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                : 'bg-card text-muted-foreground border-border hover:border-violet-500/50 hover:bg-muted/40'
            }`}
          >
            <span className={isSelected ? 'text-white' : cfg.accentColor}>{cfg.icon}</span>
            <div>
              <div>{cfg.label}</div>
              {isSelected && (
                <div className="text-[10px] text-white/70 font-normal">{cfg.description}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden relative">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg animate-in fade-in duration-200 text-sm font-medium">
          <CheckCircle2 size={18} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="p-6 border-b border-border bg-card/60 backdrop-blur-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-violet-600/10 text-violet-600 flex items-center justify-center border border-violet-500/20">
                <Users size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  User Management &amp; Access Control
                </h1>
                <p className="text-xs text-muted-foreground">
                  Manage team accounts, assign roles, and configure business unit permissions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchUsers}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors cursor-pointer"
              title="Refresh users list"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-xs shadow-violet-500/20 cursor-pointer"
            >
              <UserPlus size={15} />
              <span>Add New User</span>
            </button>
          </div>
        </div>

        {/* Stats Grid — 5 cards for 4 roles + total */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
          {/* Total */}
          <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs col-span-1">
            <div className="text-xs text-muted-foreground font-medium">Total Accounts</div>
            <div className="text-2xl font-bold text-foreground mt-0.5">{stats.total}</div>
          </div>

          {/* Sysadmin */}
          <div className={`p-3.5 rounded-xl border shadow-2xs ${ROLE_CONFIG.SYSADMIN.cardClass}`}>
            <div className={`text-xs font-medium flex items-center gap-1 ${ROLE_CONFIG.SYSADMIN.accentColor}`}>
              <Crown size={13} />
              Sys Admins
            </div>
            <div className="text-2xl font-bold text-foreground mt-0.5">{stats.sysadminCount}</div>
          </div>

          {/* Admin */}
          <div className={`p-3.5 rounded-xl border shadow-2xs ${ROLE_CONFIG.ADMIN.cardClass}`}>
            <div className={`text-xs font-medium flex items-center gap-1 ${ROLE_CONFIG.ADMIN.accentColor}`}>
              <ShieldAlert size={13} />
              CRM Admins
            </div>
            <div className="text-2xl font-bold text-foreground mt-0.5">{stats.adminCount}</div>
          </div>

          {/* Supervisor */}
          <div className={`p-3.5 rounded-xl border shadow-2xs ${ROLE_CONFIG.SUPERVISOR.cardClass}`}>
            <div className={`text-xs font-medium flex items-center gap-1 ${ROLE_CONFIG.SUPERVISOR.accentColor}`}>
              <ShieldCheck size={13} />
              Supervisors
            </div>
            <div className="text-2xl font-bold text-foreground mt-0.5">{stats.supervisorCount}</div>
          </div>

          {/* Sales */}
          <div className={`p-3.5 rounded-xl border shadow-2xs ${ROLE_CONFIG.SALES.cardClass}`}>
            <div className={`text-xs font-medium flex items-center gap-1 ${ROLE_CONFIG.SALES.accentColor}`}>
              <Briefcase size={13} />
              Sales Agents
            </div>
            <div className="text-2xl font-bold text-foreground mt-0.5">{stats.salesCount}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 border-b border-border bg-card/40 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, username, email..."
            className="w-full pl-9 pr-8 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield size={13} />
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="ALL">All Roles</option>
              <option value="SYSADMIN">System Admin</option>
              <option value="ADMIN">CRM Admin</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="SALES">Sales</option>
            </select>
          </div>

          {/* BU Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building size={13} />
            <select
              value={selectedBuFilter}
              onChange={(e) => setSelectedBuFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="ALL">All Business Units</option>
              {ALL_BU_OPTIONS.map((bu) => (
                <option key={bu.id} value={bu.id}>
                  {bu.id} ({bu.label})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
            <RefreshCw size={24} className="animate-spin text-violet-600 mb-2" />
            <span className="text-xs">Loading user directory...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-card/30 rounded-2xl border border-dashed border-border p-6 text-center">
            <Users size={32} className="text-muted-foreground/60 mb-2" />
            <h3 className="text-sm font-semibold text-foreground">No user accounts found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Try adjusting your search query or role filter, or create a new user account.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              Add User
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Business Units</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredUsers.map((user) => {
                  const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
                  const roleCfg = ROLE_CONFIG[user.role as UserRole];

                  return (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full font-bold flex items-center justify-center border text-xs shrink-0 ${
                              roleCfg
                                ? roleCfg.badgeClass
                                : 'bg-violet-600/15 text-violet-600 border-violet-500/20'
                            }`}
                          >
                            {initial}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground text-xs">{user.name}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-muted-foreground">
                        <span className="font-mono text-xs">{user.email}</span>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">{renderRoleBadge(user.role)}</td>

                      {/* Business Units */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {user.businessUnits && user.businessUnits.length > 0 ? (
                            user.businessUnits.map((bu) => (
                              <span
                                key={bu}
                                className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono font-medium text-muted-foreground border border-border"
                              >
                                {bu}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">Global</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              user.presence === 'ONLINE' ? 'bg-emerald-500' : 'bg-zinc-400'
                            }`}
                          />
                          <span className="text-xs font-medium text-foreground">
                            {user.presence === 'ONLINE' ? 'Active' : 'Offline'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenResetPasswordModal(user)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Reset password"
                          >
                            <KeyRound size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(user)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Edit user details"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(user)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete user"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ADD USER MODAL */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-600">
                  <UserPlus size={18} />
                </div>
                <h2 className="text-sm font-bold text-foreground">Add New User Account</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-5 overflow-y-auto space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. john_doe"
                    className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-1 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-1 focus:ring-violet-500 focus:outline-none"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. john@central.co.th"
                    className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-1 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Initial Password
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Default: Password@2026! (Min 6 chars)"
                    className="w-full pl-9 pr-9 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-1 focus:ring-violet-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  If left blank, default is{' '}
                  <code className="font-mono text-violet-600">Password@2026!</code>
                </p>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  System Role <span className="text-rose-500">*</span>
                </label>
                <RolePicker />
              </div>

              {/* Business Units */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Authorized Business Units (BU Scope)
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {ALL_BU_OPTIONS.map((bu) => {
                    const isChecked = formData.businessUnits.includes(bu.id);
                    return (
                      <div
                        key={bu.id}
                        onClick={() => handleToggleBu(bu.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer select-none transition-colors ${
                          isChecked
                            ? 'bg-violet-500/10 border-violet-500/40 text-foreground font-medium'
                            : 'bg-background border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center text-white text-[10px] ${
                            isChecked ? 'bg-violet-600' : 'border border-border bg-card'
                          }`}
                        >
                          {isChecked && <Check size={12} />}
                        </div>
                        <span className="truncate">{bu.id}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT USER MODAL */}
      {/* ========================================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-600">
                  <Edit2 size={18} />
                </div>
                <h2 className="text-sm font-bold text-foreground">
                  Edit User Profile ({editingUser.username})
                </h2>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 overflow-y-auto space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-1 focus:ring-violet-500 focus:outline-none font-mono"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-1 focus:ring-violet-500 focus:outline-none"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-1 focus:ring-violet-500 focus:outline-none font-mono"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">Role</label>
                <RolePicker />
              </div>

              {/* Business Units */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Authorized Business Units (BU Scope)
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {ALL_BU_OPTIONS.map((bu) => {
                    const isChecked = formData.businessUnits.includes(bu.id);
                    return (
                      <div
                        key={bu.id}
                        onClick={() => handleToggleBu(bu.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer select-none transition-colors ${
                          isChecked
                            ? 'bg-violet-500/10 border-violet-500/40 text-foreground font-medium'
                            : 'bg-background border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center text-white text-[10px] ${
                            isChecked ? 'bg-violet-600' : 'border border-border bg-card'
                          }`}
                        >
                          {isChecked && <Check size={12} />}
                        </div>
                        <span className="truncate">{bu.id}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RESET PASSWORD MODAL */}
      {/* ========================================================================= */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                  <KeyRound size={18} />
                </div>
                <h2 className="text-sm font-bold text-foreground">Reset Password</h2>
              </div>
              <button
                onClick={() => setResetPasswordUser(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-5 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
                <div className="text-muted-foreground">Target Account:</div>
                <div className="font-semibold text-foreground">
                  {resetPasswordUser.name} (@{resetPasswordUser.username})
                </div>
                <div className="text-muted-foreground font-mono text-[11px]">
                  {resetPasswordUser.email}
                </div>
                <div className="mt-1">{renderRoleBadge(resetPasswordUser.role)}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    placeholder="Enter new password (min 6 chars)"
                    className="w-full pl-9 pr-9 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:ring-1 focus:ring-violet-500 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Updating...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 shrink-0">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Confirm Account Deletion</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Are you sure you want to permanently delete user account{' '}
                  <strong className="text-foreground">@{deletingUser.username}</strong> (
                  {deletingUser.name})? This action cannot be undone.
                </p>
                {errorMessage && (
                  <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                    {errorMessage}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-muted/30 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={formSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {formSubmitting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};