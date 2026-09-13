'use client';

import React, { useState, useRef } from 'react';
import { 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  Lock, 
  MessageSquare, 
  X, 
  Loader2, 
  AlertCircle, 
  ShieldAlert,
  FileText
} from 'lucide-react';

export interface SendMessagePayload {
  content: string;
  isInternal: boolean;
  type?: 'TEXT' | 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO' | string;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
  agentId?: string;
}

export interface MessageComposerProps {
  caseId: string;
  caseNumber?: string;
  isCaseClosed: boolean;
  onSendMessage: (payload: SendMessagePayload) => Promise<void>;
  currentAgentId?: string;
  isSending?: boolean;
}

interface StagedAttachment {
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  caseId,
  caseNumber,
  isCaseClosed,
  onSendMessage,
  currentAgentId = 'agent_sarah_01',
  isSending = false,
}) => {
  const [text, setText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [stagedAttachment, setStagedAttachment] = useState<StagedAttachment | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Upload file helper (multipart/form-data to /api/media/upload)
  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('mimeType', file.type);
      formData.append('fileSize', String(file.size));

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed with status ${res.status}`);
      }

      const data = await res.json();
      setStagedAttachment({
        url: data.url,
        fileName: data.fileName || file.name,
        mimeType: data.mimeType || file.type,
        fileSize: data.fileSize || file.size,
        width: data.width,
        height: data.height,
      });
    } catch (err: any) {
      console.error('File upload failed:', err);
      setUploadError(err.message || 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
    }
  };

  // Clipboard screenshot paste handler
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await uploadFile(file);
        }
        break;
      }
    }
  };

  // File input change handler
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Trigger file selection
  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  // Send message
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !stagedAttachment) return;
    if (isSending || isUploading) return;

    let msgType = 'TEXT';
    if (stagedAttachment) {
      if (stagedAttachment.mimeType.startsWith('image/')) {
        msgType = 'IMAGE';
      } else if (stagedAttachment.mimeType.startsWith('video/')) {
        msgType = 'VIDEO';
      } else if (stagedAttachment.mimeType.startsWith('audio/')) {
        msgType = 'AUDIO';
      } else {
        msgType = 'FILE';
      }
    }

    const payload: SendMessagePayload = {
      content: trimmed,
      isInternal,
      type: msgType,
      agentId: currentAgentId,
      ...(stagedAttachment
        ? {
            mediaUrl: stagedAttachment.url,
            fileName: stagedAttachment.fileName,
            mimeType: stagedAttachment.mimeType,
            fileSize: stagedAttachment.fileSize,
            width: stagedAttachment.width,
            height: stagedAttachment.height,
          }
        : {}),
    };

    try {
      await onSendMessage(payload);
      setText('');
      setStagedAttachment(null);
      setUploadError(null);
    } catch (err: any) {
      console.error('Failed to send message:', err);
    }
  };

  // Keydown handler: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Terminal Lock for CLOSED case
  if (isCaseClosed) {
    return (
      <div className="p-4 bg-slate-100 border-t border-slate-300 text-center select-none">
        <div className="flex items-center justify-center gap-2 text-slate-600 font-semibold text-xs py-2 px-4 rounded-lg bg-slate-200/80 border border-slate-300 max-w-xl mx-auto shadow-xs">
          <Lock size={15} className="text-slate-500" />
          <span>Case {caseNumber || caseId} is CLOSED and locked. Cannot send messages or add notes.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border-t transition-colors p-3.5 bg-white ${
        isInternal ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200'
      }`}
    >
      {/* Top Toggle Bar: Customer Reply vs Internal Whisper Note */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setIsInternal(false)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              !isInternal
                ? 'bg-[#ff7a59] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare size={13} />
            <span>💬 Customer Reply</span>
          </button>

          <button
            type="button"
            onClick={() => setIsInternal(true)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              isInternal
                ? 'bg-amber-400 text-amber-950 shadow-xs ring-1 ring-amber-500'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock size={13} />
            <span>🔒 Staff Whisper Note</span>
          </button>
        </div>

        {/* Mode Explainer Banner */}
        <div className="text-[11px]">
          {isInternal ? (
            <span className="text-amber-800 font-semibold flex items-center gap-1 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
              <ShieldAlert size={12} />
              Whisper Mode: Internal only (Customer will not see this note)
            </span>
          ) : (
            <span className="text-slate-400 text-[11px] hidden sm:inline">
              Dispatching to Zwiz.AI Gateway &bull; LINE / FB / IG
            </span>
          )}
        </div>
      </div>

      {/* Staged Attachment Preview Card */}
      {stagedAttachment && (
        <div className="mb-2 p-2 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {stagedAttachment.mimeType.startsWith('image/') ? (
              <img
                src={stagedAttachment.url}
                alt="Attachment Preview"
                className="w-10 h-10 object-cover rounded border border-slate-300 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded bg-slate-200 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-slate-600" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 truncate max-w-xs sm:max-w-md">
                {stagedAttachment.fileName}
              </p>
              <p className="text-[10px] text-slate-500">
                {(stagedAttachment.fileSize / 1024).toFixed(1)} KB • {stagedAttachment.mimeType}
              </p>
            </div>
          </div>

          <button
            onClick={() => setStagedAttachment(null)}
            className="p-1 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800"
            title="Remove attachment"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="mb-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={14} />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="text-red-500 hover:text-red-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Textarea Input Container */}
      <div
        className={`relative rounded-xl border transition-all ${
          isInternal
            ? 'border-amber-400 bg-amber-50/40 focus-within:ring-2 focus-within:ring-amber-300'
            : 'border-slate-300 bg-white focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-transparent'
        }`}
      >
        <textarea
          ref={textareaRef}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            isInternal
              ? 'Type an internal whisper note (supports @mentions, e.g. @agent_ploi, paste screenshot)...'
              : 'Type a message to customer (Enter to send, Shift+Enter for newline, paste screenshots directly)...'
          }
          className={`w-full p-3 text-xs sm:text-sm bg-transparent resize-none focus:outline-none placeholder-slate-400 leading-relaxed ${
            isInternal ? 'text-amber-950 font-medium' : 'text-slate-800'
          }`}
        />

        {/* Composer Actions Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-white/70 rounded-b-xl">
          {/* Left: Attachment trigger & Clipboard hint */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            />
            <button
              type="button"
              onClick={handlePickFile}
              disabled={isUploading || isSending}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-1.5 rounded-md text-xs transition-colors disabled:opacity-50"
              title="Attach File or Media"
            >
              <Paperclip size={15} />
              <span className="hidden sm:inline font-medium text-[11px]">Attach</span>
            </button>

            {isUploading && (
              <span className="flex items-center gap-1 text-xs text-orange-600 font-medium animate-pulse">
                <Loader2 size={13} className="animate-spin" />
                Uploading...
              </span>
            )}
            
            <span className="text-[10px] text-slate-400 hidden md:inline">
              📋 Paste screenshots directly (Ctrl+V)
            </span>
          </div>

          {/* Right: Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={(!text.trim() && !stagedAttachment) || isSending || isUploading}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed ${
              isInternal
                ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 active:scale-95'
                : 'bg-gradient-to-r from-[#ff7a59] to-[#ff5c35] hover:opacity-95 text-white active:scale-95'
            }`}
          >
            {isSending ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Sending...</span>
              </>
            ) : isInternal ? (
              <>
                <Lock size={13} />
                <span>Add Whisper Note</span>
              </>
            ) : (
              <>
                <Send size={13} />
                <span>Send Reply</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
