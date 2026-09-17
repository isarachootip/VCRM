'use client';

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  PieChart, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldCheck, 
  Sparkles, 
  Building2, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Filter, 
  Layers, 
  CreditCard, 
  Award,
  ChevronRight,
  Store,
  RefreshCw,
  Search
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

// Types for Dashboard Data
export interface CustomerTypeSegment {
  id: string;
  nameKey: string;
  nameTh: string;
  nameEn: string;
  count: number;
  percentage: number;
  color: string;
  gradient: string;
  totalRevenueThb: number;
  icon: string;
  description: string;
}

export interface MonthlyTrendData {
  month: string;
  customersCount: number;
  revenueThb: number;
  ordersCount: number;
}

export interface RecentOrderRecord {
  id: string;
  orderNumber: string;
  customerName: string;
  customerType: string;
  businessUnit: string;
  amount: number;
  status: 'PAID' | 'IN_FULFILLMENT' | 'PENDING' | 'DRAFT';
  channel: 'LINE' | 'FACEBOOK' | 'INSTAGRAM' | 'STORE';
  date: string;
}

export interface ExecutiveDashboardProps {
  selectedBu?: string;
  onBuChange?: (bu: string) => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  selectedBu: propBu,
  onBuChange,
}) => {
  const { t, language } = useLanguage();

  // Filters State
  const [internalBu, setInternalBu] = useState<string>('ALL');
  const selectedBu = propBu !== undefined ? propBu : internalBu;
  const handleBuChange = (newBu: string) => {
    setInternalBu(newBu);
    onBuChange?.(newBu);
  };
  const [selectedPeriod, setSelectedPeriod] = useState<'MTD' | 'YTD' | 'ALL'>('MTD');
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Currency Formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US').format(val);
  };

  // 1. DATA: Customer Segmentation (Requirement 1: วงกลม donut แยกประเภท)
  const customerSegments: CustomerTypeSegment[] = [
    {
      id: 'enterprise_vip',
      nameKey: 'segment_enterprise_vip',
      nameTh: 'ลูกค้าองค์กร & VIP (Enterprise)',
      nameEn: 'Enterprise & VIP Accounts',
      count: 542,
      percentage: 19.05,
      color: '#8b5cf6', // Violet
      gradient: 'from-violet-500 to-purple-600',
      totalRevenueThb: 18450000,
      icon: '👑',
      description: 'บัญชีลูกค้ารายใหญ่และองค์กรธุรกิจมูลค่าสัญญา > ฿1M',
    },
    {
      id: 'corporate_sme',
      nameKey: 'segment_corporate_sme',
      nameTh: 'ลูกค้าธุรกิจ & SME (Corporate)',
      nameEn: 'Corporate & SME Businesses',
      count: 825,
      percentage: 29.00,
      color: '#3b82f6', // Blue
      gradient: 'from-blue-500 to-indigo-600',
      totalRevenueThb: 15620000,
      icon: '🏢',
      description: 'บริษัทขนาดกลางและขนาดย่อม และลูกค้าพาณิชย์ B2B',
    },
    {
      id: 'retail_the1',
      nameKey: 'segment_retail_the1',
      nameTh: 'ลูกค้ารายย่อย & สมาชิก The 1 (Retail)',
      nameEn: 'Retail & The 1 Members',
      count: 986,
      percentage: 34.66,
      color: '#10b981', // Emerald
      gradient: 'from-emerald-500 to-teal-600',
      totalRevenueThb: 10150000,
      icon: '🛍️',
      description: 'สมาชิกระดับ The 1 Classic / Exclusive และลูกค้าสาขา',
    },
    {
      id: 'online_omni',
      nameKey: 'segment_online_omni',
      nameTh: 'ลูกค้าออนไลน์ & Social Commerce',
      nameEn: 'Online & Omni Shoppers',
      count: 492,
      percentage: 17.29,
      color: '#ff7a59', // VCRM Orange
      gradient: 'from-orange-500 to-amber-500',
      totalRevenueThb: 4700000,
      icon: '💬',
      description: 'ลูกค้าผ่านช่องทาง LINE Official, Facebook, Instagram',
    },
  ];

  // Total Customers
  const totalCustomersCount = customerSegments.reduce((sum, s) => sum + s.count, 0); // 2,845

  // 2. DATA: Customer Acquisition MTD & YTD (Requirement 2)
  const customerGrowth = {
    mtdCount: 342,
    mtdGrowthPercent: 14.8,
    mtdTarget: 400,
    mtdTargetPercent: Math.round((342 / 400) * 100),
    ytdCount: 2180,
    ytdGrowthPercent: 28.5,
    ytdTarget: 2500,
    ytdTargetPercent: Math.round((2180 / 2500) * 100),
  };

  // 3. DATA: Revenue Metrics (Requirement 3)
  const revenueMetrics = {
    totalRevenueThb: 48920000,
    mtdRevenueThb: 6450000,
    mtdRevenueGrowthPercent: 18.2,
    ytdRevenueThb: 48920000,
    ytdRevenueGrowthPercent: 24.6,
    avgOrderValueThb: 28375, // AOV
    pipelineValueThb: 32400000,
  };

  // 4. DATA: Orders Metrics (Requirement 4)
  const orderMetrics = {
    totalOrdersCount: 1724,
    mtdOrdersCount: 228,
    mtdOrdersGrowthPercent: 12.5,
    ytdOrdersCount: 1480,
    ytdOrdersGrowthPercent: 21.0,
    conversionRate: 74.2,
    statusBreakdown: [
      { status: 'PAID', labelTh: 'ชำระแล้ว / เสร็จสิ้น', labelEn: 'Completed / Paid', count: 1248, percent: 72.4, color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
      { status: 'IN_FULFILLMENT', labelTh: 'กำลังจัดส่ง / บริการ', labelEn: 'In Fulfillment', count: 184, percent: 10.7, color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
      { status: 'PENDING', labelTh: 'รอชำระเงิน / ยืนยัน', labelEn: 'Pending Payment', count: 196, percent: 11.4, color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
      { status: 'DRAFT', labelTh: 'แบบร่าง / เจรจา', labelEn: 'Draft / In Review', count: 96, percent: 5.5, color: 'bg-slate-400', text: 'text-slate-700', bg: 'bg-slate-100' },
    ],
  };

  // Monthly Trend Data for 2026
  const monthlyTrends: MonthlyTrendData[] = [
    { month: 'Jan', customersCount: 210, revenueThb: 4800000, ordersCount: 145 },
    { month: 'Feb', customersCount: 235, revenueThb: 5100000, ordersCount: 160 },
    { month: 'Mar', customersCount: 260, revenueThb: 5900000, ordersCount: 182 },
    { month: 'Apr', customersCount: 240, revenueThb: 5200000, ordersCount: 155 },
    { month: 'May', customersCount: 275, revenueThb: 6100000, ordersCount: 190 },
    { month: 'Jun', customersCount: 290, revenueThb: 6400000, ordersCount: 205 },
    { month: 'Jul', customersCount: 315, revenueThb: 6850000, ordersCount: 215 },
    { month: 'Aug', customersCount: 325, revenueThb: 7120000, ordersCount: 220 },
    { month: 'Sep (MTD)', customersCount: 342, revenueThb: 6450000, ordersCount: 228 },
  ];

  // Business Unit Revenue Distribution
  const buRevenues = [
    { bu: 'MUJI', name: 'Muji Thailand', revenue: 8200000, share: 16.8, color: '#ef4444' },
    { bu: 'SSP', name: 'SuperSports Outlet', revenue: 5820000, share: 11.9, color: '#10b981' },
    { bu: 'B2S', name: 'B2S Books & Stationery', revenue: 4000000, share: 8.2, color: '#8b5cf6' },
  ];

  // Recent High-Value Orders Table Data
  const recentOrders: RecentOrderRecord[] = [
    {
      id: 'ord-101',
      orderNumber: 'QT-2026-0892',
      customerName: 'Siam Paragon Enterprise Retail Group',
      customerType: 'Enterprise & VIP',
      businessUnit: 'Muji',
      amount: 1250000,
      status: 'PAID',
      channel: 'STORE',
      date: '2026-09-14 15:20',
    },
    {
      id: 'ord-102',
      orderNumber: 'QT-2026-0891',
      customerName: 'Bangkok Tech Park Co., Ltd.',
      customerType: 'Corporate & SME',
      businessUnit: 'SSP',
      amount: 850000,
      status: 'PAID',
      channel: 'LINE',
      date: '2026-09-14 14:05',
    },
    {
      id: 'ord-103',
      orderNumber: 'QT-2026-0890',
      customerName: 'ดร. กานดา อรุณรัศมี (The 1 Exclusive)',
      customerType: 'Retail & The 1',
      businessUnit: 'Muji',
      amount: 145000,
      status: 'IN_FULFILLMENT',
      channel: 'LINE',
      date: '2026-09-14 11:30',
    },
    {
      id: 'ord-104',
      orderNumber: 'QT-2026-0889',
      customerName: 'คุณวรปรัชญ์ เกียรติไพศาล',
      customerType: 'Enterprise & VIP',
      businessUnit: 'B2S',
      amount: 480000,
      status: 'PENDING',
      channel: 'FACEBOOK',
      date: '2026-09-14 09:45',
    },
    {
      id: 'ord-105',
      orderNumber: 'QT-2026-0888',
      customerName: 'Thai Express Logistics & Fleet',
      customerType: 'Corporate & SME',
      businessUnit: 'SuperSports',
      amount: 320000,
      status: 'PAID',
      channel: 'STORE',
      date: '2026-09-13 16:10',
    },
  ];

  // Donut SVG Math Constants
  const radius = 70;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * radius; // ~439.82

  // Compute Donut Slices offset
  const donutSlices = useMemo(() => {
    let accumulatedPercent = 0;
    return customerSegments.map((segment) => {
      const sliceLength = (segment.percentage / 100) * circumference;
      const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
      accumulatedPercent += segment.percentage;

      return {
        ...segment,
        strokeDasharray: `${sliceLength} ${circumference - sliceLength}`,
        strokeDashoffset,
      };
    });
  }, [customerSegments, circumference]);

  // Active slice for center display or details
  const activeSegment = hoveredSlice 
    ? customerSegments.find((s) => s.id === hoveredSlice) || customerSegments[0]
    : null;

  // Filtered orders
  const filteredOrders = recentOrders.filter((ord) => {
    const matchesSearch = !searchQuery || (
      ord.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.customerType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.businessUnit.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const matchesBu = selectedBu === 'ALL' || (
      (selectedBu === 'MUJI' && ord.businessUnit.includes('Muji')) ||
      (selectedBu === 'SSP' && ord.businessUnit.includes('SuperSports')) ||
      (selectedBu === 'B2S' && ord.businessUnit.includes('B2S')) ||
      ord.businessUnit.toUpperCase().includes(selectedBu.toUpperCase())
    );

    return matchesSearch && matchesBu;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto font-sans antialiased text-foreground select-none transition-colors">
      {/* 1. Header Toolbar */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-violet-500/20">
            <PieChart size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>{language === 'th' ? 'แดชบอร์ดภาพรวมการบริหารลูกค้าและยอดขาย' : t('dashboard_overview')}</span>
              <span className="text-[10px] bg-violet-500/10 text-violet-600 font-semibold px-2 py-0.5 rounded-full border border-violet-500/20">
                VCRMX 2026
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">
              {language === 'th' 
                ? 'สรุปสถิติ 4 มิติหลัก: จำนวนลูกค้า, ลูกค้า MTD/YTD, รายได้รวม และคำสั่งซื้อ (Orders)' 
                : 'Executive summary covering 4 core pillars: Total Customers, MTD/YTD Acquisition, Revenue, and Orders.'}
            </p>
          </div>
        </div>

        {/* Controls: BU Filter & Time Window */}
        <div className="flex items-center gap-2.5">
          {/* BU Scope Selector */}
          <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-lg border border-border text-xs font-medium">
            <Building2 size={13} className="text-muted-foreground" />
            <span className="text-muted-foreground">BU:</span>
            <select
              value={selectedBu}
              onChange={(e) => handleBuChange(e.target.value)}
              className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL" className="bg-card text-foreground">All BUs (ทุกกลุ่มธุรกิจ)</option>
              <option value="MUJI" className="bg-card text-foreground">Muji Thailand</option>
              <option value="SSP" className="bg-card text-foreground">SuperSports</option>
              <option value="B2S" className="bg-card text-foreground">B2S</option>
            </select>
          </div>

          {/* Time Window Switcher */}
          <div className="flex items-center bg-muted/40 p-1 rounded-lg border border-border text-xs font-medium">
            <button
              onClick={() => setSelectedPeriod('MTD')}
              className={`px-3 py-1 rounded-md transition-all ${
                selectedPeriod === 'MTD'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              MTD (เดือนนี้)
            </button>
            <button
              onClick={() => setSelectedPeriod('YTD')}
              className={`px-3 py-1 rounded-md transition-all ${
                selectedPeriod === 'YTD'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              YTD (ปีนี้)
            </button>
            <button
              onClick={() => setSelectedPeriod('ALL')}
              className={`px-3 py-1 rounded-md transition-all ${
                selectedPeriod === 'ALL'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Time
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* ========================================================================= */}
        {/* SECTION 1: TOP 4 KEY EXECUTIVE CARDS (Artifact 2xl Cards) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CARD 1: 1. จำนวนลูกค้าทั้งหมด */}
          <div className="bg-card rounded-2xl p-5 border border-border shadow-xs hover:shadow-card transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-bl-full pointer-events-none transition-transform group-hover:scale-110"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users size={14} className="text-violet-500" />
                1. {language === 'th' ? 'จำนวนลูกค้าทั้งหมด' : t('total_customers')}
              </span>
              <span className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-xs border border-violet-500/20">
                4 กลุ่ม
              </span>
            </div>
            <div className="text-3xl font-black text-foreground tracking-tight">
              {formatNumber(totalCustomersCount)}{' '}
              <span className="text-sm font-semibold text-muted-foreground">{language === 'th' ? 'ราย' : 'customers'}</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <ArrowUpRight size={13} />
                +14.8% MTD
              </span>
              <span className="text-muted-foreground font-medium">
                {language === 'th' ? 'แบ่งเป็น 4 ประเภทหลัก' : 'in 4 categories'}
              </span>
            </div>
          </div>

          {/* CARD 2: 2. จำนวนลูกค้า MTD, YTD */}
          <div className="bg-card rounded-2xl p-5 border border-border shadow-xs hover:shadow-card transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full pointer-events-none transition-transform group-hover:scale-110"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-500" />
                2. {language === 'th' ? 'ลูกค้า MTD & YTD' : 'Customers MTD / YTD'}
              </span>
              <span className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                MTD
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[11px] text-muted-foreground font-medium block uppercase">Month to Date</span>
                <span className="text-2xl font-black text-foreground">{formatNumber(customerGrowth.mtdCount)}</span>
                <span className="text-xs text-muted-foreground ml-1">ราย</span>
              </div>
              <div className="text-right border-l border-border pl-3">
                <span className="text-[11px] text-muted-foreground font-medium block uppercase">Year to Date</span>
                <span className="text-2xl font-black text-violet-600 dark:text-violet-400">{formatNumber(customerGrowth.ytdCount)}</span>
                <span className="text-xs text-muted-foreground ml-1">ราย</span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-0.5 text-violet-600 dark:text-violet-400 font-semibold bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                <TrendingUp size={13} />
                {customerGrowth.ytdTargetPercent}% {language === 'th' ? 'ของเป้าหมายปี' : 'of annual goal'}
              </span>
            </div>
          </div>

          {/* CARD 3: 3. จำนวนรายได้ (Revenue) */}
          <div className="bg-card rounded-2xl p-5 border border-border shadow-xs hover:shadow-card transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none transition-transform group-hover:scale-110"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <DollarSign size={14} className="text-emerald-500" />
                3. {language === 'th' ? 'จำนวนรายได้ (Revenue)' : t('total_revenue')}
              </span>
              <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/20">
                ฿
              </span>
            </div>
            <div className="text-2xl font-black text-foreground tracking-tight">
              {formatCurrency(revenueMetrics.totalRevenueThb)}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                MTD: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(revenueMetrics.mtdRevenueThb)}</strong>
              </span>
              <span className="text-muted-foreground font-medium">
                AOV: <strong className="text-foreground">{formatCurrency(revenueMetrics.avgOrderValueThb)}</strong>
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-1 text-xs">
              <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <ArrowUpRight size={13} />
                +{revenueMetrics.mtdRevenueGrowthPercent}% MTD Growth
              </span>
            </div>
          </div>

          {/* CARD 4: 4. จำนวน Order */}
          <div className="bg-card rounded-2xl p-5 border border-border shadow-xs hover:shadow-card transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-bl-full pointer-events-none transition-transform group-hover:scale-110"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShoppingBag size={14} className="text-violet-500" />
                4. {language === 'th' ? 'จำนวน Order ทั้งหมด' : t('total_orders')}
              </span>
              <span className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-xs border border-violet-500/20">
                Order
              </span>
            </div>
            <div className="text-3xl font-black text-foreground tracking-tight">
              {formatNumber(orderMetrics.totalOrdersCount)}{' '}
              <span className="text-sm font-semibold text-muted-foreground">{language === 'th' ? 'ออเดอร์' : 'orders'}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                MTD: <strong className="text-foreground">{formatNumber(orderMetrics.mtdOrdersCount)}</strong>
              </span>
              <span>
                YTD: <strong className="text-foreground">{formatNumber(orderMetrics.ytdOrdersCount)}</strong>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                Win {orderMetrics.conversionRate}%
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-1 text-xs">
              <span className="inline-flex items-center gap-0.5 text-violet-600 dark:text-violet-400 font-semibold bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={13} />
                {orderMetrics.statusBreakdown[0].count} {language === 'th' ? 'ชำระเสร็จสิ้น' : 'Paid'}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: DONUT CHART & ACQUISITION TREND */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Donut Chart (7 Cols) */}
          <div className="lg:col-span-7 bg-card rounded-2xl p-6 border border-border shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <PieChart size={18} className="text-violet-500" />
                  <span>1. {language === 'th' ? 'สัดส่วนจำนวนลูกค้าแยกตามประเภท (Donut Chart)' : t('customers_by_category')}</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === 'th' 
                    ? `จำแนกฐานลูกค้าทั้งหมด ${formatNumber(totalCustomersCount)} ราย ออกเป็น 4 กลุ่มธุรกิจหลัก` 
                    : `Distribution of all ${formatNumber(totalCustomersCount)} customers across 4 key segments`}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                100% สัดส่วน
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center flex-1">
              {/* Donut Chart SVG (5 Cols) */}
              <div className="sm:col-span-5 flex flex-col items-center justify-center relative py-4">
                <div className="relative w-52 h-52 flex items-center justify-center">
                  <svg className="w-52 h-52 -rotate-90 transform" viewBox="0 0 200 200">
                    {/* Background Circle */}
                    <circle
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="transparent"
                      stroke="currentColor"
                      className="text-muted/30"
                      strokeWidth={strokeWidth}
                    />

                    {/* Donut Slices */}
                    {donutSlices.map((slice) => {
                      const isHovered = hoveredSlice === slice.id;
                      return (
                        <circle
                          key={slice.id}
                          cx="100"
                          cy="100"
                          r={radius}
                          fill="transparent"
                          stroke={slice.color}
                          strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                          strokeDasharray={slice.strokeDasharray}
                          strokeDashoffset={slice.strokeDashoffset}
                          strokeLinecap="butt"
                          className="transition-all duration-300 cursor-pointer"
                          onMouseEnter={() => setHoveredSlice(slice.id)}
                          onMouseLeave={() => setHoveredSlice(null)}
                          style={{
                            filter: isHovered ? `drop-shadow(0px 0px 8px ${slice.color}80)` : 'none',
                          }}
                        />
                      );
                    })}
                  </svg>

                  {/* Center Text inside Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                    {activeSegment ? (
                      <>
                        <span className="text-xl">{activeSegment.icon}</span>
                        <span className="text-lg font-black text-foreground leading-tight mt-0.5">
                          {formatNumber(activeSegment.count)}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {activeSegment.percentage.toFixed(1)}% สัดส่วน
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {language === 'th' ? 'ลูกค้าทั้งหมด' : 'Total'}
                        </span>
                        <span className="text-2xl font-black text-foreground tracking-tight leading-none mt-0.5">
                          {formatNumber(totalCustomersCount)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium mt-1">
                          {language === 'th' ? '4 ประเภทธุรกิจ' : '4 categories'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <span className="text-[11px] text-muted-foreground font-medium mt-2">
                  {language === 'th' ? '💡 นำเมาส์ชี้ที่วงกลมเพื่อดูรายละเอียด' : 'Hover over slices for details'}
                </span>
              </div>

              {/* Segment Legend & Breakdown Cards (7 Cols) */}
              <div className="sm:col-span-7 space-y-2.5">
                {customerSegments.map((seg) => {
                  const isHovered = hoveredSlice === seg.id;
                  return (
                    <div
                      key={seg.id}
                      onMouseEnter={() => setHoveredSlice(seg.id)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isHovered
                          ? 'border-violet-500/50 bg-violet-500/5 shadow-xs scale-[1.02]'
                          : 'border-border bg-card/60 hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{seg.icon}</span>
                          <span className="text-xs font-bold text-foreground">
                            {language === 'th' ? seg.nameTh : seg.nameEn}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-foreground">
                            {formatNumber(seg.count)} ราย
                          </span>
                          <span 
                            className="text-[11px] font-bold px-1.5 py-0.2 rounded text-white"
                            style={{ backgroundColor: seg.color }}
                          >
                            {seg.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden my-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${seg.percentage}%`,
                            backgroundColor: seg.color,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="truncate pr-2">{seg.description}</span>
                        <span className="font-semibold text-foreground shrink-0">
                          {formatCurrency(seg.totalRevenueThb)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Growth & Milestones (5 Cols) */}
          <div className="lg:col-span-5 bg-card rounded-2xl p-6 border border-border shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Calendar size={18} className="text-violet-500" />
                  <span>2. {language === 'th' ? 'อัตราเพิ่มลูกค้า MTD & YTD' : 'Customer Growth MTD & YTD'}</span>
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  Target 2026
                </span>
              </div>

              {/* Progress Milestones: MTD vs Target & YTD vs Target */}
              <div className="space-y-4">
                {/* MTD Milestone */}
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                      {language === 'th' ? 'ลูกค้าใหม่เดือนนี้ (Month to Date)' : 'New Customers MTD'}
                    </span>
                    <span className="font-black text-foreground">
                      {formatNumber(customerGrowth.mtdCount)} / {formatNumber(customerGrowth.mtdTarget)}{' '}
                      <span className="text-violet-600 dark:text-violet-400 font-bold">({customerGrowth.mtdTargetPercent}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="h-2.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
                      style={{ width: `${customerGrowth.mtdTargetPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                      <ArrowUpRight size={12} /> +{customerGrowth.mtdGrowthPercent}% vs เดือนก่อน
                    </span>
                    <span>เป้าหมายประจำเดือน: {customerGrowth.mtdTarget} ราย</span>
                  </div>
                </div>

                {/* YTD Milestone */}
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      {language === 'th' ? 'ลูกค้าใหม่สะสมปีนี้ (Year to Date)' : 'New Customers YTD'}
                    </span>
                    <span className="font-black text-foreground">
                      {formatNumber(customerGrowth.ytdCount)} / {formatNumber(customerGrowth.ytdTarget)}{' '}
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">({customerGrowth.ytdTargetPercent}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
                      style={{ width: `${customerGrowth.ytdTargetPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                      <ArrowUpRight size={12} /> +{customerGrowth.ytdGrowthPercent}% YoY
                    </span>
                    <span>เป้าหมายประจำปี 2026: {formatNumber(customerGrowth.ytdTarget)} ราย</span>
                  </div>
                </div>
              </div>

              {/* Monthly Acquisition Mini-Bars */}
              <div className="mt-4 pt-3 border-t border-border">
                <span className="text-xs font-bold text-foreground block mb-2">
                  {language === 'th' ? 'แนวโน้มการได้ลูกค้าใหม่รายเดือน (Jan - Sep 2026)' : 'Monthly Acquisition Trend'}
                </span>
                <div className="flex items-end justify-between gap-1 h-20 pt-2">
                  {monthlyTrends.map((trend, idx) => {
                    const heightPercent = Math.round((trend.customersCount / 400) * 100);
                    const isLatest = idx === monthlyTrends.length - 1;
                    return (
                      <div key={trend.month} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="w-full flex items-end justify-center h-14">
                          <div
                            className={`w-full max-w-[18px] rounded-t-md transition-all duration-300 ${
                              isLatest
                                ? 'bg-gradient-to-t from-violet-600 to-indigo-500 shadow-xs'
                                : 'bg-muted hover:bg-violet-500/40'
                            }`}
                            style={{ height: `${heightPercent}%` }}
                            title={`${trend.month}: ${trend.customersCount} customers`}
                          />
                        </div>
                        <span className={`text-[10px] font-semibold truncate ${isLatest ? 'text-violet-600 dark:text-violet-400 font-bold' : 'text-muted-foreground'}`}>
                          {trend.month.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: REVENUE & ORDERS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Revenue Breakdown (6 Cols) */}
          <div className="lg:col-span-6 bg-card rounded-2xl p-6 border border-border shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-500" />
                  <span>3. {language === 'th' ? 'จำนวนรายได้ (Revenue) & สัดส่วนกลุ่มธุรกิจ' : t('total_revenue')}</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === 'th' 
                    ? `รายได้สะสม YTD: ${formatCurrency(revenueMetrics.ytdRevenueThb)} | MTD: ${formatCurrency(revenueMetrics.mtdRevenueThb)}` 
                    : `Total YTD Revenue: ${formatCurrency(revenueMetrics.ytdRevenueThb)}`}
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                +18.2% MTD
              </span>
            </div>

            {/* Financial Summary Strip */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-muted/30 p-3 rounded-xl border border-border">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">รายได้ MTD</span>
                <span className="text-sm sm:text-base font-black text-foreground mt-0.5 block">
                  {formatCurrency(revenueMetrics.mtdRevenueThb)}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">+18.2% vs target</span>
              </div>

              <div className="bg-muted/30 p-3 rounded-xl border border-border">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">รายได้ YTD</span>
                <span className="text-sm sm:text-base font-black text-foreground mt-0.5 block">
                  {formatCurrency(revenueMetrics.ytdRevenueThb)}
                </span>
                <span className="text-[10px] text-violet-600 dark:text-violet-400 font-bold">88.9% ของเป้าปี</span>
              </div>

              <div className="bg-muted/30 p-3 rounded-xl border border-border">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">AOV (เฉลี่ย)</span>
                <span className="text-sm sm:text-base font-black text-foreground mt-0.5 block">
                  {formatCurrency(revenueMetrics.avgOrderValueThb)}
                </span>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">ต่อออเดอร์</span>
              </div>
            </div>

            {/* BU Revenue Breakdown List */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-foreground block">
                {language === 'th' ? 'สัดส่วนรายได้แยกตามกลุ่มธุรกิจ (Business Unit)' : 'Revenue by Business Unit'}
              </span>
              {buRevenues.map((bu) => (
                <div key={bu.bu} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-foreground font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bu.color }}></span>
                      {bu.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-bold">{formatCurrency(bu.revenue)}</span>
                      <span className="text-[11px] text-muted-foreground font-semibold w-10 text-right">{bu.share}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${bu.share}%`,
                        backgroundColor: bu.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Orders Breakdown (6 Cols) */}
          <div className="lg:col-span-6 bg-card rounded-2xl p-6 border border-border shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <ShoppingBag size={18} className="text-violet-500" />
                  <span>4. {language === 'th' ? 'จำนวน Order และสถานะคำสั่งซื้อ' : t('total_orders')}</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === 'th' 
                    ? `ยอดคำสั่งซื้อรวม: ${formatNumber(orderMetrics.totalOrdersCount)} ออเดอร์ (MTD: ${formatNumber(orderMetrics.mtdOrdersCount)} ออเดอร์)` 
                    : `Total Orders: ${formatNumber(orderMetrics.totalOrdersCount)}`}
                </p>
              </div>
              <span className="text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2.5 py-1 rounded-full border border-violet-500/20">
                Win Rate {orderMetrics.conversionRate}%
              </span>
            </div>

            {/* Orders Status Grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {orderMetrics.statusBreakdown.map((st) => (
                <div key={st.status} className={`p-3.5 rounded-xl border border-border bg-muted/30`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold ${st.text}`}>
                      {language === 'th' ? st.labelTh : st.labelEn}
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {st.percent}%
                    </span>
                  </div>
                  <div className="text-xl font-black text-foreground mt-0.5">
                    {formatNumber(st.count)}{' '}
                    <span className="text-xs font-normal text-muted-foreground">ออเดอร์</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mt-2">
                    <div 
                      className={`h-1.5 rounded-full ${st.color}`}
                      style={{ width: `${st.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Fulfillment & Conversion Summary */}
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    {language === 'th' ? 'ประสิทธิภาพการปิดการขาย (Conversion Rate)' : 'Order Conversion Efficiency'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {language === 'th' ? 'สัดส่วนชำระเสร็จสิ้น 72.4% สูงกว่าเป้าหมายที่ตั้งไว้' : 'Exceeding target benchmark of 70%'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">74.2%</span>
                <span className="text-[10px] text-muted-foreground block">Win Rate</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 4: RECENT HIGH-VALUE ORDERS TABLE */}
        {/* ========================================================================= */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileText size={18} className="text-violet-500" />
                <span>{language === 'th' ? 'รายการคำสั่งซื้อและข้อตกลงล่าสุด (Recent Orders & Deals)' : 'Recent Orders & Deals'}</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {language === 'th' 
                  ? 'รายการคำสั่งซื้อและใบเสนอราคาที่มีมูลค่าสูงที่มีการอัปเดตล่าสุดในระบบ' 
                  : 'Latest high-value order quotations and sales transactions'}
              </p>
            </div>

            {/* Table Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 text-muted-foreground pointer-events-none" size={13} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'th' ? 'ค้นหาเลขที่ออเดอร์, ลูกค้า, BU...' : 'Search orders, customers...'}
                className="bg-muted/40 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-60"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold bg-muted/30">
                  <th className="py-2.5 px-3">เลขที่ Order / Quotation</th>
                  <th className="py-2.5 px-3">ลูกค้า / องค์กร</th>
                  <th className="py-2.5 px-3">ประเภทลูกค้า</th>
                  <th className="py-2.5 px-3">กลุ่มธุรกิจ (BU)</th>
                  <th className="py-2.5 px-3 text-right">มูลค่า (บาท)</th>
                  <th className="py-2.5 px-3 text-center">สถานะ</th>
                  <th className="py-2.5 px-3">ช่องทาง</th>
                  <th className="py-2.5 px-3">วัน-เวลา</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-violet-600 dark:text-violet-400">
                      {ord.orderNumber}
                    </td>
                    <td className="py-3 px-3 font-bold text-foreground">
                      {ord.customerName}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
                        {ord.customerType}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground font-medium">
                      {ord.businessUnit}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatCurrency(ord.amount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          ord.status === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : ord.status === 'IN_FULFILLMENT'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                            : ord.status === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {ord.status === 'PAID' ? 'ชำระแล้ว' : ord.status === 'IN_FULFILLMENT' ? 'กำลังจัดส่ง' : ord.status === 'PENDING' ? 'รอชำระเงิน' : 'แบบร่าง'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                        {ord.channel}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground font-mono text-[11px]">
                      {ord.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
