'use client';

import React, { useState } from 'react';
import { X, UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseExcelOrCsv } from '@/utils/excelHelper';
import { CRMItem } from '@/types/crm';
import { useLanguage } from '@/context/LanguageContext';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: Partial<CRMItem>[]) => void;
  targetGroupName: string;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  targetGroupName,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewItems, setPreviewItems] = useState<Partial<CRMItem>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setError(null);
    setIsLoading(true);

    try {
      const items = await parseExcelOrCsv(selected);
      setPreviewItems(items);
    } catch (err: any) {
      setError(`Failed to read file: ${err.message || 'Invalid format'}`);
      setPreviewItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (previewItems.length > 0) {
      onImport(previewItems);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">{t('import_title')}</h3>
              <p className="text-[11px] text-gray-500">{t('target_group')}: <span className="font-semibold text-blue-600">{t(targetGroupName) || targetGroupName}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Dropzone */}
          <div className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-gray-50/50 relative">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <UploadCloud size={32} className="mx-auto text-blue-500 mb-2" />
            <div className="text-xs font-bold text-gray-800">
              {file ? file.name : t('select_file')}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              {t('import_desc')}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Preview Table */}
          {previewItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-700">
                  {t('Preview Data')} ({previewItems.length} {t('items')})
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={13} /> {t('Ready to import')}
                </span>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-48 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-gray-100 text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-1.5">{t('col_item_name')}</th>
                      <th className="px-3 py-1.5">{t('col_contact_person')}</th>
                      <th className="px-3 py-1.5">{t('col_contact_email')}</th>
                      <th className="px-3 py-1.5 text-right">{t('Value')}</th>
                      <th className="px-3 py-1.5">{t('col_status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewItems.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-medium">{row.name}</td>
                        <td className="px-3 py-1.5 text-gray-600">{row.contactPerson}</td>
                        <td className="px-3 py-1.5 text-gray-500">{row.contactEmail}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-emerald-600">
                          {row.dealValue?.toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5">{t(row.status || '') || row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewItems.length > 5 && (
                <div className="text-[10px] text-gray-400 mt-1 text-center italic">
                  + {t('and_more_rows').replace('{count}', String(previewItems.length - 5))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {t('Cancel')}
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={previewItems.length === 0 || isLoading}
            className="px-5 py-2 text-xs font-bold text-white bg-[#0073ea] hover:bg-[#0060b9] disabled:opacity-40 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
          >
            <CheckCircle2 size={14} />
            <span>{t('import_excel')} ({previewItems.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
