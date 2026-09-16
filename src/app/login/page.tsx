'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Briefcase,
  Users,
  Shield,
  Key
} from 'lucide-react';

const PRESET_ACCOUNTS = [
  {
    roleName: 'System Admin',
    roleTag: 'ADMIN',
    username: 'sysadmin',
    password: 'SysAdmin@2026!',
    desc: 'Full system & infrastructure access',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    icon: Shield,
  },
  {
    roleName: 'CRM Admin',
    roleTag: 'ADMIN',
    username: 'admin',
    password: 'Admin@2026!',
    desc: 'CRM boards, pipelines & settings',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    icon: ShieldCheck,
  },
  {
    roleName: 'Sales Manager',
    roleTag: 'SUPERVISOR',
    username: 'manager',
    password: 'Manager@2026!',
    desc: 'Team supervisor & analytics',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: Users,
  },
  {
    roleName: 'Sales Agent',
    roleTag: 'AGENT',
    username: 'sales',
    password: 'Sales@2026!',
    desc: 'Deals, customer chats & orders',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: Briefcase,
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setErrorMessage('Please enter both username/email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const res = await login(identifier, password);
    if (res.success) {
      setSuccessMessage('Authentication verified. Launching CRM...');
      setTimeout(() => {
        router.push(redirectUrl);
      }, 500);
    } else {
      setErrorMessage(res.error || 'Invalid credentials. Please verify your password.');
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (preset: typeof PRESET_ACCOUNTS[0]) => {
    setIdentifier(preset.username);
    setPassword(preset.password);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4 relative overflow-hidden transition-colors">
      {/* Subtle Background Glows matching Cruip Artifact */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/25 mb-3.5 text-white font-black text-2xl">
            V
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            VCRMX <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-600 font-semibold border border-violet-500/25">Enterprise CRM</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Omnichannel Social Commerce & Sales Pipeline OS
          </p>
        </div>

        {/* Error / Success Feedback */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
            <AlertCircle size={16} className="shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Username or Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                <User size={16} />
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="sysadmin, admin, manager, sales"
                className="w-full bg-background border border-border focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-foreground placeholder-muted-foreground/60 rounded-xl pl-10 pr-3.5 py-2.5 text-sm transition-all outline-none"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-foreground">
                Password
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter account password"
                className="w-full bg-background border border-border focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-foreground placeholder-muted-foreground/60 rounded-xl pl-10 pr-10 py-2.5 text-sm transition-all outline-none font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 px-4 rounded-xl text-sm shadow-md shadow-violet-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2 active:scale-[0.99]"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <span>Sign In to VCRMX</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Quick Role Selection Presets */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Key size={12} className="text-violet-500" />
              Quick Fill Credentials
            </span>
            <span className="text-[10px] text-muted-foreground/70">Click to load</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PRESET_ACCOUNTS.map((preset) => {
              const IconComp = preset.icon;
              const isSelected = identifier === preset.username;
              return (
                <button
                  key={preset.username}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-accent border-violet-500/60 ring-1 ring-violet-500/40 shadow-xs'
                      : 'bg-background hover:bg-accent/50 border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <IconComp size={13} className="text-muted-foreground" />
                      {preset.roleName}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${preset.badgeColor}`}>
                      {preset.roleTag}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    @{preset.username}
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                    {preset.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 text-center text-xs text-muted-foreground">
        VCRMX Enterprise &bull; Omnichannel CRM & Sales OS
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
