import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Calendar, 
  Check, 
  SlidersHorizontal,
  Info
} from 'lucide-react';
import type { Transaction, CategoryData, ExpenseGroup, UserRole } from '../../types';
import { 
  ExportLedgerOptions, 
  filterTransactionsForExport, 
  calculateDatePresetBounds,
  exportLedgerToCSV,
  exportLedgerToExcel,
  exportLedgerToPrintablePDF
} from '../../utils/exportLedgerUtils';
import { amountToIndianWords } from '../../utils/indianCurrencyWords';

interface ExportLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: Record<string, CategoryData>;
  group: ExpenseGroup | null;
  currentUserName?: string;
  currentUserEmail?: string;
  userRole?: UserRole;
}

export function ExportLedgerModal({
  isOpen,
  onClose,
  transactions,
  categories,
  group,
  currentUserName,
  currentUserEmail,
  userRole
}: ExportLedgerModalProps) {
  const [datePreset, setDatePreset] = useState<ExportLedgerOptions['datePreset']>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [includeCategory, setIncludeCategory] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<ExportLedgerOptions['statusFilter']>('all');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Calculate current options
  const exportOptions: ExportLedgerOptions = useMemo(() => {
    let start = '';
    let end = '';
    if (datePreset === 'custom') {
      start = customStart;
      end = customEnd;
    } else if (datePreset !== 'all') {
      const b = calculateDatePresetBounds(datePreset);
      start = b.startDate;
      end = b.endDate;
    }

    return {
      datePreset,
      startDate: start,
      endDate: end,
      includeCategory,
      statusFilter
    };
  }, [datePreset, customStart, customEnd, includeCategory, statusFilter]);

  // Preview filtered entries
  const filteredList = useMemo(() => {
    return filterTransactionsForExport(transactions, exportOptions);
  }, [transactions, exportOptions]);

  const totalAmount = useMemo(() => {
    return filteredList.reduce((acc, t) => acc + (t.amount || 0), 0);
  }, [filteredList]);

  const inWords = useMemo(() => {
    return amountToIndianWords(totalAmount);
  }, [totalAmount]);

  if (!isOpen) return null;

  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    setIsExporting(format);
    try {
      if (format === 'excel') {
        exportLedgerToExcel(transactions, categories, group, exportOptions, currentUserName, currentUserEmail);
      } else if (format === 'csv') {
        exportLedgerToCSV(transactions, categories, group, exportOptions, currentUserName, currentUserEmail);
      } else if (format === 'pdf') {
        exportLedgerToPrintablePDF(transactions, categories, group, exportOptions, currentUserName, currentUserEmail);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setTimeout(() => setIsExporting(null), 600);
    }
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  const currentFyLabel = `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;
  const prevFyLabel = `FY ${fyStartYear - 1}-${String(fyStartYear).slice(-2)}`;

  const presets: { id: ExportLedgerOptions['datePreset']; label: string }[] = [
    { id: 'all', label: 'All Time' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'current_fy', label: currentFyLabel },
    { id: 'last_fy', label: prevFyLabel },
    { id: 'custom', label: 'Custom' }
  ];

  if (!isOpen || userRole === 'viewer') return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-sans select-none overflow-y-auto">
      <div 
        className="bg-surface w-full max-w-md rounded-3xl p-5 sm:p-6 border border-border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 relative my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle, Clean Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/70">
          <div>
            <h3 className="text-base font-semibold text-text-primary tracking-tight">
              Export Ledger
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {group?.name || 'Expense Ledger'} · Indian Accounting Format
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 text-xs no-scrollbar">
          {/* Date Range Selection - Subtle Pill Chips */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
              Period
            </label>

            <div className="flex flex-wrap gap-1.5">
              {presets.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDatePreset(p.id)}
                  className={`h-8 px-3 rounded-full text-xs font-medium transition-all cursor-pointer select-none ${
                    datePreset === p.id
                      ? 'bg-google-blue text-white shadow-xs font-semibold'
                      : 'bg-surface hover:bg-surface-hover text-text-secondary border border-border'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            {datePreset === 'custom' && (
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-surface-hover/30 rounded-2xl border border-border mt-2 animate-in fade-in duration-150">
                <div>
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold block mb-1">
                    From
                  </label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-xl bg-surface border border-border text-text-primary text-xs focus:outline-hidden focus:border-google-blue"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold block mb-1">
                    To
                  </label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-xl bg-surface border border-border text-text-primary text-xs focus:outline-hidden focus:border-google-blue"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Options: Category Toggle & Status */}
          <div className="space-y-2 pt-1 border-t border-border/60">
            {/* Category Toggle Row */}
            <div className="flex items-center justify-between py-2 px-3 bg-surface-hover/30 rounded-2xl border border-border">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-medium text-text-primary block">
                  Include Categories
                </span>
                <span className="text-[11px] text-text-secondary block">
                  {includeCategory ? 'Includes category column & breakdown sheet' : 'Clean cash/bank general ledger'}
                </span>
              </div>

              {/* Apple-style Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={includeCategory}
                onClick={() => setIncludeCategory(!includeCategory)}
                className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer focus:outline-hidden shrink-0 ${
                  includeCategory ? 'bg-google-blue' : 'bg-border'
                }`}
              >
                <span
                  className={`block w-4.5 h-4.5 rounded-full bg-white shadow-xs transition-transform transform ${
                    includeCategory ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Status Filter Row */}
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="text-text-secondary font-medium">Status</span>
              <div className="inline-flex p-0.5 rounded-full bg-surface-hover border border-border">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-surface text-text-primary font-semibold shadow-xs'
                      : 'text-text-secondary hover:text-text-primary font-medium'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('settled')}
                  className={`px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer ${
                    statusFilter === 'settled'
                      ? 'bg-surface text-text-primary font-semibold shadow-xs'
                      : 'text-text-secondary hover:text-text-primary font-medium'
                  }`}
                >
                  Settled
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('unsettled')}
                  className={`px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer ${
                    statusFilter === 'unsettled'
                      ? 'bg-surface text-text-primary font-semibold shadow-xs'
                      : 'text-text-secondary hover:text-text-primary font-medium'
                  }`}
                >
                  Active
                </button>
              </div>
            </div>
            <p className="text-[10px] text-text-secondary px-1 italic">
              Settled: cleared/reimbursed expenses · Active: ongoing open expenses
            </p>
          </div>

          {/* Subtle Output Summary Banner */}
          <div className="p-3 bg-surface-hover/40 rounded-2xl border border-border space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-text-secondary">
                {filteredList.length} {filteredList.length === 1 ? 'expense' : 'expenses'}
              </span>
              <span className="text-base font-bold font-mono text-text-primary">
                ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {inWords && (
              <p className="text-[10.5px] italic text-text-secondary/80 leading-tight">
                {inWords} Only
              </p>
            )}
          </div>

          {filteredList.length === 0 && (
            <div className="p-2.5 rounded-xl bg-surface-hover text-text-secondary text-xs flex items-center gap-2 border border-border">
              <Info size={14} className="shrink-0 text-text-secondary" />
              <span>No transactions match this period.</span>
            </div>
          )}
        </div>

        {/* Unified, Subtle Format Buttons (Strictly matching app style) */}
        <div className="pt-2 border-t border-border/70 space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary block px-0.5">
            Choose Format
          </span>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={filteredList.length === 0 || isExporting !== null}
              onClick={() => handleExport('excel')}
              className="h-11 rounded-2xl border border-border bg-surface hover:bg-surface-hover hover:border-google-blue/40 active:scale-98 text-text-primary font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:pointer-events-none"
              title="Download Excel spreadsheet"
            >
              <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              disabled={filteredList.length === 0 || isExporting !== null}
              onClick={() => handleExport('csv')}
              className="h-11 rounded-2xl border border-border bg-surface hover:bg-surface-hover hover:border-google-blue/40 active:scale-98 text-text-primary font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:pointer-events-none"
              title="Download CSV file"
            >
              <FileText size={15} className="text-google-blue" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              disabled={filteredList.length === 0 || isExporting !== null}
              onClick={() => handleExport('pdf')}
              className="h-11 rounded-2xl border border-border bg-surface hover:bg-surface-hover hover:border-google-blue/40 active:scale-98 text-text-primary font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:pointer-events-none"
              title="Print or Save PDF Statement"
            >
              <Printer size={15} className="text-text-secondary" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
