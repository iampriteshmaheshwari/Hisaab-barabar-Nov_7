import React, { useState, useMemo } from 'react';
import { 
  X, 
  Check, 
  Trash2, 
  Tag, 
  AlertTriangle, 
  Lock, 
  Plus, 
  Layers, 
  Pencil,
  Search,
  ShoppingCart,
  Zap,
  TrendingUp,
  Plane,
  Utensils,
  Coffee,
  Home,
  Car,
  ShoppingBag,
  Dumbbell,
  Film,
  HeartPulse,
  Gift,
  BookOpen,
  Briefcase,
  Loader2,
  Info,
  Sparkles,
  Bike,
  Music,
  Gamepad2,
  Heart,
  Wrench,
  Baby,
  Palette,
  Trophy
} from 'lucide-react';
import type { CategoryData, Transaction, ShoppingItem, RecurringExpense, UserRole } from '../../types';
import { formatINR } from '../../utils/formatUtils';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (catKey: string, data: CategoryData) => void;
  onDelete?: (catKey: string) => Promise<void> | void;
  existingCategories?: Record<string, CategoryData>;
  transactions?: Transaction[];
  shoppingItems?: ShoppingItem[];
  recurringExpenses?: RecurringExpense[];
  initialTab?: 'manage' | 'add';
  groupName?: string;
  userRole?: UserRole;
}

const COLOR_PALETTE = [
  '#DB2777', // Vivid Pink
  '#9333EA', // Deep Purple
  '#06B6D4', // Fresh Mint / Cyan
  '#E11D48', // Bright Coral
  '#D946EF', // Electric Fuchsia
  '#84CC16', // Fresh Lime
  '#6366F1', // Indigo / Periwinkle
  '#CA8A04', // Saffron / Gold
  '#0891B2', // Deep Ocean
  '#10B981', // Emerald Mint
  '#F97316', // Bright Tangerine
  '#8B5CF6', // Soft Lavender
  '#0B57D0', // Royal Blue
  '#B45309', // Terracotta Bronze
  '#475569', // Charcoal Slate
  '#059669'  // Classic Green
];

const PRESET_KEYS = [
  'groceries',
  'food',
  'utilities',
  'rent',
  'travel',
  'medical',
  'shopping',
  'education',
  'investments',
  'other'
];

export const ICON_MAP: Record<string, any> = {
  // Built-in categories
  ShoppingCart,
  Utensils,
  Zap,
  Home,
  Car,
  HeartPulse,
  ShoppingBag,
  BookOpen,
  TrendingUp,
  Tag,
  // Custom categories library
  Dumbbell,
  Plane,
  Coffee,
  Film,
  Sparkles,
  Gift,
  Briefcase,
  Bike,
  Music,
  Gamepad2,
  Heart,
  Wrench,
  Baby,
  Palette,
  Trophy
};

// Rich, expressive icon library tailored specifically for creating custom categories
const POPULAR_ICONS = [
  { name: 'Dumbbell', label: 'Gym & Fitness' },
  { name: 'Plane', label: 'Vacations & Trips' },
  { name: 'Coffee', label: 'Cafe & Hangouts' },
  { name: 'Film', label: 'Movies & OTT' },
  { name: 'Sparkles', label: 'Beauty & Salon' },
  { name: 'Gift', label: 'Gifts & Pooja' },
  { name: 'Briefcase', label: 'Work & Office' },
  { name: 'Bike', label: 'Bike & Scooter' },
  { name: 'Music', label: 'Music & Hobbies' },
  { name: 'Gamepad2', label: 'Gaming & Fun' },
  { name: 'Heart', label: 'Charity & Donations' },
  { name: 'Wrench', label: 'Repairs & Tools' },
  { name: 'Baby', label: 'Kids & Family' },
  { name: 'Palette', label: 'Art & Craft' },
  { name: 'Trophy', label: 'Sports & Games' },
  { name: 'Tag', label: 'General / Custom' }
];

export function getSmartCategoryIcon(name: string, explicitIcon?: string): string {
  if (explicitIcon && ICON_MAP[explicitIcon]) return explicitIcon;
  const lower = name.toLowerCase().trim();
  if (lower.includes('gym') || lower.includes('fit') || lower.includes('workout') || lower.includes('yoga') || lower.includes('exercise')) return 'Dumbbell';
  if (lower.includes('flight') || lower.includes('trip') || lower.includes('vacation') || lower.includes('tour') || lower.includes('pune') || lower.includes('mumbai') || lower.includes('goa') || lower.includes('hotel')) return 'Plane';
  if (lower.includes('cafe') || lower.includes('coffee') || lower.includes('tea') || lower.includes('chai') || lower.includes('starbucks')) return 'Coffee';
  if (lower.includes('movie') || lower.includes('cinema') || lower.includes('film') || lower.includes('netflix') || lower.includes('prime') || lower.includes('hotstar') || lower.includes('theatre')) return 'Film';
  if (lower.includes('personal') || lower.includes('salon') || lower.includes('parlour') || lower.includes('groom') || lower.includes('beauty') || lower.includes('haircut') || lower.includes('spa')) return 'Sparkles';
  if (lower.includes('pooja') || lower.includes('puja') || lower.includes('mandir') || lower.includes('gift') || lower.includes('shagun') || lower.includes('lifafa') || lower.includes('festival') || lower.includes('diwali') || lower.includes('rakhi')) return 'Gift';
  if (lower.includes('work') || lower.includes('office') || lower.includes('freelance') || lower.includes('client') || lower.includes('business')) return 'Briefcase';
  if (lower.includes('bike') || lower.includes('scooter') || lower.includes('motorcycle') || lower.includes('bullet') || lower.includes('activa')) return 'Bike';
  if (lower.includes('music') || lower.includes('concert') || lower.includes('song') || lower.includes('spotify') || lower.includes('guitar')) return 'Music';
  if (lower.includes('game') || lower.includes('gaming') || lower.includes('playstation') || lower.includes('xbox') || lower.includes('esport')) return 'Gamepad2';
  if (lower.includes('charity') || lower.includes('donation') || lower.includes('ngo') || lower.includes('fund') || lower.includes('help')) return 'Heart';
  if (lower.includes('repair') || lower.includes('tool') || lower.includes('service') || lower.includes('mechanic') || lower.includes('hardware')) return 'Wrench';
  if (lower.includes('baby') || lower.includes('kid') || lower.includes('child') || lower.includes('diaper') || lower.includes('toy')) return 'Baby';
  if (lower.includes('art') || lower.includes('craft') || lower.includes('paint') || lower.includes('drawing') || lower.includes('hobby')) return 'Palette';
  if (lower.includes('sport') || lower.includes('cricket') || lower.includes('football') || lower.includes('badminton') || lower.includes('trophy')) return 'Trophy';
  if (lower.includes('grocer') || lower.includes('kirana') || lower.includes('ration') || lower.includes('supermarket') || lower.includes('market') || lower.includes('sabzi') || lower.includes('vegetable')) return 'ShoppingCart';
  if (lower.includes('food') || lower.includes('dining') || lower.includes('restaurant') || lower.includes('eat') || lower.includes('swiggy') || lower.includes('zomato') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('snack') || lower.includes('mithai')) return 'Utensils';
  if (lower.includes('utilit') || lower.includes('electric') || lower.includes('bijli') || lower.includes('bill') || lower.includes('power') || lower.includes('water') || lower.includes('recharge') || lower.includes('wifi') || lower.includes('gas') || lower.includes('cylinder')) return 'Zap';
  if (lower.includes('rent') || lower.includes('maintenance') || lower.includes('home') || lower.includes('house') || lower.includes('flat') || lower.includes('stay') || lower.includes('pg') || lower.includes('maid') || lower.includes('cook') || lower.includes('bai')) return 'Home';
  if (lower.includes('travel') || lower.includes('commute') || lower.includes('petrol') || lower.includes('fuel') || lower.includes('diesel') || lower.includes('auto') || lower.includes('cab') || lower.includes('uber') || lower.includes('ola') || lower.includes('rapido') || lower.includes('metro') || lower.includes('fastag') || lower.includes('toll')) return 'Car';
  if (lower.includes('health') || lower.includes('medic') || lower.includes('doctor') || lower.includes('chemist') || lower.includes('hospital') || lower.includes('clinic') || lower.includes('dawai') || lower.includes('tablet')) return 'HeartPulse';
  if (lower.includes('shop') || lower.includes('clothes') || lower.includes('cloth') || lower.includes('amazon') || lower.includes('flipkart') || lower.includes('myntra') || lower.includes('meesho') || lower.includes('shoes')) return 'ShoppingBag';
  if (lower.includes('educat') || lower.includes('fee') || lower.includes('school') || lower.includes('college') || lower.includes('tuition') || lower.includes('coaching') || lower.includes('book') || lower.includes('stationery')) return 'BookOpen';
  if (lower.includes('invest') || lower.includes('emi') || lower.includes('sip') || lower.includes('mutual') || lower.includes('stock') || lower.includes('insurance') || lower.includes('lic') || lower.includes('gold')) return 'TrendingUp';
  return 'Tag';
}

export function CategoryModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  existingCategories = {},
  transactions = [],
  shoppingItems = [],
  recurringExpenses = [],
  initialTab = 'manage',
  groupName,
  userRole = 'owner'
}: CategoryModalProps) {
  const [activeTab, setActiveTab] = useState<'manage' | 'add'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create / Edit form states
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [hex, setHex] = useState(COLOR_PALETTE[0]);
  const [selectedIcon, setSelectedIcon] = useState('Tag');
  const [formError, setFormError] = useState<string | null>(null);
  
  // Deletion state
  const [deleteTargetKey, setDeleteTargetKey] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync initial tab and reset when opening
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setEditingKey(null);
      setName('');
      setHex(COLOR_PALETTE[0]);
      setSelectedIcon('Tag');
      setFormError(null);
      setDeleteTargetKey(null);
      setIsDeleting(false);
      setSearchQuery('');
    }
  }, [isOpen, initialTab]);

  // When name changes, auto-suggest icon if user hasn't explicitly customized it
  const handleNameChange = (val: string) => {
    setName(val);
    setFormError(null);
    if (!editingKey) {
      const suggested = getSmartCategoryIcon(val);
      setSelectedIcon(suggested);
    }
  };

  // Usage & Spend statistics for each category key
  const { categoryStats, totalLedgerSpend } = useMemo(() => {
    const stats: Record<string, { txCount: number; spend: number; shopCount: number; recCount: number; totalCount: number }> = {};
    let totalSpend = 0;

    Object.keys(existingCategories).forEach(key => {
      stats[key] = { txCount: 0, spend: 0, shopCount: 0, recCount: 0, totalCount: 0 };
    });

    transactions.forEach(t => {
      const k = t.category || 'other';
      if (!stats[k]) stats[k] = { txCount: 0, spend: 0, shopCount: 0, recCount: 0, totalCount: 0 };
      stats[k].txCount++;
      stats[k].totalCount++;
      const amt = Number(t.amount) || 0;
      stats[k].spend += amt;
      totalSpend += amt;
    });

    shoppingItems.forEach(s => {
      const k = s.category || 'other';
      if (!stats[k]) stats[k] = { txCount: 0, spend: 0, shopCount: 0, recCount: 0, totalCount: 0 };
      stats[k].shopCount++;
      stats[k].totalCount++;
    });

    recurringExpenses.forEach(r => {
      const k = r.category || 'other';
      if (!stats[k]) stats[k] = { txCount: 0, spend: 0, shopCount: 0, recCount: 0, totalCount: 0 };
      stats[k].recCount++;
      stats[k].totalCount++;
    });

    return { categoryStats: stats, totalLedgerSpend: totalSpend };
  }, [existingCategories, transactions, shoppingItems, recurringExpenses]);

  if (!isOpen) return null;

  // Split into Custom vs Built-in categories
  const allCategoryEntries = Object.entries(existingCategories);
  const customCategories = allCategoryEntries.filter(([k]) => !PRESET_KEYS.includes(k));
  const presetCategories = allCategoryEntries.filter(([k]) => PRESET_KEYS.includes(k));

  // Filter based on search query
  const matchesSearch = (key: string, cat: CategoryData) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return cat.name.toLowerCase().includes(q) || key.toLowerCase().includes(q);
  };

  const filteredCustom = customCategories.filter(([k, c]) => matchesSearch(k, c));
  const filteredPresets = presetCategories.filter(([k, c]) => matchesSearch(k, c));

  const startEditCategory = (key: string) => {
    const cat = existingCategories[key];
    if (!cat) return;
    setEditingKey(key);
    setName(cat.name);
    setHex(cat.hex || COLOR_PALETTE[0]);
    setSelectedIcon(cat.iconName || getSmartCategoryIcon(cat.name));
    setActiveTab('add');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    // Check for duplicate category name within this ledger
    const lowerName = cleanName.toLowerCase();
    const duplicateEntry = Object.entries(existingCategories).find(
      ([k, c]) => k !== editingKey && c.name.trim().toLowerCase() === lowerName
    );

    if (duplicateEntry) {
      setFormError(`"${duplicateEntry[1].name}" already exists in ${groupName || 'this ledger'}`);
      return;
    }

    setFormError(null);

    let key = editingKey;
    if (!key) {
      key = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      if (!key) key = `cat_${Date.now()}`;
      if (existingCategories[key]) {
        key = `${key}_${Date.now().toString(36).substring(2, 6)}`;
      }
    }

    onSave(key, {
      name: cleanName,
      iconName: selectedIcon || getSmartCategoryIcon(cleanName),
      hex,
      color: hex,
      bg: `${hex}14`
    });

    setName('');
    setEditingKey(null);
    setFormError(null);
    setActiveTab('manage');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetKey || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteTargetKey);
      setDeleteTargetKey(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteTargetData = deleteTargetKey ? existingCategories[deleteTargetKey] : null;
  const deleteTargetUsage = deleteTargetKey ? (categoryStats[deleteTargetKey] || { txCount: 0, spend: 0, shopCount: 0, recCount: 0, totalCount: 0 }) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
      <div 
        className="bg-surface w-full sm:max-w-md md:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom duration-200 font-sans flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle for Mobile */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        {/* Modal Header (Apple & Material 3 Clean Surface) */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0">
              <Layers size={18} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-text-primary leading-tight">
                  {editingKey ? 'Edit Category' : 'Categories'}
                </h2>
                {groupName && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-google-blue/10 text-google-blue truncate max-w-[120px] sm:max-w-[180px]">
                    {groupName}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary truncate mt-0.5">
                {editingKey ? 'Update name, icon and color' : `Shared with all members in ${groupName || 'this ledger'}`}
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Segmented Pill Selector (Apple HIG / Material 3) */}
        <div className="p-3 bg-surface-hover/20 border-b border-border">
          <div className="flex p-1 rounded-2xl bg-surface-hover/60 border border-border/60">
            <button
              type="button"
              onClick={() => { 
                setActiveTab('manage'); 
                setEditingKey(null);
                setDeleteTargetKey(null); 
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'manage'
                  ? 'bg-surface text-text-primary shadow-xs font-bold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>Categories</span>
              <span className={`px-2 py-0.2 rounded-full text-[11px] ${
                activeTab === 'manage' ? 'bg-google-blue/10 text-google-blue' : 'bg-surface-hover text-text-secondary'
              }`}>
                {allCategoryEntries.length}
              </span>
            </button>

            {userRole !== 'viewer' ? (
              <button
                type="button"
                onClick={() => { 
                  setActiveTab('add'); 
                  setEditingKey(null);
                  setName('');
                  setHex(COLOR_PALETTE[0]);
                  setSelectedIcon('Dumbbell');
                  setDeleteTargetKey(null); 
                }}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'add'
                    ? 'bg-surface text-text-primary shadow-xs font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>{editingKey ? 'Edit' : 'New Category'}</span>
              </button>
            ) : (
              <div 
                className="flex-1 py-1.5 px-3 text-xs text-text-secondary flex items-center justify-center gap-1.5 select-none"
                title="Only ledger members and admins can add categories"
              >
                <Lock size={12} className="text-text-secondary" />
                <span>View only</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-5 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
          {activeTab === 'manage' ? (
            <div className="space-y-4">
              {/* Optional Search if 5+ categories */}
              {allCategoryEntries.length >= 5 && (
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search categories..."
                    className="w-full pl-9 pr-8 py-2 rounded-2xl bg-surface-hover/50 border border-border text-xs text-text-primary outline-none focus:border-google-blue transition-colors"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary p-1 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              )}

              {/* Section 1: Custom Categories */}
              {customCategories.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-tight">
                      My Custom Categories ({customCategories.length})
                    </span>
                  </div>

                  <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden shadow-2xs">
                    {filteredCustom.length === 0 ? (
                      <div className="p-4 text-center text-xs text-text-secondary">
                        No custom categories match "{searchQuery}"
                      </div>
                    ) : (
                      filteredCustom.map(([key, cat]) => {
                        const iconKey = cat.iconName || getSmartCategoryIcon(cat.name);
                        const IconComponent = ICON_MAP[iconKey] || Tag;
                        const stats = categoryStats[key] || { txCount: 0, spend: 0, shopCount: 0, recCount: 0, totalCount: 0 };

                        return (
                          <div
                            key={key}
                            className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-surface-hover/30 transition-colors group"
                          >
                            {/* Left: Icon Squircle + Category Info */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div 
                                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                                style={{ backgroundColor: `${cat.hex}18`, color: cat.hex }}
                              >
                                <IconComponent size={18} strokeWidth={2} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-text-primary truncate">
                                    {cat.name}
                                  </span>
                                </div>

                                <div className="text-xs text-text-secondary flex items-center gap-1.5 mt-0.5">
                                  {stats.txCount > 0 ? (
                                    <>
                                      <span className="font-semibold text-text-primary">
                                        {formatINR(stats.spend, { symbol: true })}
                                      </span>
                                      <span>·</span>
                                      <span>
                                        {stats.txCount} {stats.txCount === 1 ? 'expense' : 'expenses'}
                                      </span>
                                    </>
                                  ) : stats.totalCount > 0 ? (
                                    <span>
                                      {stats.shopCount > 0 && `${stats.shopCount} in shopping`}
                                      {stats.shopCount > 0 && stats.recCount > 0 && ' · '}
                                      {stats.recCount > 0 && `${stats.recCount} recurring`}
                                    </span>
                                  ) : (
                                    <span className="text-text-secondary/70">No expenses yet</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right: Inline Edit and Delete Actions */}
                            {userRole !== 'viewer' && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => startEditCategory(key)}
                                  className="w-8 h-8 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer"
                                  title={`Edit ${cat.name}`}
                                >
                                  <Pencil size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeleteTargetKey(key)}
                                  className="w-8 h-8 rounded-xl text-text-secondary hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors cursor-pointer"
                                  title={`Delete ${cat.name}`}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Section 2: Built-in System Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-tight">
                    Built-in Categories
                  </span>
                  <span className="text-[11px] text-text-secondary/80">
                    Always available
                  </span>
                </div>

                <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden shadow-2xs">
                  {filteredPresets.map(([key, cat]) => {
                    const isOther = key === 'other';
                    const iconKey = cat.iconName || (isOther ? 'Tag' : getSmartCategoryIcon(cat.name));
                    const IconComponent = ICON_MAP[iconKey] || Tag;
                    const stats = categoryStats[key] || { txCount: 0, spend: 0, shopCount: 0, recCount: 0, totalCount: 0 };

                    return (
                      <div
                        key={key}
                        className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-surface-hover/30 transition-colors"
                      >
                        {/* Left: Icon + Name */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div 
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                            style={{ backgroundColor: `${cat.hex}18`, color: cat.hex }}
                          >
                            <IconComponent size={18} strokeWidth={2} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-text-primary truncate">
                                {cat.name}
                              </span>
                              {isOther && (
                                <span className="px-1.5 py-0.2 rounded-md text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                  Default Fallback
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-text-secondary flex items-center gap-1.5 mt-0.5">
                              {stats.txCount > 0 ? (
                                <>
                                  <span className="font-semibold text-text-primary">
                                    {formatINR(stats.spend, { symbol: true })}
                                  </span>
                                  <span>·</span>
                                  <span>
                                    {stats.txCount} {stats.txCount === 1 ? 'expense' : 'expenses'}
                                  </span>
                                </>
                              ) : stats.totalCount > 0 ? (
                                <span>
                                  {stats.shopCount > 0 && `${stats.shopCount} in shopping`}
                                  {stats.shopCount > 0 && stats.recCount > 0 && ' · '}
                                  {stats.recCount > 0 && `${stats.recCount} recurring`}
                                </span>
                              ) : (
                                <span className="text-text-secondary/70">No expenses recorded</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Protected badge / info */}
                        <div className="flex items-center gap-1 shrink-0 text-text-secondary/50">
                          {isOther ? (
                            <div 
                              className="px-2 py-1 rounded-lg text-[11px] font-medium text-text-secondary/60 flex items-center gap-1"
                              title="Protected fallback for uncategorized or reassigned expenses"
                            >
                              <Lock size={12} />
                              <span className="hidden sm:inline">Protected</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditCategory(key)}
                              className="w-8 h-8 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer"
                              title={`Customize ${cat.name}`}
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Gentle Footnote (Apple HIG style) */}
              <div className="pt-1 px-1 flex items-start gap-2 text-[11px] text-text-secondary leading-relaxed">
                <Info size={13} className="shrink-0 text-text-secondary/70 mt-0.5" />
                <span>
                  Deleting any custom category automatically reassigns its records to <strong>Other</strong> so your balances and ledger history remain accurate.
                </span>
              </div>
            </div>
          ) : (
            /* Create / Edit Category Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category Name Input */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-tight mb-1.5">
                  Category Name
                </label>
                <input
                  required
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Gym & Fitness, Vacation, Pets, Charity"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-hover/60 border border-border text-sm text-text-primary outline-none focus:border-google-blue focus:ring-1 focus:ring-google-blue transition-all"
                  maxLength={26}
                />
              </div>

              {/* Icon Picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-tight">
                    Select Icon
                  </label>
                  <span className="text-[11px] text-text-secondary">
                    {POPULAR_ICONS.find(i => i.name === selectedIcon)?.label || 'Icon'}
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {POPULAR_ICONS.map((item) => {
                    const Comp = ICON_MAP[item.name] || Tag;
                    const isSelected = selectedIcon === item.name;

                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setSelectedIcon(item.name)}
                        className={`h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-google-blue text-white shadow-xs scale-105'
                            : 'bg-surface-hover/70 hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border/60'
                        }`}
                        title={item.label}
                      >
                        <Comp size={18} strokeWidth={2} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Swatches */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-tight mb-2">
                  Theme Color
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setHex(c)}
                      style={{ backgroundColor: c }}
                      className={`w-8 h-8 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                        hex === c ? 'ring-2 ring-offset-2 ring-text-primary scale-110 shadow-xs' : 'opacity-85 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      {hex === c && <Check size={14} className="text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Live Preview Box */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-tight mb-1.5">
                  Preview in Ledger
                </label>
                <div className="p-3.5 rounded-2xl border border-border bg-surface-hover/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                      style={{ backgroundColor: `${hex}18`, color: hex }}
                    >
                      {React.createElement(ICON_MAP[selectedIcon] || Tag, { size: 18, strokeWidth: 2 })}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-text-primary leading-tight">
                        {name.trim() || 'New Category'}
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5">
                        ₹1,250 · Sample Expense
                      </div>
                    </div>
                  </div>

                  <span 
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                    style={{ 
                      backgroundColor: `${hex}15`, 
                      borderColor: `${hex}30`,
                      color: hex 
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hex }} />
                    <span>{name.trim() || 'Category'}</span>
                  </span>
                </div>
              </div>

              {/* Form Validation Feedback (Apple HIG / Material 3 Callout) */}
              {formError && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-400 animate-in fade-in duration-150">
                  <AlertTriangle size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                {editingKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingKey(null);
                      setActiveTab('manage');
                    }}
                    className="flex-1 h-11 border border-border hover:bg-surface-hover text-text-secondary hover:text-text-primary rounded-2xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="flex-1 h-11 bg-google-blue hover:bg-blue-700 disabled:opacity-40 text-white rounded-2xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  <Check size={16} />
                  <span>{editingKey ? 'Update Category' : 'Save Category'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Destructive Deletion Confirmation Sheet (Apple HIG Action Dialog) */}
        {deleteTargetKey && deleteTargetData && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4">
            <div 
              className="bg-surface w-full max-w-sm rounded-3xl p-5 border border-border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text-primary leading-snug">
                    Delete "{deleteTargetData.name}"?
                  </h3>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    {deleteTargetUsage && deleteTargetUsage.totalCount > 0 ? (
                      <>
                        <span className="font-semibold text-text-primary">
                          {deleteTargetUsage.totalCount} {deleteTargetUsage.totalCount === 1 ? 'item' : 'items'}
                        </span>{' '}
                        {deleteTargetUsage.spend > 0 && (
                          <>
                            totaling <strong className="text-text-primary">{formatINR(deleteTargetUsage.spend, { symbol: true })}</strong>{' '}
                          </>
                        )}
                        will automatically be changed to{' '}
                        <strong className="text-purple-600 dark:text-purple-400">Other</strong> so your ledger totals and balances remain accurate.
                      </>
                    ) : (
                      'Are you sure you want to delete this category? No expenses or items are currently using it.'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteTargetKey(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Reassigning...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Delete & Reassign</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
