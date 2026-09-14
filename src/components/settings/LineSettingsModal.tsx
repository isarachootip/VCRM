'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Key,
  ShieldCheck,
  ExternalLink,
  MessageSquare,
  Bot,
  AlertCircle,
  Save,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';

interface LineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LineSettingsModal: React.FC<LineSettingsModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [webhookUrl, setWebhookUrl] = useState('https://vcrmx.online/api/webhooks/line');
  const [channelId, setChannelId] = useState('');
  const [channelSecret, setChannelSecret] = useState('');
  const [channelAccessToken, setChannelAccessToken] = useState('');
  const [botBasicId, setBotBasicId] = useState('');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [hasSecret, setHasSecret] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/settings/line');
      const data = await res.json();
      if (data.success && data.data) {
        setWebhookUrl(data.data.webhookUrl || 'https://vcrmx.online/api/webhooks/line');
        setChannelId(data.data.channelId || '');
        setChannelSecret(data.data.channelSecretMasked || '');
        setHasSecret(data.data.hasChannelSecret);
        setHasToken(data.data.hasAccessToken);
        setBotBasicId(data.data.botBasicId || '');
        setAutoReplyEnabled(data.data.autoReplyEnabled ?? true);
        setWelcomeMessage(data.data.welcomeMessage || 'สวัสดีครับ ยินดีต้อนรับสู่ VCRM Customer Service เจ้าหน้าที่จะรีบติดต่อกลับโดยเร็วที่สุดครับ');
      }
    } catch (err: any) {
      console.error('Error fetching LINE settings:', err);
      setErrorMessage('ไม่สามารถโหลดข้อมูลการตั้งค่า LINE ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage('');

    try {
      const res = await fetch('/api/settings/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          channelSecret,
          channelAccessToken,
          botBasicId,
          autoReplyEnabled,
          welcomeMessage,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setHasSecret(data.data.hasChannelSecret);
        setHasToken(data.data.hasAccessToken);
        setChannelSecret(data.data.channelSecretMasked);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setErrorMessage(data.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } catch (err: any) {
      setErrorMessage('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-linear-to-r from-emerald-50 via-teal-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#06C755] flex items-center justify-center text-white shadow-md">
              <MessageSquare size={22} className="fill-white stroke-[#06C755]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">LINE Official Account Integration</h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    hasSecret && hasToken
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {hasSecret && hasToken ? '● Connected' : '○ Setup Required'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                ตั้งค่า Webhook, Channel Secret และ Access Token เพื่อเชื่อมต่อ LINE เข้า VCRM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs">กำลังโหลดการตั้งค่า...</span>
            </div>
          ) : (
            <form id="line-config-form" onSubmit={handleSave} className="space-y-5">
              {/* Webhook URL Box */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    Webhook URL (นำไปใส่ใน LINE Developers Console)
                  </label>
                  <a
                    href="https://developers.line.biz/console/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-medium"
                  >
                    เปิด LINE Developers <ExternalLink size={10} />
                  </a>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 bg-white border border-emerald-300 text-emerald-950 font-mono text-xs px-3 py-2 rounded-md select-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleCopyWebhook}
                    className="bg-[#06C755] hover:bg-[#05b34c] text-white px-3.5 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    {copied ? (
                      <>
                        <Check size={14} /> คัดลอกแล้ว
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> คัดลอก URL
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-emerald-700 mt-2">
                  💡 วาง URL นี้ในช่อง <b>Webhook URL</b> ที่เมนู Messaging API แล้วเปิดสวิตช์ <b>Use webhook</b>
                </p>
              </div>

              {/* Status Alert */}
              {saveSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-lg flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>บันทึกการตั้งค่า LINE เรียบร้อยแล้ว ระบบพร้อมรับ Webhook และส่งข้อความ</span>
                </div>
              )}

              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Channel Credentials */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-2">
                  <Key size={14} className="text-gray-500" />
                  LINE Channel Credentials
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Channel ID */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Channel ID
                    </label>
                    <input
                      type="text"
                      value={channelId}
                      onChange={(e) => setChannelId(e.target.value)}
                      placeholder="เช่น 2006789012"
                      className="w-full text-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">ดูได้จากหน้า Basic settings</span>
                  </div>

                  {/* Bot Basic ID / LINE ID */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Bot Basic ID (@LINE OA)
                    </label>
                    <input
                      type="text"
                      value={botBasicId}
                      onChange={(e) => setBotBasicId(e.target.value)}
                      placeholder="เช่น @vcrm_official"
                      className="w-full text-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">ดูได้จากหน้า Messaging API</span>
                  </div>
                </div>

                {/* Channel Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                      <Lock size={12} className="text-gray-400" /> Channel Secret <span className="text-rose-500">*</span>
                    </label>
                    {hasSecret && (
                      <span className="text-[10px] text-emerald-600 font-medium">✓ บันทึกไว้แล้ว</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={channelSecret}
                      onChange={(e) => setChannelSecret(e.target.value)}
                      placeholder="กรอก Channel Secret (32 หลัก) จาก Basic settings"
                      className="w-full text-xs font-mono px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    ใช้ตรวจสอบความถูกต้องของ Webhook Signature (x-line-signature) ป้องกันการปลอมแปลง
                  </p>
                </div>

                {/* Channel Access Token */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-700">
                      Channel Access Token (Long-lived) <span className="text-rose-500">*</span>
                    </label>
                    {hasToken && (
                      <span className="text-[10px] text-emerald-600 font-medium">✓ บันทึกไว้แล้ว</span>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={channelAccessToken}
                    onChange={(e) => setChannelAccessToken(e.target.value)}
                    placeholder="กด Issue token ที่ Messaging API แล้วนำ Token ยาวๆ มาวางที่นี่..."
                    className="w-full text-xs font-mono px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    ใช้สำหรับดึงรูปโปรไฟล์/ชื่อลูกค้า และส่งข้อความตอบกลับหาลูกค้าผ่าน VCRM
                  </p>
                </div>
              </div>

              {/* Bot Behavior & Welcome */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot size={15} className="text-emerald-600" />
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">ส่งข้อความต้อนรับอัตโนมัติ (Welcome Auto-reply)</h4>
                      <p className="text-[11px] text-gray-500">ส่งข้อความตอบกลับทันทีเมื่อลูกค้าทักแชทเข้ามาใหม่</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoReplyEnabled}
                      onChange={(e) => setAutoReplyEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#06C755]"></div>
                  </label>
                </div>

                {autoReplyEnabled && (
                  <div>
                    <input
                      type="text"
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      placeholder="สวัสดีครับ ยินดีต้อนรับสู่ VCRM..."
                      className="w-full text-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            ระบบจัดเก็บรหัสผ่านอย่างปลอดภัยในเครื่องและเข้ารหัสตอนส่ง
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
            >
              ปิด
            </button>
            <button
              form="line-config-form"
              type="submit"
              disabled={saving || loading}
              className="bg-[#06C755] hover:bg-[#05b34c] disabled:opacity-50 text-white px-5 py-2 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save size={14} /> บันทึกการตั้งค่า
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
