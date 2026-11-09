import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Trash2, 
  Copy, 
  Check, 
  Plus, 
  Share2, 
  UserPlus,
  Shield,
  Eye,
  Edit3,
  CheckCircle2,
  FolderPlus,
  Lock,
  LogOut,
  AlertTriangle,
  RotateCw,
  LogIn,
  Wallet,
  BookOpen,
  Pencil
} from 'lucide-react';
import type { ExpenseGroup, UserRole, GroupMember } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { GoogleIcon } from '../GoogleIcon';
import { 
  removeMemberFromGroup, 
  createGroup,
  updateMemberRole,
  regenerateGroupInviteCode
} from '../../services/expenseService';
import { shareGroupInviteLink, copyGroupInviteCode } from '../../utils/shareUtils';

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeGroup: ExpenseGroup | null;
  groups: ExpenseGroup[];
  onSelectGroup: (groupId: string) => void;
  userRole: UserRole;
  initialTab?: 'members' | 'groups' | 'create';
  onCreateGroup?: (name: string, type?: 'budget' | 'split') => Promise<ExpenseGroup | null>;
  onDeleteGroup?: (groupId: string) => Promise<void>;
  onOpenJoinModal?: () => void;
  onOpenInviteModal?: () => void;
  onUpdateGroupName?: (groupId: string, newName: string) => Promise<void>;
}

export function GroupModal({
  isOpen,
  onClose,
  activeGroup,
  groups,
  onSelectGroup,
  userRole,
  initialTab = 'members',
  onCreateGroup,
  onDeleteGroup,
  onOpenJoinModal,
  onOpenInviteModal,
  onUpdateGroupName
}: GroupModalProps) {
  const { user, signInWithGoogle } = useAuth();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedUpiId, setCopiedUpiId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState<'budget' | 'split'>('budget');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'groups' | 'create'>(initialTab);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<ExpenseGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [isRegeneratingCode, setIsRegeneratingCode] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Sync initial tab whenever modal is re-opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setStatusMessage(null);
      setShowRegenerateConfirm(false);
      setIsEditingName(false);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const canManage = userRole === 'owner' || userRole === 'editor';
  const isOwner = userRole === 'owner' || (activeGroup && user && activeGroup.createdBy === user.uid);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleRegenerateInviteCode = async () => {
    if (!activeGroup || !user) return;
    setIsRegeneratingCode(true);
    try {
      const newCode = await regenerateGroupInviteCode(activeGroup, user);
      showToast(`New invite code generated (${newCode})! Previous links are now invalid.`);
      setShowRegenerateConfirm(false);
    } catch (err: any) {
      showToast(err?.message || 'Could not regenerate invite code.');
    } finally {
      setIsRegeneratingCode(false);
    }
  };

  const handleSaveName = async () => {
    if (!activeGroup || !editedName.trim() || !onUpdateGroupName) return;
    setIsSavingName(true);
    try {
      await onUpdateGroupName(activeGroup.id, editedName.trim());
      showToast('Ledger name updated');
      setIsEditingName(false);
    } catch (err: any) {
      showToast(err?.message || 'Could not update name');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleToggleMemberRole = async (memberKey: string, currentRole: UserRole) => {
    if (!activeGroup || !isOwner) return;
    const nextRole: UserRole = currentRole === 'editor' ? 'viewer' : 'editor';
    
    try {
      await updateMemberRole(activeGroup, memberKey, nextRole);
      showToast(`Updated permissions to ${nextRole === 'editor' ? 'Can Edit' : 'View Only'}`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update member role.');
    }
  };

  const handleRemoveMember = async (memberKey: string) => {
    if (!activeGroup) return;
    try {
      await removeMemberFromGroup(activeGroup, memberKey);
      showToast('Member removed.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to remove member.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!groupToDelete || !onDeleteGroup) return;
    setIsDeletingGroup(true);
    try {
      const targetName = groupToDelete.name;
      await onDeleteGroup(groupToDelete.id);
      setGroupToDelete(null);
      showToast(`Ledger "${targetName}" deleted`);
      if (activeGroup?.id === groupToDelete.id) {
        setActiveTab('groups');
      }
    } catch (err: any) {
      console.error('Failed to delete group:', err);
      showToast(err?.message || 'Failed to delete ledger');
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newGroupName.trim().slice(0, 35);
    if (!cleanName) return;

    setIsCreatingGroup(true);
    try {
      if (onCreateGroup) {
        const created = await onCreateGroup(cleanName, newGroupType);
        if (created) {
          onSelectGroup(created.id);
        }
      } else if (user) {
        const created = await createGroup(cleanName, user, newGroupType);
        onSelectGroup(created.id);
      }
      setNewGroupName('');
      setNewGroupType('budget');
      showToast(`Ledger "${cleanName}" created!`);
      setActiveTab('members');
    } catch (err: any) {
      showToast(err?.message || 'Could not create group.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const copyInviteCode = async () => {
    if (!activeGroup) return;
    const ok = await copyGroupInviteCode(activeGroup, showToast);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyInviteLink = async () => {
    if (!activeGroup) return;
    const result = await shareGroupInviteLink(activeGroup, showToast);
    if (result.copied) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyUpi = async (upiId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(upiId);
      setCopiedUpiId(upiId);
      showToast(`UPI ID copied: ${upiId}`);
      setTimeout(() => {
        setCopiedUpiId((curr) => (curr === upiId ? null : curr));
      }, 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = upiId;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopiedUpiId(upiId);
        showToast(`UPI ID copied: ${upiId}`);
        setTimeout(() => {
          setCopiedUpiId((curr) => (curr === upiId ? null : curr));
        }, 2000);
      } catch {
        showToast('Failed to copy UPI ID');
      }
      document.body.removeChild(textarea);
    }
  };

  const memberEntries: { key: string; member: GroupMember }[] = [];
  if (activeGroup?.members) {
    const seenEmails = new Set<string>();
    Object.entries(activeGroup.members).forEach(([key, mem]) => {
      const normEmail = mem.email?.toLowerCase();
      if (!seenEmails.has(normEmail)) {
        seenEmails.add(normEmail);
        memberEntries.push({ key, member: mem });
      }
    });
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain"
      onClick={onClose}
    >
      <div 
        className="bg-surface w-full sm:max-w-md md:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom duration-200 font-sans flex flex-col max-h-[92dvh] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Grab Handle */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="min-w-0 pr-2 flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-2 py-0.5" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  maxLength={80}
                  autoFocus
                  placeholder="Ledger name"
                  className="h-8 px-2.5 text-xs sm:text-sm font-semibold rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:border-google-blue min-w-[150px] max-w-[220px]"
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      await handleSaveName();
                    } else if (e.key === 'Escape') {
                      setIsEditingName(false);
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isSavingName || !editedName.trim()}
                  onClick={handleSaveName}
                  className="h-8 px-2.5 rounded-lg bg-google-blue text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSavingName ? '...' : 'Save'}
                </button>
                <button
                  type="button"
                  disabled={isSavingName}
                  onClick={() => setIsEditingName(false)}
                  className="h-8 px-2 rounded-lg border border-border text-text-secondary text-xs hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-bold text-text-primary truncate">
                    {activeGroup ? activeGroup.name : 'Ledgers & Groups'}
                  </span>
                  {activeGroup && canManage && onUpdateGroupName && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditedName(activeGroup.name);
                        setIsEditingName(true);
                      }}
                      className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer inline-flex items-center justify-center"
                      title="Edit ledger name"
                      aria-label="Edit ledger name"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-surface-hover text-text-secondary border border-border">
                    {userRole === 'owner' ? 'Admin' : 'Member'}
                  </span>
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {groups.length} active ledger{groups.length === 1 ? '' : 's'}
                </div>
              </>
            )}
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Top Segmented Tabs: Members | Switch Ledgers | + New Ledger */}
        <div className="px-4 pt-3 shrink-0">
          <div className="flex p-1 rounded-2xl bg-surface-hover border border-border text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`flex-1 py-1.5 rounded-xl font-medium transition-all cursor-pointer select-none truncate ${
                activeTab === 'members'
                  ? 'bg-surface text-text-primary shadow-xs font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Members ({memberEntries.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className={`flex-1 py-1.5 rounded-xl font-medium transition-all cursor-pointer select-none truncate ${
                activeTab === 'groups'
                  ? 'bg-surface text-text-primary shadow-xs font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All Ledgers
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-1.5 rounded-xl font-medium transition-all cursor-pointer select-none flex items-center justify-center gap-1 truncate ${
                activeTab === 'create'
                  ? 'bg-surface text-google-blue shadow-xs font-semibold'
                  : 'text-google-blue hover:text-blue-700'
              }`}
            >
              <Plus size={13} />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div className="mx-4 mt-2 py-2 px-3 rounded-xl bg-google-blue/10 border border-google-blue/20 text-google-blue dark:text-blue-400 text-xs font-semibold flex items-center gap-2 shrink-0 animate-in fade-in duration-150">
            <CheckCircle2 size={14} className="shrink-0" />
            <span className="truncate">{statusMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 pb-8 sm:pb-7 overflow-y-auto no-scrollbar space-y-4">
          {/* TAB 1: MEMBERS & PERMISSIONS */}
          {activeTab === 'members' && (
            <>
              {/* AUTHENTICATION GATE: User must sign in first to share / invite */}
              {!user ? (
                <div className="py-6 px-4 sm:px-6 rounded-3xl bg-surface-hover/40 border border-border text-center space-y-4 font-sans">
                  <div className="w-12 h-12 rounded-2xl bg-google-blue/10 text-google-blue flex items-center justify-center mx-auto shadow-xs">
                    <UserPlus size={22} strokeWidth={2.2} />
                  </div>

                  <div className="space-y-1.5 max-w-xs mx-auto">
                    <h3 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight">
                      Sign in with Google to Share
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                      Connect your Google account to invite members, manage roles, and track shared balances.
                    </p>
                  </div>

                  <div className="pt-2 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await signInWithGoogle();
                        } catch {
                          // Handled in AuthContext
                        }
                      }}
                      className="w-full h-11 rounded-full bg-surface hover:bg-surface-hover border border-border shadow-xs hover:border-text-secondary/40 text-xs sm:text-sm font-medium text-text-primary flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95 select-none"
                    >
                      <GoogleIcon className="w-4 h-4 shrink-0" />
                      <span>Continue with Google</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Unified Share Invite Link & Code Card */}
                  {activeGroup && (
                    <div className="space-y-2">
                      <div className="p-4 sm:p-5 rounded-2xl bg-surface-hover/50 border border-border space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="text-text-secondary block text-xs uppercase font-semibold tracking-wider">
                              Share Invite Link
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-mono font-bold tracking-wider text-text-primary text-xl sm:text-2xl">
                                {activeGroup.inviteCode || 'LOCAL1'}
                              </span>
                              {activeGroup.inviteCodeRotatedAt && (
                                <span className="px-2 py-0.5 rounded text-xs bg-surface border border-border text-text-secondary font-medium">
                                  Updated
                                </span>
                              )}
                            </div>
                          </div>

                          {isOwner && !activeGroup.id.startsWith('local_') && activeGroup.id !== 'local_group' && (
                            <button
                              type="button"
                              disabled={isRegeneratingCode}
                              onClick={() => setShowRegenerateConfirm(true)}
                              className="h-8 px-3 rounded-xl bg-surface border border-border text-xs font-semibold text-text-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/30 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                            >
                              <RotateCw size={12} className={isRegeneratingCode ? 'animate-spin' : ''} />
                              <span>Reset Code</span>
                            </button>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                          {activeGroup?.type === 'split'
                            ? 'Share this invite link with friends to track shared expenses, view net balances, and settle dues via UPI.'
                            : 'Share this invite link with family or collaborators to track shared budgets, recurring expenses, and purchases.'}
                        </p>

                        {/* Primary & Secondary Action CTAs */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={copyInviteLink}
                            className="flex-1 h-11 px-4 rounded-xl bg-google-blue hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors active:scale-98 select-none"
                          >
                            <Share2 size={16} />
                            <span>{copiedLink ? 'Link Copied' : 'Share Invite Link'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={copyInviteCode}
                            className="h-11 px-4 rounded-xl bg-surface border border-border text-text-primary hover:bg-surface-active font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors active:scale-98 select-none shrink-0"
                          >
                            {copiedCode ? <Check size={15} className="text-google-green" /> : <Copy size={15} />}
                            <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Inline Confirmation when Admin clicks Reset Code */}
                      {showRegenerateConfirm && (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm space-y-2.5 animate-in fade-in duration-150">
                          <div className="flex items-start gap-2.5">
                            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div className="text-text-primary space-y-1">
                              <strong className="font-semibold text-amber-700 dark:text-amber-300">Regenerate Ledger Invite Code?</strong>
                              <p className="text-text-secondary text-xs leading-relaxed">
                                A fresh 8-character code will be generated immediately. Anyone attempting to join using previous invite links or codes will be rejected.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowRegenerateConfirm(false)}
                              className="h-8 px-3 rounded-xl bg-surface border border-border text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isRegeneratingCode}
                              onClick={handleRegenerateInviteCode}
                              className="h-8 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              {isRegeneratingCode ? <RotateCw size={12} className="animate-spin" /> : null}
                              <span>Confirm Reset</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Current Access Members List */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        Members &amp; Roles
                      </span>
                      {isOwner && (
                        <span className="text-xs text-text-secondary">
                          Tap role to switch permission
                        </span>
                      )}
                    </div>

                    <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
                      {memberEntries.map(({ key, member }) => {
                        const memberIsOwner = member.role === 'owner' || activeGroup?.createdBy === member.uid;
                        return (
                          <div key={key} className="p-3.5 sm:p-4 space-y-2.5 text-xs sm:text-sm">
                            {/* Top Row: Avatar + Name/Email on left, Role & Trash on right */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className="w-9 h-9 rounded-full bg-surface-hover border border-border flex items-center justify-center font-bold text-xs text-text-primary shrink-0 mt-0.5 shadow-2xs">
                                  {(member.displayName || member.email || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-text-primary truncate leading-snug">
                                    {member.displayName || member.email}
                                  </div>
                                  {member.email && (
                                    <div className="text-xs text-text-secondary truncate mt-0.5 max-w-full">
                                      {member.email}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Role Badge / Toggle & Trash Action - pinned to top-right */}
                              <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                {memberIsOwner ? (
                                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                                    Admin
                                  </span>
                                ) : isOwner ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleMemberRole(key, member.role)}
                                    title="Tap to switch permission"
                                    className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 select-none ${
                                      member.role === 'editor'
                                        ? 'bg-google-blue/10 border-google-blue/30 text-google-blue dark:text-blue-300 hover:bg-google-blue/20'
                                        : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                                    }`}
                                  >
                                    {member.role === 'editor' ? <Edit3 size={12} strokeWidth={2.2} /> : <Eye size={12} strokeWidth={2.2} />}
                                    <span>{member.role === 'editor' ? 'Can Edit' : 'View Only'}</span>
                                  </button>
                                ) : (
                                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
                                    member.role === 'editor'
                                      ? 'bg-google-blue/10 border-google-blue/30 text-google-blue dark:text-blue-300'
                                      : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                                  }`}>
                                    {member.role === 'editor' ? 'Can Edit' : 'View Only'}
                                  </span>
                                )}

                                {isOwner && !memberIsOwner && member.email !== user?.email && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMember(key)}
                                    className="p-1.5 text-text-secondary hover:text-google-red hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="Remove member"
                                    aria-label="Remove member"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Details Row: Dedicated UPI badge and Joined metadata, indented below avatar */}
                            {(member.upiId || member.joinedVia || member.addedAt) && (
                              <div className="pl-12 space-y-1.5">
                                {member.upiId && (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary select-none">UPI:</span>
                                    <button
                                      type="button"
                                      onClick={(e) => handleCopyUpi(member.upiId!, e)}
                                      title="Click to copy UPI ID"
                                      aria-label={`Copy UPI ID ${member.upiId}`}
                                      className={`group/upi max-w-full inline-flex items-center gap-1.5 font-mono text-xs font-medium px-2 py-0.5 rounded-md border transition-all cursor-pointer select-none active:scale-95 ${
                                        copiedUpiId === member.upiId
                                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                          : 'bg-surface-hover hover:bg-surface-active border-border text-text-primary hover:border-google-blue/40'
                                      }`}
                                    >
                                      <span className="truncate max-w-[210px] sm:max-w-xs">{member.upiId}</span>
                                      {copiedUpiId === member.upiId ? (
                                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold font-sans text-emerald-600 dark:text-emerald-400 animate-in fade-in zoom-in-95 duration-150 shrink-0">
                                          <Check size={12} strokeWidth={2.5} />
                                          <span>Copied</span>
                                        </span>
                                      ) : (
                                        <Copy 
                                          size={12} 
                                          className="text-text-secondary group-hover/upi:text-google-blue transition-colors shrink-0" 
                                        />
                                      )}
                                    </button>
                                  </div>
                                )}

                                {(member.joinedVia || member.addedAt) && (
                                  <div className="text-xs text-text-secondary flex items-center gap-1.5 flex-wrap">
                                    {member.joinedVia && (
                                      <span className="capitalize">
                                        {member.joinedVia === 'creator'
                                          ? 'Ledger Admin'
                                          : member.joinedVia === 'invite_code'
                                          ? `Joined via Code${member.inviteCodeUsed ? ` (${member.inviteCodeUsed})` : ''}`
                                          : member.uid
                                          ? 'Joined via Email'
                                          : 'Pre-authorized (Awaiting Sign-in)'}
                                      </span>
                                    )}
                                    {member.addedAt && (
                                      <>
                                        <span>•</span>
                                        <span>{new Date(member.addedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Danger Zone: Delete or Leave Ledger */}
                  {activeGroup && onDeleteGroup && (
                    <div className="pt-2 border-t border-border">
                      <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-semibold text-google-red flex items-center gap-1.5">
                            <Trash2 size={14} />
                            <span>{isOwner ? 'Delete this Ledger' : 'Leave this Ledger'}</span>
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                            {isOwner
                              ? 'Permanently delete this ledger and all associated expenses and records.'
                              : 'Remove your account from this shared ledger.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setGroupToDelete(activeGroup)}
                          className="h-9 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-google-red hover:bg-red-700 text-white transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
                        >
                          {isOwner ? 'Delete Ledger' : 'Leave Ledger'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* TAB 2: SWITCH LEDGERS */}
          {activeTab === 'groups' && (
            <div className="space-y-4">
              {!user ? (
                <div className="py-6 px-4 sm:px-6 rounded-3xl bg-surface-hover/40 border border-border text-center space-y-4 font-sans">
                  <div className="w-12 h-12 rounded-2xl bg-google-blue/10 text-google-blue flex items-center justify-center mx-auto shadow-xs">
                    <BookOpen size={22} strokeWidth={2.2} />
                  </div>

                  <div className="space-y-1.5 max-w-xs mx-auto">
                    <h3 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight">
                      Sign in with Google to Switch Ledgers
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                      Connect your Google account to access and switch between all your personal and split ledgers.
                    </p>
                  </div>

                  <div className="pt-2 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await signInWithGoogle();
                        } catch {}
                      }}
                      className="w-full h-11 rounded-full bg-surface hover:bg-surface-hover border border-border shadow-xs hover:border-text-secondary/40 text-xs sm:text-sm font-medium text-text-primary flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95 select-none"
                    >
                      <GoogleIcon className="w-4 h-4 shrink-0" />
                      <span>Continue with Google</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Your Ledgers
                    </span>
                    <div className="flex items-center gap-3">
                      {onOpenJoinModal && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenJoinModal();
                          }}
                          className="text-xs sm:text-sm text-text-secondary hover:text-google-blue font-medium flex items-center gap-1 cursor-pointer transition-colors"
                          title="Join a ledger using an invite code"
                        >
                          <LogIn size={13} />
                          <span>Join with Code</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveTab('create')}
                        className="text-xs sm:text-sm text-google-blue font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>New Ledger</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
                    {groups.map((grp) => {
                      const isSelected = activeGroup?.id === grp.id;
                      const isGrpOwner = !user || grp.createdBy === user.uid || grp.createdBy === 'guest';
                      return (
                        <div
                          key={grp.id}
                          onClick={() => {
                            onSelectGroup(grp.id);
                            setActiveTab('members');
                          }}
                          className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? 'bg-google-blue/10' : 'hover:bg-surface-hover/50'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-sm sm:text-base font-semibold text-text-primary truncate flex items-center gap-2">
                              <span className="truncate">{grp.name}</span>
                              {grp.type === 'split' && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-google-blue/10 text-google-blue border border-google-blue/20 shrink-0">
                                  Split
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-1.5 truncate">
                              <span>{grp.memberEmails?.length || 1} {grp.memberEmails?.length === 1 ? 'member' : 'members'}</span>
                              <span>·</span>
                              <span>Code: <span className="font-mono">{grp.inviteCode || 'N/A'}</span></span>
                              {isGrpOwner && (
                                <>
                                  <span>·</span>
                                  <span>Admin</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isSelected && (
                              <div className="w-6 h-6 rounded-full bg-google-blue text-white flex items-center justify-center shrink-0" title="Active ledger">
                                <Check size={14} />
                              </div>
                            )}

                            {onDeleteGroup && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGroupToDelete(grp);
                                }}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-google-red hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                                title={isGrpOwner ? "Delete ledger" : "Leave ledger"}
                                aria-label={isGrpOwner ? `Delete ${grp.name}` : `Leave ${grp.name}`}
                              >
                                {isGrpOwner ? <Trash2 size={15} /> : <LogOut size={15} />}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Join with Invite Code Card */}
                  {onOpenJoinModal && (
                    <div className="p-4 rounded-2xl bg-surface-hover/50 border border-border space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-google-blue/10 text-google-blue flex items-center justify-center shrink-0 mt-0.5">
                          <LogIn size={16} strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-text-primary">
                            Have an invite code?
                          </div>
                          <div className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                            Paste an 8-character invite code or shared link from a friend to join their ledger instantly.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenJoinModal();
                        }}
                        className="w-full h-10 px-4 rounded-xl bg-google-blue hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all active:scale-[0.99] select-none"
                      >
                        <LogIn size={15} strokeWidth={2.2} />
                        <span>Join with Invite Code</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CREATE NEW LEDGER / GROUP */}
          {activeTab === 'create' && (
            <div className="space-y-4">
              {!user ? (
                <div className="py-6 px-4 sm:px-6 rounded-3xl bg-surface-hover/40 border border-border text-center space-y-4 font-sans">
                  <div className="w-12 h-12 rounded-2xl bg-google-blue/10 text-google-blue flex items-center justify-center mx-auto shadow-xs">
                    <FolderPlus size={22} strokeWidth={2.2} />
                  </div>

                  <div className="space-y-1.5 max-w-xs mx-auto">
                    <h3 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight">
                      Sign in with Google to Create Ledgers
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                      Connect your Google account to create unlimited personal and split ledgers synced across all your devices.
                    </p>
                  </div>

                  <div className="pt-2 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await signInWithGoogle();
                        } catch {}
                      }}
                      className="w-full h-11 rounded-full bg-surface hover:bg-surface-hover border border-border shadow-xs hover:border-text-secondary/40 text-xs sm:text-sm font-medium text-text-primary flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95 select-none"
                    >
                      <GoogleIcon className="w-4 h-4 shrink-0" />
                      <span>Continue with Google</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
                    {/* Clean Segmented Control: Budget vs Split */}
                    <div>
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1.5">
                        Ledger Type
                      </label>
                      <div className="flex p-1 rounded-2xl bg-surface-hover border border-border text-xs sm:text-sm">
                        <button
                          type="button"
                          onClick={() => setNewGroupType('budget')}
                          className={`flex-1 py-2 px-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            newGroupType === 'budget'
                              ? 'bg-surface text-text-primary shadow-xs font-semibold'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          <Wallet size={15} />
                          <span>Expense Tracker</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewGroupType('split')}
                          className={`flex-1 py-2 px-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            newGroupType === 'split'
                              ? 'bg-surface text-text-primary shadow-xs font-semibold'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          <Users size={15} />
                          <span>Split Expenses</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                          Ledger Name
                        </label>
                        <span className={`text-[11px] font-mono ${newGroupName.length >= 30 ? 'text-amber-500 font-semibold' : 'text-text-secondary'}`}>
                          {newGroupName.length}/35
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        autoFocus
                        maxLength={35}
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder={newGroupType === 'split' ? 'e.g. Goa Trip 2026, Flatmates 402...' : 'e.g. Household Budget, Personal Finances...'}
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-surface border border-border text-base sm:text-sm text-text-primary outline-none focus:border-google-blue transition-all"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab('groups')}
                        className="w-1/3 h-11 border border-border hover:bg-surface-hover text-text-secondary hover:text-text-primary rounded-full text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={isCreatingGroup || !newGroupName.trim()}
                        className="flex-1 h-11 bg-google-blue hover:bg-blue-700 disabled:opacity-40 text-white rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                      >
                        <Plus size={16} />
                        <span>{isCreatingGroup ? 'Creating Ledger...' : 'Create Ledger'}</span>
                      </button>
                    </div>
                  </form>
              )}
            </div>
          )}
        </div>

        {/* Delete Confirmation Alert (Apple HIG / Material 3 Style) */}
        {groupToDelete && (
          <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface w-full max-w-sm rounded-3xl p-5 border border-border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 font-sans">
              <div className="w-11 h-11 rounded-2xl bg-red-500/10 text-google-red flex items-center justify-center">
                <Trash2 size={22} strokeWidth={2.2} />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-semibold text-text-primary">
                  Delete "{groupToDelete.name}"?
                </h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  All expenses, shopping lists, and recurring bills in this ledger will be permanently deleted. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={isDeletingGroup}
                  onClick={() => setGroupToDelete(null)}
                  className="flex-1 h-10 border border-border hover:bg-surface-hover text-text-secondary hover:text-text-primary rounded-full text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingGroup}
                  onClick={handleConfirmDelete}
                  className="flex-1 h-10 bg-google-red hover:bg-red-700 disabled:opacity-50 text-white rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {isDeletingGroup ? 'Deleting...' : 'Delete Ledger'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
