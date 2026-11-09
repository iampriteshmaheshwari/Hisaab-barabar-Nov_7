import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Check, 
  Trash2, 
  Plus, 
  ArrowRight,
  Calendar,
  Clock,
  Tag,
  ChevronDown,
  IndianRupee,
  X,
  AlertCircle,
  Pencil,
  AlertTriangle
} from 'lucide-react';
import type { ShoppingItem, UserRole, CategoryData } from '../../types';
import { EditShoppingModal } from '../modals/EditShoppingModal';

interface ShoppingTabProps {
  items: ShoppingItem[];
  categories?: Record<string, CategoryData>;
  userRole: UserRole;
  onAddItem: (name: string, options?: { category?: string; byWhen?: string }) => Promise<void>;
  onUpdateItem?: (itemId: string, updates: { name: string; category?: string; byWhen?: string }) => Promise<void>;
  onToggleItem: (item: ShoppingItem) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onConvertBoughtToExpense: (selectedItems: ShoppingItem[]) => void;
  groupName: string;
}

const DEFAULT_CATEGORIES: Record<string, CategoryData> = {
  groceries: { name: 'Groceries', hex: '#059669', color: '#059669', bg: '#05966914', iconName: 'ShoppingCart' },
  food: { name: 'Food & Dining', hex: '#EA580C', color: '#EA580C', bg: '#EA580C14', iconName: 'Utensils' },
  utilities: { name: 'Bills & Recharge', hex: '#D97706', color: '#D97706', bg: '#D9770614', iconName: 'Zap' },
  rent: { name: 'Home & Rent', hex: '#0D9488', color: '#0D9488', bg: '#0D948814', iconName: 'Home' },
  travel: { name: 'Travel & Petrol', hex: '#0284C7', color: '#0284C7', bg: '#0284C714', iconName: 'Car' },
  medical: { name: 'Health & Medicine', hex: '#DC2626', color: '#DC2626', bg: '#DC262614', iconName: 'HeartPulse' },
  shopping: { name: 'Shopping', hex: '#7C3AED', color: '#7C3AED', bg: '#7C3AED14', iconName: 'ShoppingBag' },
  education: { name: 'Education', hex: '#4F46E5', color: '#4F46E5', bg: '#4F46E514', iconName: 'BookOpen' },
  investments: { name: 'Investments & Loans', hex: '#2563EB', color: '#2563EB', bg: '#2563EB14', iconName: 'TrendingUp' },
  other: { name: 'Other', hex: '#64748B', color: '#64748B', bg: '#64748B14', iconName: 'Tag' }
};

export function ShoppingTab({
  items,
  categories = DEFAULT_CATEGORIES,
  userRole,
  onAddItem,
  onUpdateItem,
  onToggleItem,
  onDeleteItem,
  onConvertBoughtToExpense,
  groupName
}: ShoppingTabProps) {
  const [newItemName, setNewItemName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('other');
  const [byWhen, setByWhen] = useState('whenever');
  const [customDate, setCustomDate] = useState('');
  
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Edit item state
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);

  // Delete item confirmation state
  const [itemToDelete, setItemToDelete] = useState<ShoppingItem | null>(null);

  // Escape key handler for delete confirmation
  useEffect(() => {
    if (!itemToDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setItemToDelete(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [itemToDelete]);

  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const dateMenuRef = useRef<HTMLDivElement>(null);

  const canEdit = userRole === 'owner' || userRole === 'editor';
  const pendingItems = items.filter(i => i.status === 'pending');
  const boughtItems = items.filter(i => i.status === 'bought');

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setShowCategoryMenu(false);
      }
      if (dateMenuRef.current && !dateMenuRef.current.contains(e.target as Node)) {
        setShowDateMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newItemName.trim()) return;

    const trimmed = newItemName.trim();
    const catToUse = selectedCategory || 'other';
    const finalByWhen = byWhen === 'custom' ? (customDate || 'whenever') : byWhen;

    // Clear input field immediately for snappy, instantaneous UX
    setNewItemName('');
    setSelectedCategory('other');
    setByWhen('whenever');
    setCustomDate('');
    setShowCategoryMenu(false);
    setShowDateMenu(false);

    setIsAdding(true);
    try {
      await onAddItem(trimmed, {
        category: catToUse,
        byWhen: finalByWhen || 'whenever'
      });
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 900);
      inputRef.current?.focus();
    } catch (err) {
      console.warn('Error adding item:', err);
      setNewItemName(trimmed);
    } finally {
      setIsAdding(false);
    }
  };

  // Helper to format byWhen for display: clean, uniform, and 100% legible in both light and dark modes
  const getByWhenBadge = (val?: string) => {
    if (!val || val === 'whenever') return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    let label = val;
    let icon = <Calendar size={11} className="shrink-0 text-text-secondary" />;

    if (val === 'today' || val === todayStr) {
      label = 'Today';
      icon = <Clock size={11} className="shrink-0 text-amber-500" />;
    } else if (val === 'tomorrow' || val === tomorrowStr) {
      label = 'Tomorrow';
      icon = <Calendar size={11} className="shrink-0 text-blue-500" />;
    } else if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const isPast = val < todayStr;
      const parsedDate = new Date(val + 'T00:00:00');
      const formatted = isNaN(parsedDate.getTime())
        ? val
        : parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      label = isPast ? `Overdue: ${formatted}` : formatted;
      icon = isPast ? (
        <AlertCircle size={11} className="shrink-0 text-red-500" />
      ) : (
        <Calendar size={11} className="shrink-0 text-text-secondary" />
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary bg-surface-hover px-2.5 py-0.5 rounded-full border border-border">
        {icon}
        <span className="text-text-primary font-medium">{label}</span>
      </span>
    );
  };

  const currentCategoryData = categories[selectedCategory] || { name: 'Other', hex: '#AB47BC' };

  const getByWhenLabel = () => {
    if (byWhen === 'whenever') return 'Whenever possible';
    if (byWhen === 'today') return 'Today';
    if (byWhen === 'tomorrow') return 'Tomorrow';
    if (byWhen === 'custom') {
      if (!customDate) return 'Pick a date';
      const d = new Date(customDate + 'T00:00:00');
      return isNaN(d.getTime()) ? customDate : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
    return byWhen;
  };

  const todayIso = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4 pb-4 font-sans">
      {/* Add Item Card with Category and By When Pickers */}
      {canEdit && (
        <div className="bg-surface rounded-2xl sm:rounded-3xl border border-border shadow-xs p-3 sm:p-3.5 space-y-2.5 transition-all">
          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              required
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={`Add item to ${groupName}...`}
              className="flex-1 px-3 py-2 bg-transparent text-base sm:text-sm text-text-primary placeholder:text-text-secondary outline-none font-medium"
            />
            <button
              type="submit"
              disabled={isAdding || !newItemName.trim()}
              className={`w-8 h-8 rounded-full disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0 active:scale-95 ${
                justAdded ? 'bg-emerald-600 scale-105' : 'bg-google-blue hover:bg-google-blue-hover'
              }`}
              title={justAdded ? 'Added!' : 'Add item'}
              aria-label={justAdded ? 'Item added' : 'Add item'}
            >
              {justAdded ? (
                <Check size={16} strokeWidth={2.5} className="animate-in zoom-in-75 duration-150" />
              ) : (
                <Plus size={16} />
              )}
            </button>
          </form>

          {/* Quick Attribute Options: Category & By-When (Apple Reminders / Google Keep style) */}
          <div className="flex items-center gap-2 pt-1 border-t border-border/60 text-xs flex-wrap">
            {/* Category Selector Pill */}
            <div className="relative" ref={categoryMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryMenu(!showCategoryMenu);
                  setShowDateMenu(false);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors cursor-pointer select-none text-xs ${
                  selectedCategory !== 'other'
                    ? 'border-google-blue/40 bg-google-blue/5 text-text-primary font-medium'
                    : 'border-border bg-surface-hover/70 text-text-secondary hover:text-text-primary'
                }`}
              >
                <span 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: currentCategoryData.hex || '#AB47BC' }} 
                />
                <span className="truncate max-w-[110px] sm:max-w-[160px] md:max-w-[200px]">{currentCategoryData.name}</span>
                <ChevronDown size={12} className="text-text-secondary shrink-0" />
              </button>

              {/* Category Dropdown */}
              {showCategoryMenu && (
                <div className="absolute left-0 top-full mt-1.5 w-48 bg-surface rounded-2xl shadow-xl border border-border p-1.5 z-30 space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Item Category
                  </div>
                  {Object.entries(categories).map(([key, cat]) => {
                    const isSelected = selectedCategory === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(key);
                          setShowCategoryMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                          isSelected 
                            ? 'bg-google-blue/10 text-google-blue font-medium' 
                            : 'text-text-primary hover:bg-surface-hover'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span 
                            className="w-2 h-2 rounded-full shrink-0" 
                            style={{ backgroundColor: cat.hex }} 
                          />
                          <span className="truncate">{cat.name}</span>
                        </div>
                        {isSelected && <Check size={13} className="shrink-0 text-google-blue" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* By When Date Selector Pill */}
            <div className="relative" ref={dateMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setShowDateMenu(!showDateMenu);
                  setShowCategoryMenu(false);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors cursor-pointer select-none text-xs ${
                  byWhen !== 'whenever'
                    ? 'border-google-blue/40 bg-google-blue/5 text-google-blue font-medium'
                    : 'border-border bg-surface-hover/70 text-text-secondary hover:text-text-primary'
                }`}
              >
                <Calendar size={12} className={byWhen !== 'whenever' ? 'text-google-blue' : 'text-text-secondary'} />
                <span className="truncate max-w-[130px] sm:max-w-[180px] md:max-w-[220px]">{getByWhenLabel()}</span>
                <ChevronDown size={12} className="text-text-secondary shrink-0" />
              </button>

              {/* By When Dropdown */}
              {showDateMenu && (
                <div className="absolute left-0 top-full mt-1.5 w-56 bg-surface rounded-2xl shadow-xl border border-border p-2 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-0.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    By When
                  </div>

                  {/* Preset: Whenever possible */}
                  <button
                    type="button"
                    onClick={() => {
                      setByWhen('whenever');
                      setCustomDate('');
                      setShowDateMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                      byWhen === 'whenever' 
                        ? 'bg-google-blue/10 text-google-blue font-medium' 
                        : 'text-text-primary hover:bg-surface-hover'
                    }`}
                  >
                    <span>Whenever possible</span>
                    {byWhen === 'whenever' && <Check size={13} className="text-google-blue" />}
                  </button>

                  {/* Preset: Today */}
                  <button
                    type="button"
                    onClick={() => {
                      setByWhen('today');
                      setCustomDate('');
                      setShowDateMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                      byWhen === 'today' 
                        ? 'bg-google-blue/10 text-google-blue font-medium' 
                        : 'text-text-primary hover:bg-surface-hover'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} className="text-amber-500" />
                      <span>Today</span>
                    </span>
                    {byWhen === 'today' && <Check size={13} className="text-google-blue" />}
                  </button>

                  {/* Preset: Tomorrow */}
                  <button
                    type="button"
                    onClick={() => {
                      setByWhen('tomorrow');
                      setCustomDate('');
                      setShowDateMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                      byWhen === 'tomorrow' 
                        ? 'bg-google-blue/10 text-google-blue font-medium' 
                        : 'text-text-primary hover:bg-surface-hover'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-blue-500" />
                      <span>Tomorrow</span>
                    </span>
                    {byWhen === 'tomorrow' && <Check size={13} className="text-google-blue" />}
                  </button>

                  {/* Specific calendar date */}
                  <div className="pt-1 border-t border-border/60">
                    <div className="px-2 py-1 text-xs text-text-secondary font-medium">
                      Pick specific date:
                    </div>
                    <div className="px-2">
                      <input
                        type="date"
                        min={todayIso}
                        value={customDate}
                        onChange={(e) => {
                          setCustomDate(e.target.value);
                          if (e.target.value) {
                            setByWhen('custom');
                          }
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-surface text-text-primary text-xs outline-none focus:border-google-blue transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reset custom date button if set */}
            {byWhen !== 'whenever' && (
              <button
                type="button"
                onClick={() => {
                  setByWhen('whenever');
                  setCustomDate('');
                }}
                className="text-text-secondary hover:text-text-primary p-0.5 rounded-full hover:bg-surface-hover transition-colors cursor-pointer"
                title="Reset to whenever possible"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Convert Bought to Expense Bar */}
      {canEdit && boughtItems.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border p-3.5 sm:p-4 shadow-xs flex items-center justify-between gap-3 transition-all animate-in fade-in duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0">
              <IndianRupee size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <span>{boughtItems.length} purchased item{boughtItems.length > 1 ? 's' : ''}</span>
              </div>
              <p className="text-xs text-text-secondary leading-tight mt-0.5">
                Ready to log into ledger
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onConvertBoughtToExpense(boughtItems)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-google-blue hover:bg-google-blue-hover text-white text-xs font-medium shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <span>Log expense</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Pending Items List */}
      <div className="space-y-2">
        <div className="px-1 text-xs font-semibold uppercase tracking-tight text-text-secondary">
          To Buy ({pendingItems.length})
        </div>

        {pendingItems.length === 0 ? (
          <div className="py-12 text-center bg-surface rounded-3xl border border-border text-xs text-text-secondary">
            Everything is bought!
          </div>
        ) : (
          <div className="bg-surface rounded-3xl border border-border divide-y divide-border overflow-hidden shadow-xs">
            {pendingItems.map((item) => {
              const itemCat = categories[item.category || 'other'] || { name: 'Other', hex: '#AB47BC' };
              const byWhenBadge = getByWhenBadge(item.byWhen);

              return (
                <div
                  key={item.id}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-surface-hover/50 transition-colors group"
                >
                  {/* Left: Dedicated Checkbox to mark complete */}
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => canEdit && onToggleItem(item)}
                    className="w-5 h-5 rounded-full border-2 border-border hover:border-google-blue focus:outline-none transition-colors flex items-center justify-center shrink-0 mt-0.5 cursor-pointer disabled:cursor-default"
                    title="Mark bought"
                    aria-label={`Mark ${item.name} bought`}
                  />

                  {/* Middle: Content area - clicking opens Edit modal */}
                  <div 
                    className={`min-w-0 flex-1 ${canEdit ? 'cursor-pointer select-none' : ''}`}
                    onClick={() => canEdit && setEditingItem(item)}
                    title={canEdit ? 'Click to edit item' : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-medium text-text-primary block truncate hover:text-google-blue transition-colors">
                        {item.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {/* Category tag */}
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary bg-surface-hover px-2.5 py-0.5 rounded-full border border-border">
                        <span 
                          className="w-1.5 h-1.5 rounded-full shrink-0" 
                          style={{ backgroundColor: itemCat.hex }} 
                        />
                        <span>{itemCat.name}</span>
                      </span>

                      {/* By When tag */}
                      {byWhenBadge}
                    </div>
                  </div>

                  {/* Right: Actions (Edit & Delete) */}
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        className="p-1.5 text-text-secondary hover:text-google-blue hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                        title="Edit item"
                        aria-label="Edit item"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        className="p-1.5 text-text-secondary hover:text-google-red hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                        title="Delete item"
                        aria-label="Delete item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Items */}
      {boughtItems.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="px-1 text-xs font-semibold uppercase tracking-tight text-text-secondary">
            Completed ({boughtItems.length})
          </div>

          <div className="bg-surface rounded-3xl border border-border divide-y divide-border overflow-hidden opacity-85">
            {boughtItems.map((item) => {
              const itemCat = categories[item.category || 'other'] || { name: 'Other', hex: '#AB47BC' };
              return (
                <div
                  key={item.id}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-surface-hover/50 transition-colors"
                >
                  {/* Left: Dedicated Checkbox to uncheck / mark pending */}
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => canEdit && onToggleItem(item)}
                    className="w-5 h-5 rounded-full bg-google-blue text-white flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-default shadow-xs"
                    title="Mark uncompleted"
                    aria-label={`Unmark ${item.name}`}
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>

                  {/* Middle: Content - Clicking allows viewing/editing */}
                  <div 
                    className={`min-w-0 flex-1 ${canEdit ? 'cursor-pointer select-none' : ''}`}
                    onClick={() => canEdit && setEditingItem(item)}
                    title={canEdit ? 'Click to edit item' : undefined}
                  >
                    <span className="text-sm sm:text-base text-text-secondary line-through truncate block">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs text-text-secondary flex items-center gap-1.5">
                        <span 
                          className="w-1.5 h-1.5 rounded-full shrink-0 opacity-60" 
                          style={{ backgroundColor: itemCat.hex }} 
                        />
                        <span>{itemCat.name}</span>
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions (Edit & Delete) */}
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        className="p-1.5 text-text-secondary hover:text-google-blue hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                        title="Edit item"
                        aria-label="Edit item"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        className="p-1.5 text-text-secondary hover:text-google-red hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                        title="Delete item"
                        aria-label="Delete item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Shopping Item Modal */}
      {editingItem && (
        <EditShoppingModal
          isOpen={!!editingItem}
          item={editingItem}
          categories={categories}
          onClose={() => setEditingItem(null)}
          onSave={async (itemId, updates) => {
            if (onUpdateItem) {
              await onUpdateItem(itemId, updates);
            }
          }}
        />
      )}

      {/* Delete Shopping Item Confirmation Modal (Native Apple/Google style) */}
      {itemToDelete && typeof document !== 'undefined' && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[100] w-screen h-screen min-h-[100dvh] bg-black/15 dark:bg-black/35 backdrop-blur-[5px] transition-all duration-200 animate-in fade-in cursor-pointer select-none touch-none"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setItemToDelete(null);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setItemToDelete(null);
            }}
            aria-hidden="true"
          />
          <div 
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 select-none pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-item-dialog-title"
          >
            <div 
              className="w-full max-w-xs bg-surface border border-border shadow-2xl rounded-3xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5 dark:ring-white/10 pointer-events-auto text-left font-sans"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-google-red flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} strokeWidth={2.2} />
                </div>
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="w-7 h-7 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="Cancel"
                  aria-label="Cancel"
                >
                  <X size={15} strokeWidth={2.2} />
                </button>
              </div>

              <div className="space-y-1">
                <h4 id="delete-item-dialog-title" className="text-sm sm:text-base font-semibold text-text-primary">
                  Delete Shopping Item?
                </h4>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-text-primary">"{itemToDelete.name}"</span>? This cannot be undone.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 h-9.5 rounded-xl border border-border hover:bg-surface-hover text-text-secondary hover:text-text-primary text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = itemToDelete.id;
                    setItemToDelete(null);
                    onDeleteItem(id);
                  }}
                  className="flex-1 h-9.5 rounded-xl bg-google-red hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Trash2 size={14} strokeWidth={2} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
