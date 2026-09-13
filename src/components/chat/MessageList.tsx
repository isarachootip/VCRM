'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  CheckCheck, 
  Clock, 
  AlertCircle, 
  Lock, 
  FileText, 
  FileSpreadsheet, 
  FileCode, 
  Download, 
  Play, 
  Volume2, 
  Maximize2, 
  X, 
  ShieldAlert, 
  User, 
  Headphones,
  FileIcon
} from 'lucide-react';

export interface FormattedMessage {
  id: string;
  caseId?: string;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO' | string;
  content?: {
    text?: string;
    mediaUrl?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    width?: number;
    height?: number;
    duration?: number;
  } | any;
  text?: string;
  mediaUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  mediaMetadata?: any;
  isInternal: boolean;
  deliveryStatus: 'PENDING' | 'DELIVERED' | 'FAILED' | 'DELIVERY_FAILED' | 'RECEIVED' | 'INTERNAL_ONLY' | string;
  deliveredAt?: string | null;
  senderId?: string;
  senderType?: 'CUSTOMER' | 'AGENT' | 'SYSTEM' | string;
  authorId?: string | null;
  mentions?: string[];
  createdAt: string;
}

export interface MessageListProps {
  messages: FormattedMessage[];
  currentUserId?: string;
  isLoading?: boolean;
  onPreviewImage?: (url: string) => void;
  caseStatus?: string;
  customerName?: string;
  customerAvatar?: string | null;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading = false,
  onPreviewImage,
  customerName = 'Customer',
  customerAvatar = null,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Format file size
  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format time (HH:mm)
  const formatMsgTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Deliver status icon
  const renderDeliveryStatus = (status: string) => {
    switch (status) {
      case 'DELIVERED':
      case 'RECEIVED':
        return (
          <span title="Delivered to customer">
            <CheckCheck size={14} className="text-emerald-500" />
          </span>
        );
      case 'PENDING':
        return (
          <span title="Sending...">
            <Clock size={13} className="text-slate-400" />
          </span>
        );
      case 'FAILED':
      case 'DELIVERY_FAILED':
        return (
          <span title="Delivery failed">
            <AlertCircle size={14} className="text-red-500" />
          </span>
        );
      case 'INTERNAL_ONLY':
        return (
          <span title="Internal Note">
            <Lock size={12} className="text-amber-700" />
          </span>
        );
      default:
        return <Check size={13} className="text-slate-400" />;
    }
  };

  // Highlight @mentions in text
  const renderHighlightedText = (text: string, isWhisper = false) => {
    if (!text) return null;
    const parts = text.split(/(@[a-zA-Z0-9_-]+)/g);

    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={index}
            className={`font-bold px-1 py-0.5 rounded text-[11px] inline-block mx-0.5 ${
              isWhisper
                ? 'bg-amber-200 text-amber-950 border border-amber-300'
                : 'bg-orange-100 text-orange-900 border border-orange-200'
            }`}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Render file attachment icon
  const renderFileIcon = (mimeType?: string | null) => {
    if (!mimeType) return <FileIcon size={24} className="text-slate-500" />;
    if (mimeType.includes('pdf')) return <FileText size={24} className="text-red-500" />;
    if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
      return <FileSpreadsheet size={24} className="text-emerald-600" />;
    }
    if (mimeType.includes('json') || mimeType.includes('code') || mimeType.includes('javascript')) {
      return <FileCode size={24} className="text-blue-500" />;
    }
    return <FileIcon size={24} className="text-orange-500" />;
  };

  const handleOpenImage = (url: string) => {
    if (onPreviewImage) {
      onPreviewImage(url);
    } else {
      setLightboxUrl(url);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/50">
      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 bg-slate-800/80 rounded-full p-1.5 transition-colors"
            >
              <X size={20} />
            </button>
            <img
              src={lightboxUrl}
              alt="Lightbox Preview"
              className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl ring-1 ring-white/20"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-2 flex items-center gap-3">
              <a
                href={lightboxUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 py-1.5 rounded-md font-semibold"
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={14} />
                Open Full Original
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="flex flex-col space-y-3 py-6">
          <div className="w-48 h-10 bg-slate-200 rounded-lg animate-pulse"></div>
          <div className="w-64 h-12 bg-slate-200 rounded-lg animate-pulse self-end"></div>
          <div className="w-56 h-10 bg-slate-200 rounded-lg animate-pulse"></div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && messages.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Headphones size={24} className="text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No messages in this conversation</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Start communicating with the customer or record an internal whisper note.
          </p>
        </div>
      )}

      {/* Message List */}
      {messages.map((msg) => {
        const isCustomer = msg.senderType === 'CUSTOMER' || (!msg.isInternal && msg.senderId?.startsWith('user_'));
        const isWhisper = Boolean(msg.isInternal);
        const msgText = msg.text || (typeof msg.content === 'object' ? msg.content?.text : (typeof msg.content === 'string' ? msg.content : ''));
        const mediaUrl = msg.mediaUrl || (typeof msg.content === 'object' ? msg.content?.mediaUrl : null);
        const fileName = msg.fileName || (typeof msg.content === 'object' ? msg.content?.fileName : null);
        const mimeType = msg.mimeType || (typeof msg.content === 'object' ? msg.content?.mimeType : null);
        const fileSize = msg.fileSize || (typeof msg.content === 'object' ? msg.content?.fileSize : null);
        const msgType = (msg.type || '').toUpperCase();

        // 1. Staff Whisper Note (Prominent Amber Tint & Badges)
        if (isWhisper) {
          return (
            <div
              key={msg.id}
              className="mx-auto my-3 w-full max-w-2xl bg-amber-50 border-2 border-amber-300 rounded-xl p-4 text-amber-950 shadow-xs"
            >
              {/* Header Badge */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-200/80">
                <div className="flex items-center gap-1.5">
                  <span className="bg-amber-200 text-amber-950 font-bold px-2 py-0.5 rounded text-xs inline-flex items-center gap-1">
                    <Lock size={12} />
                    🔒 Staff Whisper Note • Internal Only
                  </span>
                  <span className="text-[11px] text-amber-800/80 font-medium hidden sm:inline">
                    (Excluded from Zwiz/customer channels)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-amber-800 font-mono">
                  <span>{formatMsgTime(msg.createdAt)}</span>
                  {renderDeliveryStatus('INTERNAL_ONLY')}
                </div>
              </div>

              {/* Note Content */}
              {msgText && (
                <div className="text-xs md:text-sm whitespace-pre-wrap leading-relaxed font-normal text-amber-950 break-words">
                  {renderHighlightedText(msgText, true)}
                </div>
              )}

              {/* Media Attachment inside Whisper */}
              {mediaUrl && (
                <div className="mt-3">
                  {msgType === 'VIDEO' ? (
                    <video controls src={mediaUrl} className="max-w-md rounded-lg shadow-sm border border-amber-300" />
                  ) : msgType === 'AUDIO' ? (
                    <audio controls src={mediaUrl} className="w-full max-w-sm rounded-lg" />
                  ) : (
                    <div 
                      onClick={() => handleOpenImage(mediaUrl)}
                      className="relative inline-block cursor-pointer group rounded-lg overflow-hidden border border-amber-300 max-w-xs shadow-xs"
                    >
                      <img
                        src={mediaUrl}
                        alt="Internal attachment"
                        className="max-h-60 rounded-lg object-contain bg-black/5 group-hover:opacity-95 transition-opacity"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                        <Maximize2 size={18} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Author Footer */}
              <div className="mt-2 pt-1 flex items-center justify-between text-[10px] text-amber-700/80">
                <span>Author: {msg.authorId || msg.senderId || 'Support Agent'}</span>
                {msg.mentions && msg.mentions.length > 0 && (
                  <span className="italic">Notified: @{msg.mentions.join(', @')}</span>
                )}
              </div>
            </div>
          );
        }

        // 2. Customer Inbound vs Agent Outbound Message
        return (
          <div
            key={msg.id}
            className={`flex items-end gap-2.5 ${isCustomer ? 'justify-start' : 'justify-end'}`}
          >
            {/* Customer Avatar for Inbound */}
            {isCustomer && (
              <div className="shrink-0 mb-1">
                {customerAvatar ? (
                  <img
                    src={customerAvatar}
                    alt={customerName}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    {customerName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            )}

            {/* Message Bubble Container */}
            <div
              className={`flex flex-col max-w-[85%] sm:max-w-[70%] md:max-w-[60%] ${
                isCustomer ? 'items-start' : 'items-end'
              }`}
            >
              {/* Bubble Body */}
              <div
                className={`rounded-2xl px-4 py-2.5 shadow-xs transition-shadow ${
                  isCustomer
                    ? 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                    : 'bg-gradient-to-r from-[#ff7a59] to-[#ff5c35] text-white rounded-br-xs shadow-orange-500/10'
                }`}
              >
                {/* 2.1 Video Message */}
                {(msgType === 'VIDEO' || (mimeType && mimeType.startsWith('video/'))) && mediaUrl && (
                  <div className="my-1">
                    <video
                      controls
                      src={mediaUrl}
                      className="max-w-full rounded-xl shadow-xs max-h-72 bg-black"
                    />
                  </div>
                )}

                {/* 2.2 Audio Memo Message */}
                {(msgType === 'AUDIO' || (mimeType && mimeType.startsWith('audio/'))) && mediaUrl && (
                  <div className="my-1 flex flex-col gap-1 min-w-[220px]">
                    <div className="flex items-center gap-1.5 text-xs font-medium opacity-90 mb-1">
                      <Volume2 size={15} />
                      <span>Audio Voice Memo</span>
                    </div>
                    <audio controls src={mediaUrl} className="w-full max-w-xs h-9" />
                  </div>
                )}

                {/* 2.3 Image Message (Preview Card + Lightbox) */}
                {(msgType === 'IMAGE' || (mimeType && mimeType.startsWith('image/')) || (!msgType && mediaUrl && !fileName)) && mediaUrl && (
                  <div className="my-1.5">
                    <div
                      onClick={() => handleOpenImage(mediaUrl)}
                      className="relative rounded-xl overflow-hidden cursor-pointer group bg-black/5 max-w-sm border border-black/10"
                    >
                      <img
                        src={mediaUrl}
                        alt="Chat Attachment"
                        className="max-h-72 w-auto object-cover group-hover:scale-102 transition-transform duration-200"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                        <Maximize2 size={20} className="drop-shadow-md" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2.4 File Attachment Message */}
                {(msgType === 'FILE' || (fileName && !mimeType?.startsWith('image/'))) && (
                  <div
                    className={`flex items-center gap-3 p-2.5 my-1 rounded-xl border ${
                      isCustomer
                        ? 'bg-slate-50 border-slate-200 text-slate-800'
                        : 'bg-white/15 border-white/25 text-white'
                    }`}
                  >
                    <div className="shrink-0 p-1.5 rounded-lg bg-white shadow-xs">
                      {renderFileIcon(mimeType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate max-w-[180px]">
                        {fileName || 'document_attachment'}
                      </p>
                      <p className="text-[10px] opacity-75">
                        {formatFileSize(fileSize)} {mimeType ? `• ${mimeType.split('/')[1] || ''}` : ''}
                      </p>
                    </div>
                    {mediaUrl && (
                      <a
                        href={mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        download={fileName || true}
                        className={`p-1.5 rounded-lg hover:bg-black/10 transition-colors ${
                          isCustomer ? 'text-slate-600 hover:text-slate-900' : 'text-white'
                        }`}
                        title="Download file"
                      >
                        <Download size={16} />
                      </a>
                    )}
                  </div>
                )}

                {/* 2.5 Text Content */}
                {msgText && (
                  <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed break-words font-normal">
                    {renderHighlightedText(msgText, false)}
                  </div>
                )}
              </div>

              {/* Timestamp and Delivery Checkmark */}
              <div
                className={`flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-400 ${
                  isCustomer ? 'justify-start' : 'justify-end'
                }`}
              >
                <span>{formatMsgTime(msg.createdAt)}</span>
                {!isCustomer && renderDeliveryStatus(msg.deliveryStatus)}
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
};
