'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  GraduationCap, 
  Maximize2, 
  Minimize2, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Clock, 
  Layers, 
  AlertTriangle, 
  Sparkles,
  ChevronDown,
  Workflow,
  FileText,
  ShieldCheck,
  Zap,
  Target
} from 'lucide-react';
import { MASTER_SOP_GUIDES, getSOPGuideForContext, SOPGuide } from '@/data/sopGuidesData';

export interface SOPGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab?: string;
  currentBoardId?: string;
}

export const SOPGuideModal: React.FC<SOPGuideModalProps> = ({
  isOpen,
  onClose,
  currentTab = 'dashboard',
  currentBoardId = 'board-5030723273',
}) => {
  const [selectedGuideId, setSelectedGuideId] = useState<string>('dashboard');
  const [isFullFlowOpen, setIsFullFlowOpen] = useState(false);
  const [showMermaidCode, setShowMermaidCode] = useState(false);

  // Sync initial guide when modal opens
  useEffect(() => {
    if (isOpen) {
      const guide = getSOPGuideForContext(currentTab, currentBoardId);
      setSelectedGuideId(guide.id);
      setIsFullFlowOpen(false);
    }
  }, [isOpen, currentTab, currentBoardId]);

  if (!isOpen) return null;

  const currentGuide = MASTER_SOP_GUIDES[selectedGuideId] || MASTER_SOP_GUIDES['dashboard'];
  const allGuideKeys = Object.keys(MASTER_SOP_GUIDES);
  const currentIndex = allGuideKeys.indexOf(selectedGuideId);

  const handleNext = () => {
    if (currentIndex < allGuideKeys.length - 1) {
      setSelectedGuideId(allGuideKeys[currentIndex + 1]);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedGuideId(allGuideKeys[currentIndex - 1]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fadeIn select-none">
      <div 
        className={`bg-card text-card-foreground border border-border rounded-2xl shadow-2xl flex flex-col w-full transition-all duration-300 ${
          isFullFlowOpen ? 'max-w-6xl h-[92vh]' : 'max-w-4xl max-h-[90vh]'
        } overflow-hidden`}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-card shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Gradient Logo Icon Badge */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-md shadow-violet-500/20 shrink-0">
              <GraduationCap size={22} className="text-white" />
            </div>
            
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-600 border border-violet-500/20">
                  {currentGuide.stepCode}
                </span>
                <h2 className="text-base font-bold text-foreground truncate tracking-tight">
                  {currentGuide.moduleName}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {currentGuide.moduleSubtitle}
              </p>
            </div>
          </div>

          {/* Top Actions: Module Selector, Full Flow Toggle, Close */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Switch Module Dropdown */}
            <div className="relative hidden sm:block">
              <select
                aria-label="เลือกคู่มือโมดูล"
                value={selectedGuideId}
                onChange={(e) => setSelectedGuideId(e.target.value)}
                className="bg-muted/50 hover:bg-muted text-xs text-foreground font-semibold border border-border rounded-lg pl-2.5 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer appearance-none transition-colors"
                style={{
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%2364748b' viewBox='0 0 24 24'><path d='M7 10l5 5 5-5z'/></svg>")`,
                  backgroundPosition: 'right 6px center',
                  backgroundRepeat: 'no-repeat',
                }}
              >
                {allGuideKeys.map((key) => (
                  <option key={key} value={key} className="bg-card text-foreground">
                    {MASTER_SOP_GUIDES[key].stepCode} — {MASTER_SOP_GUIDES[key].moduleName.split('(')[0]}
                  </option>
                ))}
              </select>
            </div>

            {/* Full Flow Toggle Button */}
            <button
              type="button"
              onClick={() => setIsFullFlowOpen(!isFullFlowOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-muted/50 hover:bg-muted text-foreground border border-border rounded-lg transition-colors cursor-pointer"
              title={isFullFlowOpen ? 'ย่อหน้าต่าง' : 'เปิดโฟลว์เต็มจอ'}
            >
              {isFullFlowOpen ? (
                <>
                  <Minimize2 size={13} />
                  <span className="hidden md:inline">ย่อหน้าต่าง</span>
                </>
              ) : (
                <>
                  <Maximize2 size={13} />
                  <span className="hidden md:inline">เปิดโฟลว์เต็ม</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Close"
              aria-label="Close manual modal"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* SECTION 1: Workflow Flowchart & Result */}
          <div className="bg-muted/20 border border-border rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <span className="text-base">🚀</span>
                <h3 className="text-sm font-bold text-foreground">
                  สรุปผังกระบวนการทำงาน {currentGuide.stepCode} (Workflow Flowchart &amp; Result)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMermaidCode(!showMermaidCode)}
                className="text-[11px] text-violet-600 hover:text-violet-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Workflow size={12} />
                <span>{showMermaidCode ? 'ซ่อนโครงสร้างโค้ด' : 'ดูโครงสร้าง Flow'}</span>
              </button>
            </div>

            {/* Visual Interactive Flowchart Nodes */}
            <div className="bg-background rounded-xl p-4 border border-border/80 shadow-inner">
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {currentGuide.flowchartNodes.map((node, idx) => (
                  <div 
                    key={node.id} 
                    className={`relative p-3 rounded-xl border transition-all flex flex-col justify-between ${
                      node.type === 'input' 
                        ? 'bg-blue-50/50 border-blue-200/80 text-blue-900' 
                        : node.type === 'decision'
                        ? 'bg-amber-50/50 border-amber-200/80 text-amber-900'
                        : node.type === 'output'
                        ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-900'
                        : 'bg-violet-50/50 border-violet-200/80 text-violet-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          node.type === 'input' ? 'bg-blue-100 text-blue-700' :
                          node.type === 'decision' ? 'bg-amber-100 text-amber-700' :
                          node.type === 'output' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-violet-100 text-violet-700'
                        }`}>
                          {node.type}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">#{idx + 1}</span>
                      </div>
                      <div className="text-xs font-bold leading-tight mt-1">
                        {node.label}
                      </div>
                    </div>
                    {node.detail && (
                      <div className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                        {node.detail}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Collapsible Mermaid Graph Code */}
              {showMermaidCode && (
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="text-[11px] font-mono font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <FileText size={12} />
                    <span>Mermaid Process Flow Diagram</span>
                  </div>
                  <pre className="bg-slate-900 text-emerald-300 p-3 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
                    {currentGuide.flowchartMermaid}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: Deep Dive SOP Guide (3 ขั้นตอนการปฏิบัติงาน & ผลลัพธ์) */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="text-base">📋</span>
              <h3 className="text-sm font-bold text-foreground">
                เจาะลึกขั้นตอนการปฏิบัติงาน &amp; ผลลัพธ์ที่ได้ (SOP Action Guide)
              </h3>
              <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium border border-border">
                Role: <strong className="text-foreground">{currentGuide.role}</strong>
              </span>
            </div>

            {/* 1. ที่มาของงาน (Input / Trigger) */}
            <div className="p-3.5 rounded-xl bg-blue-50/40 border border-blue-200/60">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900 mb-1">
                <span>📥</span>
                <span>ที่มาของงาน &amp; จุดเริ่มต้น (Input &amp; Starting Trigger)</span>
                <span className="ml-auto text-[10px] bg-blue-100 text-blue-800 font-mono px-2 py-0.5 rounded-md border border-blue-300/60">
                  Status: {currentGuide.inputSource.startingStatus}
                </span>
              </div>
              <p className="text-xs text-blue-950/80 mb-2">
                {currentGuide.inputSource.title} — {currentGuide.inputSource.description}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                {currentGuide.inputSource.inputFields.map((field, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-blue-900 bg-white/80 px-2 py-1 rounded-md border border-blue-200/50">
                    <CheckCircle2 size={12} className="text-blue-600 shrink-0" />
                    <span className="truncate">{field}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. หน้าที่ความรับผิดชอบที่ต้องทำ (Step-by-step Actions) */}
            <div className="space-y-3.5">
              <div className="text-xs font-bold text-foreground flex items-center gap-2">
                <span>🔍</span>
                <span>ในขั้นตอนนี้ เจ้าหน้าที่ ({currentGuide.role}) ต้องทำอะไรบ้าง:</span>
              </div>

              {currentGuide.instructions.map((inst) => (
                <div 
                  key={inst.stepNumber} 
                  className="p-3.5 rounded-xl border border-border/80 bg-background hover:border-violet-500/40 transition-colors shadow-2xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                        {inst.stepNumber}
                      </div>
                      <h4 className="text-xs font-bold text-foreground">
                        {inst.title}
                      </h4>
                    </div>
                    {inst.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-600 border border-violet-500/20">
                        {inst.badge}
                      </span>
                    )}
                  </div>

                  <ul className="space-y-1.5 pl-7 text-xs text-muted-foreground list-disc">
                    {inst.actionDetails.map((detail, dIdx) => (
                      <li key={dIdx} className="leading-relaxed">
                        {detail}
                      </li>
                    ))}
                  </ul>

                  {inst.tipsOrAlert && (
                    <div className="mt-2.5 ml-7 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 text-[11px] flex items-center gap-2">
                      <Sparkles size={13} className="text-amber-600 shrink-0" />
                      <span><strong>เทคนิค:</strong> {inst.tipsOrAlert}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 3. ผลลัพธ์และสเต็ปถัดไป (Output & Next Steps) */}
            <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-200/60">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                  <span>📤</span>
                  <span>ผลลัพธ์ที่ได้ &amp; สเต็ปถัดไป (Deliverable &amp; Next Transition)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono px-2 py-0.5 rounded-md border border-emerald-300/60">
                    Next: {currentGuide.outputAndNextStep.nextStatus}
                  </span>
                </div>
              </div>

              <div className="text-xs font-semibold text-emerald-950 mb-2">
                {currentGuide.outputAndNextStep.outputTitle} (ส่งต่อ: {currentGuide.outputAndNextStep.nextRoleOrModule})
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {currentGuide.outputAndNextStep.outputItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-emerald-900 bg-white/80 px-2 py-1.5 rounded-md border border-emerald-200/50">
                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. SLA & KPI Standards */}
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Target size={14} className="text-violet-600" />
                  <span>เกณฑ์มาตรฐาน SLA &amp; KPI ประจำส่วนงานนี้</span>
                </div>
                <span className="text-[10px] font-bold text-violet-600 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                  SLA: {currentGuide.slaAndKpi.slaResponse}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">Key Checklist:</span>
                  {currentGuide.slaAndKpi.keyChecklist.map((chk, cIdx) => (
                    <div key={cIdx} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <span className="text-violet-500 font-bold">•</span>
                      <span>{chk}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">KPI Metric:</span>
                  <div className="p-2 rounded-lg bg-background border border-border text-xs font-medium text-foreground">
                    {currentGuide.slaAndKpi.kpiMetric}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-border bg-card flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>ขั้นตอนก่อนหน้า</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex === allGuideKeys.length - 1}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span>ขั้นตอนถัดไป</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              โมดูล {currentIndex + 1} จาก {allGuideKeys.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow-sm shadow-violet-500/25 transition-all active:scale-95 cursor-pointer"
            >
              เข้าใจแล้ว &amp; เริ่มปฏิบัติงาน
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
