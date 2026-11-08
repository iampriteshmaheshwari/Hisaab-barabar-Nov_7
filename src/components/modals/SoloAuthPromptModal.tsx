import React from 'react';
import { 
  X, 
  Users, 
  Share2, 
  FolderPlus,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GoogleIcon } from '../GoogleIcon';

export type SoloAuthFeature = 'create_ledger' | 'manage_members' | 'share_ledger' | 'multi_ledger';

interface SoloAuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: SoloAuthFeature;
  onSuccess?: () => void;
}

export function SoloAuthPromptModal({
  isOpen,
  onClose,
  feature = 'create_ledger',
  onSuccess
}: SoloAuthPromptModalProps) {
  const { signInWithGoogle } = useAuth();
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) {
      setIsSigningIn(false);
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getFeatureDetails = () => {
    switch (feature) {
      case 'manage_members':
        return {
          icon: <Users size={22} className="text-google-blue" strokeWidth={2.2} />,
          title: 'Sign in to Manage Members',
          description: 'Connect your Google account to invite members, assign roles, and track shared balances in real time.'
        };
      case 'share_ledger':
        return {
          icon: <Share2 size={22} className="text-google-blue" strokeWidth={2.2} />,
          title: 'Sign in to Share Ledger',
          description: 'Connect your Google account to generate active invite links and synchronize balances with friends.'
        };
      case 'multi_ledger':
        return {
          icon: <BookOpen size={22} className="text-google-blue" strokeWidth={2.2} />,
          title: 'Sign in to Switch Ledgers',
          description: 'Connect your Google account to access and switch between all your personal and split ledgers.'
        };
      case 'create_ledger':
      default:
        return {
          icon: <FolderPlus size={22} className="text-google-blue" strokeWidth={2.2} />,
          title: 'Sign in to Create New Ledger',
          description: 'Connect your Google account to create unlimited personal and split ledgers synced across all your devices.'
        };
    }
  };

  const details = getFeatureDetails();

  const handleSignIn = async () => {
    setErrorMsg('');
    setIsSigningIn(true);
    try {
      const loggedUser = await signInWithGoogle();
      if (loggedUser) {
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      console.warn('Google sign-in status:', err?.message || err);
      setErrorMsg(err?.message || 'Google sign-in was cancelled or failed.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain font-sans"
      onClick={onClose}
    >
      <div 
        className="bg-surface w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom duration-200 flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Grab Handle */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-text-primary">
              {details.title}
            </span>
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

        {/* Modal Body */}
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-google-blue/10 text-google-blue flex items-center justify-center mx-auto shadow-xs">
            {details.icon}
          </div>

          <div className="space-y-1.5 max-w-xs mx-auto">
            <h3 className="text-base sm:text-lg font-semibold text-text-primary tracking-tight">
              {details.title}
            </h3>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              {details.description}
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-google-red text-left">
              {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              disabled={isSigningIn}
              onClick={handleSignIn}
              className="w-full h-11 bg-surface hover:bg-surface-hover border border-border shadow-xs hover:border-text-secondary/40 text-text-primary rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-95 disabled:opacity-50"
            >
              <GoogleIcon className="w-4 h-4 shrink-0" />
              <span>{isSigningIn ? 'Connecting...' : 'Continue with Google'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer py-1"
            >
              Continue with default ledger
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
