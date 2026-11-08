import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  UserCheck,
  ShieldAlert,
  Tag,
  FolderPlus,
  ArrowRight
} from 'lucide-react';
import type { ExpenseGroup, CategoryData } from '../../types';
import { 
  parseAndValidateLedgerImport, 
  ImportValidationResult, 
  ImportRowParsed,
  formatIndianDate 
} from '../../utils/exportLedgerUtils';
import { amountToIndianWords } from '../../utils/indianCurrencyWords';

interface ImportLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: ExpenseGroup | null;
  categories: Record<string, CategoryData>;
  currentUserName?: string;
  currentUserEmail?: string;
  onBatchImport: (
    importedRows: ImportRowParsed[], 
    newCategoriesToCreate?: Record<string, CategoryData>
  ) => Promise<void>;
}

export function ImportLedgerModal({
  isOpen,
  onClose,
  group,
  categories,
  currentUserName,
  currentUserEmail,
  onBatchImport
}: ImportLedgerModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [emailMappings, setEmailMappings] = useState<Record<string, string>>({});
  const [categoryActions, setCategoryActions] = useState<Record<string, { mode: 'create' | 'map'; targetKey?: string }>>({});
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);

  // Group members list for mapping dropdowns (defined before conditional return)
  const availableGroupMembers = React.useMemo(() => {
    const members: { email: string; name: string }[] = [];
    if (currentUserEmail) {
      members.push({ email: currentUserEmail.toLowerCase(), name: `${currentUserName || 'You'} (${currentUserEmail})` });
    }
    if (group?.members) {
      Object.values(group.members).forEach(m => {
        if (m.email && !members.some(existing => existing.email === m.email.toLowerCase())) {
          members.push({
            email: m.email.toLowerCase(),
            name: `${m.displayName || m.email.split('@')[0]} (${m.email})`
          });
        }
      });
    }
    if (group?.ownerEmail && !members.some(existing => existing.email === group.ownerEmail.toLowerCase())) {
      members.push({
        email: group.ownerEmail.toLowerCase(),
        name: `Ledger Owner (${group.ownerEmail})`
      });
    }
    return members;
  }, [group, currentUserEmail, currentUserName]);

  // Check if all unmatched emails have been reassigned via mappings
  const allUnmatchedEmailsResolved = React.useMemo(() => {
    if (!validationResult) return false;
    if (validationResult.unmatchedEmails.length === 0) return true;
    return validationResult.unmatchedEmails.every(email => Boolean(emailMappings[email]));
  }, [validationResult, emailMappings]);

  // Check if all unmatched categories have an action (create or mapped to target)
  const allUnmatchedCategoriesResolved = React.useMemo(() => {
    if (!validationResult) return false;
    if (!validationResult.unmatchedCategories || validationResult.unmatchedCategories.length === 0) return true;
    return validationResult.unmatchedCategories.every(rawCat => {
      const action = categoryActions[rawCat];
      if (!action) return false;
      if (action.mode === 'create') return true;
      if (action.mode === 'map') return Boolean(action.targetKey);
      return false;
    });
  }, [validationResult, categoryActions]);

  // Reset modal state when closed
  React.useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setIsParsing(false);
      setValidationResult(null);
      setEmailMappings({});
      setCategoryActions({});
      setIsImporting(false);
      setImportError(null);
      setDragOver(false);
    }
  }, [isOpen]);

  const handleProcessFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    setValidationResult(null);
    setEmailMappings({});
    setCategoryActions({});
    setImportError(null);

    try {
      const result = await parseAndValidateLedgerImport(
        selectedFile,
        group,
        categories,
        currentUserEmail,
        currentUserName
      );

      // Pre-seed category actions: default to 'create' for new/unmatched categories
      if (result.unmatchedCategories && result.unmatchedCategories.length > 0) {
        const initialActions: Record<string, { mode: 'create' | 'map'; targetKey?: string }> = {};
        result.unmatchedCategories.forEach(cat => {
          initialActions[cat] = { mode: 'create' };
        });
        setCategoryActions(initialActions);
      }

      setValidationResult(result);
    } catch (err: any) {
      setValidationResult({
        validRows: [],
        totalRows: 0,
        totalAmount: 0,
        dateRange: { start: '', end: '' },
        uniqueFileEmails: [],
        matchedEmails: [],
        unmatchedEmails: [],
        groupMemberEmails: [],
        categoryMatches: [],
        unmatchedCategories: [],
        canProceed: false,
        error: err?.message || 'Failed to process file'
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      handleProcessFile(f);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      handleProcessFile(f);
    }
  };

  const handleEmailMapChange = (unmatchedEmail: string, targetEmail: string) => {
    setEmailMappings(prev => ({
      ...prev,
      [unmatchedEmail]: targetEmail
    }));
  };

  const handleCategoryModeToggle = (rawCat: string, mode: 'create' | 'map') => {
    setCategoryActions(prev => ({
      ...prev,
      [rawCat]: {
        mode,
        targetKey: mode === 'map' ? (prev[rawCat]?.targetKey || Object.keys(categories)[0] || 'other') : undefined
      }
    }));
  };

  const handleCategoryTargetChange = (rawCat: string, targetKey: string) => {
    setCategoryActions(prev => ({
      ...prev,
      [rawCat]: {
        mode: 'map',
        targetKey
      }
    }));
  };

  const handleConfirmImport = async () => {
    if (!validationResult || validationResult.validRows.length === 0) return;
    setIsImporting(true);
    setImportError(null);

    try {
      // 1. Build new categories to create in ledger
      const newCategoriesToCreate: Record<string, CategoryData> = {};
      const categoryResolutionMap: Record<string, string> = {};

      const existingKeys = new Set(Object.keys(categories).map(k => k.toLowerCase()));

      (validationResult.unmatchedCategories || []).forEach(rawCat => {
        const action = categoryActions[rawCat] || { mode: 'create' };
        if (action.mode === 'create') {
          // Normalize key name
          let baseKey = rawCat.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
          if (!baseKey) baseKey = 'cat';
          let finalKey = baseKey;
          let counter = 1;
          while (existingKeys.has(finalKey) || newCategoriesToCreate[finalKey]) {
            finalKey = `${baseKey}_${counter++}`;
          }

          // Title case display name
          const formattedTitle = rawCat
            .split(/[\s_-]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
            .trim() || 'Custom Category';

          newCategoriesToCreate[finalKey] = {
            name: formattedTitle,
            iconName: 'Tag',
            hex: '#1a73e8'
          };
          categoryResolutionMap[rawCat] = finalKey;
        } else if (action.mode === 'map' && action.targetKey) {
          categoryResolutionMap[rawCat] = action.targetKey;
        }
      });

      // 2. Finalize all rows with resolved payer and category
      const finalizedRows: ImportRowParsed[] = validationResult.validRows.map(row => {
        const mappedEmail = emailMappings[row.paidByEmail] || row.paidByEmail;
        const matchedMem = group?.members 
          ? Object.values(group.members).find(m => m.email.toLowerCase() === mappedEmail.toLowerCase())
          : undefined;

        let resolvedCategory = row.category;
        if (row.rawCategory && categoryResolutionMap[row.rawCategory]) {
          resolvedCategory = categoryResolutionMap[row.rawCategory];
        }

        return {
          ...row,
          category: resolvedCategory,
          paidByEmail: mappedEmail,
          matchedMember: matchedMem || row.matchedMember,
          isEmailMatched: true
        };
      });

      await onBatchImport(finalizedRows, Object.keys(newCategoriesToCreate).length > 0 ? newCategoriesToCreate : undefined);
      onClose();
    } catch (err: any) {
      console.error('Batch import failed:', err);
      setImportError(err?.message || 'Failed to import expenses. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  // Safe to return null after all hooks are evaluated
  if (!isOpen) return null;

  const canProceedWithImport = 
    Boolean(validationResult) && 
    validationResult!.validRows.length > 0 && 
    allUnmatchedEmailsResolved && 
    allUnmatchedCategoriesResolved && 
    !isImporting;

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
              Import Ledger
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Restore expenses into <span className="font-medium text-text-primary">{group?.name || 'this ledger'}</span>
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs no-scrollbar">
          {importError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 space-y-1 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <AlertCircle size={15} />
                <span>Import Failed</span>
              </div>
              <p className="text-[11px] leading-relaxed">{importError}</p>
            </div>
          )}

          {/* File Upload Zone as native accessible label */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all block ${
              dragOver
                ? 'border-google-blue bg-google-blue/5 scale-[1.01]'
                : file
                ? 'border-border bg-surface-hover/30 hover:border-google-blue/50'
                : 'border-border hover:border-google-blue hover:bg-surface-hover/50'
            }`}
          >
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              className="sr-only"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-google-blue/10 text-google-blue flex items-center justify-center shadow-xs">
                {file ? <FileSpreadsheet size={20} /> : <Upload size={20} />}
              </div>
              <div className="space-y-0.5">
                <p className="font-semibold text-text-primary text-xs">
                  {file ? file.name : 'Click to select CSV or Excel (.xlsx) file'}
                </p>
                <p className="text-[11px] text-text-secondary">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Or drag and drop your exported ledger file here'}
                </p>
              </div>
            </div>
          </label>

          {/* Loading Indicator */}
          {isParsing && (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-text-secondary">
              <Loader2 size={24} className="animate-spin text-google-blue" />
              <span className="text-xs">Parsing expenses and validating ledger records...</span>
            </div>
          )}

          {/* Validation & Verification Results */}
          {validationResult && !isParsing && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {validationResult.error ? (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs">
                    <AlertCircle size={15} />
                    <span>Import Error</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{validationResult.error}</p>
                </div>
              ) : (
                <>
                  {/* Ledger Metrics Preview */}
                  <div className="p-3.5 bg-surface-hover/40 rounded-2xl border border-border space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-text-primary">
                      <span>File Summary</span>
                      <span className="font-mono text-google-blue font-bold">
                        {validationResult.totalRows} {validationResult.totalRows === 1 ? 'Expense' : 'Expenses'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50 text-[11px]">
                      <div>
                        <span className="text-text-secondary block">Total Debit Amount</span>
                        <span className="font-mono font-bold text-text-primary text-sm">
                          ₹{validationResult.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-secondary block">Date Span</span>
                        <span className="font-medium text-text-primary">
                          {formatIndianDate(validationResult.dateRange.start) || 'N/A'} – {formatIndianDate(validationResult.dateRange.end) || 'N/A'}
                        </span>
                      </div>
                    </div>

                    {validationResult.totalAmount > 0 && (
                      <p className="text-[10px] italic text-text-secondary pt-1 border-t border-border/40">
                        INR {amountToIndianWords(validationResult.totalAmount)} Only
                      </p>
                    )}
                  </div>

                  {/* Member Email Verification Status */}
                  {validationResult.unmatchedEmails.length === 0 ? (
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-xs">
                        <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Member Email Verification Passed</span>
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">
                        All {validationResult.matchedEmails.length} email addresses in this file match verified members of <span className="font-semibold">{group?.name || 'this group'}</span>.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 space-y-3">
                      <div className="flex items-start gap-2">
                        <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <h4 className="font-semibold text-xs text-text-primary">
                            Unmatched Member Emails Found
                          </h4>
                          <p className="text-[11px] text-text-secondary leading-relaxed">
                            To ensure accounting integrity, all payers must belong to this ledger group. You can reassign them below:
                          </p>
                        </div>
                      </div>

                      {/* Remapping Controls */}
                      <div className="space-y-2 pt-1 border-t border-amber-500/20">
                        {validationResult.unmatchedEmails.map(unmatchedEmail => (
                          <div key={unmatchedEmail} className="bg-surface p-2.5 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400 truncate block">
                                {unmatchedEmail}
                              </span>
                              <span className="text-[10px] text-text-secondary">
                                Found in file expenses
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-text-secondary font-medium">Map to:</span>
                              <select
                                value={emailMappings[unmatchedEmail] || ''}
                                onChange={(e) => handleEmailMapChange(unmatchedEmail, e.target.value)}
                                className="h-8 px-2 rounded-lg bg-surface-hover border border-border text-xs text-text-primary font-medium focus:outline-hidden focus:border-google-blue cursor-pointer"
                              >
                                <option value="">Select Member...</option>
                                {availableGroupMembers.map(m => (
                                  <option key={m.email} value={m.email}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>

                      {allUnmatchedEmailsResolved && (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold pt-1">
                          <CheckCircle2 size={14} />
                          <span>All unmatched emails successfully reassigned.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Category Matching & Mapping Section */}
                  {validationResult.unmatchedCategories && validationResult.unmatchedCategories.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-google-blue/10 border border-google-blue/20 text-text-primary space-y-3">
                      <div className="flex items-start gap-2">
                        <Tag size={17} className="text-google-blue shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <h4 className="font-semibold text-xs text-text-primary">
                            New / Unmatched Categories ({validationResult.unmatchedCategories.length})
                          </h4>
                          <p className="text-[11px] text-text-secondary leading-relaxed">
                            Create these as new categories in this ledger, or map them to existing categories:
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-1 border-t border-google-blue/20">
                        {validationResult.unmatchedCategories.map(rawCat => {
                          const action = categoryActions[rawCat] || { mode: 'create' };
                          return (
                            <div key={rawCat} className="bg-surface p-2.5 rounded-xl border border-border space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-xs text-text-primary truncate">
                                  "{rawCat}"
                                </span>
                                <div className="inline-flex rounded-lg bg-surface-hover p-0.5 text-[10px] font-semibold shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleCategoryModeToggle(rawCat, 'create')}
                                    className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                                      action.mode === 'create'
                                        ? 'bg-google-blue text-white shadow-2xs'
                                        : 'text-text-secondary hover:text-text-primary'
                                    }`}
                                  >
                                    Create New
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCategoryModeToggle(rawCat, 'map')}
                                    className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                                      action.mode === 'map'
                                        ? 'bg-google-blue text-white shadow-2xs'
                                        : 'text-text-secondary hover:text-text-primary'
                                    }`}
                                  >
                                    Map to Existing
                                  </button>
                                </div>
                              </div>

                              {action.mode === 'create' ? (
                                <div className="text-[10px] text-text-secondary flex items-center gap-1.5">
                                  <FolderPlus size={12} className="text-google-blue shrink-0" />
                                  <span>Will be added to ledger as a new category</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <span className="text-[10px] text-text-secondary shrink-0 font-medium">Map to:</span>
                                  <select
                                    value={action.targetKey || ''}
                                    onChange={(e) => handleCategoryTargetChange(rawCat, e.target.value)}
                                    className="flex-1 h-7 px-2 rounded-lg bg-surface-hover border border-border text-xs text-text-primary font-medium focus:outline-hidden focus:border-google-blue cursor-pointer"
                                  >
                                    {Object.entries(categories).map(([k, cat]) => (
                                      <option key={k} value={k}>
                                        {cat.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Members in File Summary */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block">
                      Member Distribution
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {validationResult.uniqueFileEmails.map(email => {
                        const isMatched = validationResult.matchedEmails.includes(email) || Boolean(emailMappings[email]);
                        return (
                          <span 
                            key={email}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border ${
                              isMatched 
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                            }`}
                          >
                            <UserCheck size={11} />
                            <span>{email}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-border/70 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-full border border-border hover:bg-surface-hover text-text-secondary hover:text-text-primary text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!canProceedWithImport}
            onClick={handleConfirmImport}
            className="h-10 px-5 rounded-full bg-google-blue hover:bg-blue-700 active:scale-98 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            {isImporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Importing Ledger...</span>
              </>
            ) : (
              <>
                <Upload size={14} strokeWidth={2.2} />
                <span>
                  {validationResult ? `Import ${validationResult.totalRows} Expenses` : 'Import Ledger'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
