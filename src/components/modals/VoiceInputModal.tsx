import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  X, 
  Check, 
  Trash2, 
  Plus, 
  RotateCcw, 
  Loader2, 
  Sparkles, 
  ShoppingBag, 
  IndianRupee, 
  WifiOff, 
  AlertCircle, 
  ChevronDown, 
  Layers,
  ExternalLink
} from 'lucide-react';
import type { ExpenseGroup, CategoryData, UserRole } from '../../types';
import { GeminiIcon } from '../icons/GeminiIcon';

interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeGroup: ExpenseGroup | null;
  userRole: UserRole;
  categories: Record<string, CategoryData>;
  onSaveExpense: (data: {
    name: string;
    amount: number;
    category: string;
    date: string;
    groupId: string;
  }) => Promise<void> | void;
  onAddShoppingItem: (
    name: string,
    options?: { category?: string; byWhen?: string }
  ) => Promise<void> | void;
  isOnline: boolean;
}

interface ParsedExpense {
  id: string;
  name: string;
  amount: number;
  category: string;
}

interface ParsedShoppingItem {
  id: string;
  name: string;
  category: string;
}

// Local smart fallback parser (used only if server API is offline or unreachable)
function parseLocally(text: string, categoryKeys: string[]): {
  type: 'expenses' | 'shopping' | 'both' | 'unrecognized';
  interpretation?: string;
  explanation?: string;
  expenses: ParsedExpense[];
  shoppingItems: ParsedShoppingItem[];
} {
  const clean = text.trim();
  const defaultCat = categoryKeys.includes('other') ? 'other' : (categoryKeys[0] || 'other');
  const groceryCat = categoryKeys.includes('groceries') ? 'groceries' : defaultCat;

  // 1. Detect conversational questions or greetings
  const isQuestion = /\?$/.test(clean) || /^(who|what|where|when|why|how|which|whose|whom|is|are|can|could|would|will|tell me|search for|hello|hi|hey)\b/i.test(clean);
  if (isQuestion) {
    return {
      type: 'unrecognized',
      explanation: "This sounds like a question or conversational query. Gemini is designed to record expenses (e.g. 'chai 10 coffee 20') or shopping list items (e.g. '2 kilo batata, 20 rs ki sev, doodh').",
      expenses: [],
      shoppingItems: []
    };
  }

  const expenses: ParsedExpense[] = [];
  const shoppingItems: ParsedShoppingItem[] = [];

  // 2. Extract expenses with prices
  const expenseRegex = /([a-zA-Z\s]+?)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)(?:\s*(?:rupees|rs|inr))?(?:,|$|\s+(?=[a-zA-Z]))/gi;
  const matches = [...clean.matchAll(expenseRegex)];

  if (matches.length > 0) {
    for (const m of matches) {
      let rawName = m[1].replace(/^(and|plus|add|bought|paid|for)\s+/i, '').trim();
      const rawAmt = parseFloat(m[2]);
      if (rawName && !isNaN(rawAmt) && rawAmt > 0) {
        // Phonetic correction for common Indian terms
        if (/^(try|child|chai tea|tea)$/i.test(rawName)) rawName = 'Chai';
        if (/^(cofi|caffey)$/i.test(rawName)) rawName = 'Coffee';
        const capitalized = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        const lowerName = capitalized.toLowerCase();
        let cat = defaultCat;
        if (/swiggy|zomato|restaurant|hotel|dinner|lunch|breakfast|snack|pizza|burger|dosa|samosa|mithai|bakery|chai|coffee|tea|cafe/i.test(lowerName)) {
          cat = categoryKeys.includes('food') ? 'food' : groceryCat;
        } else if (/petrol|diesel|fuel|auto|cab|uber|ola|rapido|metro|toll|train|bus|fastag|flight|trip/i.test(lowerName)) {
          cat = categoryKeys.includes('travel') ? 'travel' : defaultCat;
        } else if (/medicine|chemist|doctor|hospital|clinic|tablet|dawai|medical|dentist/i.test(lowerName)) {
          cat = categoryKeys.includes('medical') ? 'medical' : defaultCat;
        } else if (/clothes|shirt|pant|saree|shoes|amazon|flipkart|myntra|meesho|shopping|electronics|appliances/i.test(lowerName)) {
          cat = categoryKeys.includes('shopping') ? 'shopping' : defaultCat;
        } else if (/fee|school|college|tuition|coaching|book|stationery|pen|pencil|course/i.test(lowerName)) {
          cat = categoryKeys.includes('education') ? 'education' : defaultCat;
        } else if (/rent|maintenance|maid|cook|bai|safai|repair|plumber/i.test(lowerName)) {
          cat = categoryKeys.includes('rent') ? 'rent' : defaultCat;
        } else if (/bill|recharge|electric|bijli|wifi|broadband|water|gas|cylinder|dth|netflix|prime|hotstar/i.test(lowerName)) {
          cat = categoryKeys.includes('utilities') ? 'utilities' : defaultCat;
        } else if (/sip|mutual|fd|rd|lic|insurance|emi|gold|ppf|loan/i.test(lowerName)) {
          cat = categoryKeys.includes('investments') ? 'investments' : defaultCat;
        } else if (/toothbrush|toothpaste|soap|shampoo|detergent|biscuit|milk|bread|grocer|kirana|ration|sabzi|fruit|vegetable|paneer|doodh|dahi|chips|bhindi|louki|kotambir|batata|kanda|atta|rice|dal|oil/i.test(lowerName)) {
          cat = groceryCat;
        }
        expenses.push({
          id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: capitalized,
          amount: rawAmt,
          category: cat
        });
      }
    }
  }

  // 3. Extract shopping items (e.g. "and add milk and bread to shopping list" or grocery terms without prices)
  const explicitGroceryTerms = /\b(milk|bread|butter|paneer|cheese|tea|coffee|bhindi|louki|kotambir|potato|onion|tomato|soap|shampoo|toothpaste|oil|rice|atta|doodh|dahi|vegetables?|fruits?|detergent|apples?|bananas?|batata|kanda|sev|murmura|kurmura|churmura|farsan|aloo|pyaz|dhaniya|chips)\b/i;
  const shoppingActions = /(add|buy|get|need|pick up|shopping list)\b/i;

  if (shoppingActions.test(clean) || explicitGroceryTerms.test(clean)) {
    // Isolate shopping portion if compound
    const cleanWithoutExpenses = clean.replace(expenseRegex, ' ');
    const tokens = cleanWithoutExpenses
      .split(/[,;\n]|\band\b/i)
      .map(t => t.replace(/^(and|add|buy|get|need|pick up|to my shopping list|to shopping list)\s+/i, '').trim())
      .filter(t => t.length > 1 && !/^(shopping|list)$/i.test(t));

    for (const token of tokens) {
      if (explicitGroceryTerms.test(token) || shoppingActions.test(clean)) {
        let normalized = token.charAt(0).toUpperCase() + token.slice(1);
        if (/^bred$/i.test(normalized)) normalized = 'Bread';
        if (/^doodh?$/i.test(normalized)) normalized = 'Milk';
        shoppingItems.push({
          id: `shop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: normalized,
          category: groceryCat
        });
      }
    }
  }

  if (expenses.length > 0 && shoppingItems.length > 0) {
    return {
      type: 'both',
      interpretation: `Understood ${expenses.length} expenses and ${shoppingItems.length} shopping items`,
      expenses,
      shoppingItems
    };
  }

  if (expenses.length > 0) {
    return {
      type: 'expenses',
      interpretation: `Understood ${expenses.length} expenses`,
      expenses,
      shoppingItems: []
    };
  }

  if (shoppingItems.length > 0) {
    return {
      type: 'shopping',
      interpretation: `Understood ${shoppingItems.length} shopping items`,
      expenses: [],
      shoppingItems
    };
  }

  return {
    type: 'unrecognized',
    explanation: "Gemini couldn't find any financial expenses or items to buy in this input. Try speaking expenses (e.g. 'chai 10 coffee 20') or shopping items (e.g. '2 kilo batata, 20 rs ki sev, doodh').",
    expenses: [],
    shoppingItems: []
  };
}

export function VoiceInputModal({
  isOpen,
  onClose,
  activeGroup,
  userRole,
  categories,
  onSaveExpense,
  onAddShoppingItem,
  isOnline
}: VoiceInputModalProps) {
  // Stages: 'idle' | 'listening' | 'processing' | 'unrecognized' | 'confirming' | 'submitting' | 'success'
  const [stage, setStage] = useState<'idle' | 'listening' | 'processing' | 'unrecognized' | 'confirming' | 'submitting' | 'success'>('idle');
  
  // Microphone permission state
  const [micPermission, setMicPermission] = useState<'granted' | 'prompt' | 'denied' | 'unsupported'>('prompt');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  
  // Composer / Speech state
  const [inputText, setInputText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [unrecognizedMessage, setUnrecognizedMessage] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [showRawTranscript, setShowRawTranscript] = useState(false);

  // Target confirmation filter: 'all' | 'expenses' | 'shopping'
  const [activeFilter, setActiveFilter] = useState<'all' | 'expenses' | 'shopping'>('all');
  const [confirmedExpenses, setConfirmedExpenses] = useState<ParsedExpense[]>([]);
  const [confirmedShoppingItems, setConfirmedShoppingItems] = useState<ParsedShoppingItem[]>([]);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<any>(null);
  const hasAttemptedFallbackRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const categoryKeys = Object.keys(categories);
  const targetLedgerName = activeGroup?.name || 'Active Ledger';
  const targetGroupId = activeGroup?.id || 'local_group';

  // Cleanup & initial sync on modal open
  useEffect(() => {
    if (!isOpen) {
      stopListening();
      return;
    }

    // Reset interaction state
    setInputText('');
    setInterimText('');
    setUnrecognizedMessage('');
    setInterpretation('');
    setShowRawTranscript(false);
    setConfirmedExpenses([]);
    setConfirmedShoppingItems([]);
    setActiveFilter('all');
    setStage('idle');
    setRecordingSeconds(0);

    // Check permission status passively if API supported
    if (typeof window !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then((perm) => {
          if (perm.state === 'granted') setMicPermission('granted');
          else if (perm.state === 'denied') setMicPermission('denied');
          else setMicPermission('prompt');

          perm.onchange = () => {
            if (perm.state === 'granted') setMicPermission('granted');
            else if (perm.state === 'denied') setMicPermission('denied');
            else setMicPermission('prompt');
          };
        })
        .catch(() => {
          // Some browsers reject microphone query; default to prompt
          setMicPermission('prompt');
        });
    }

    return () => {
      stopListening();
    };
  }, [isOpen]);

  // Audio recording fallback via MediaRecorder (universal across Chrome, Firefox, Safari)
  const startMediaRecording = async () => {
    if (!isOnline) return;
    try {
      setIsRequestingPermission(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          const reader = new FileReader();
          reader.onloadend = () => {
            const resultStr = reader.result as string;
            const base64Audio = resultStr ? resultStr.split(',')[1] : null;
            if (base64Audio) {
              handleProcessInput(undefined, base64Audio, mimeType);
            }
          };
          reader.readAsDataURL(blob);
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setStage('listening');
      setMicPermission('granted');
      setIsRequestingPermission(false);
      setRecordingSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Media recording error:', err);
      setIsRequestingPermission(false);
      setIsRecording(false);
      setMicPermission('denied');
    }
  };

  const stopMediaRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  // Web Speech API recognition (real-time streaming speech-to-text)
  const startSpeechRecognition = () => {
    if (!isOnline) return;
    setInterimText('');

    const SpeechRecognitionAPI = typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

    if (!SpeechRecognitionAPI) {
      // Fallback directly to MediaRecorder
      startMediaRecording();
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }

      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsRecording(true);
        setStage('listening');
        setMicPermission('granted');
        setRecordingSeconds(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      };

      recognition.onresult = (event: any) => {
        let finalStr = '';
        let interimStr = '';

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalStr += res[0].transcript + ' ';
          } else {
            interimStr += res[0].transcript;
          }
        }

        if (finalStr.trim()) {
          setInputText((prev) => {
            const combined = (prev ? prev + ' ' : '') + finalStr.trim();
            return combined.trim();
          });
        }
        setInterimText(interimStr);
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event?.error);
        if (event?.error === 'no-speech') {
          // Keep listening, do not terminate
          return;
        }

        // On 'not-allowed' or other SpeechRecognition engine issues, attempt direct MediaRecorder fallback
        if (!hasAttemptedFallbackRef.current) {
          hasAttemptedFallbackRef.current = true;
          stopListening();
          startMediaRecording();
        } else {
          setMicPermission('denied');
          stopListening();
        }
      };

      recognition.onend = () => {
        // Recognition completed
      };

      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed, using audio fallback:', err);
      if (!hasAttemptedFallbackRef.current) {
        hasAttemptedFallbackRef.current = true;
        startMediaRecording();
      } else {
        setMicPermission('denied');
        stopListening();
      }
    }
  };

  const startListening = () => {
    hasAttemptedFallbackRef.current = false;
    const SpeechRecognitionAPI = typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

    if (SpeechRecognitionAPI) {
      startSpeechRecognition();
    } else {
      startMediaRecording();
    }
  };

  const stopListening = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    stopMediaRecording();
    setIsRecording(false);
    if (stage === 'listening') {
      setStage('idle');
    }
  };

  // Toggle voice dictation
  const handleToggleVoice = () => {
    if (!isOnline) return;

    if (isRecording) {
      // User tapped to finish speaking
      const recordedText = (inputText || interimText).trim();
      stopListening();
      if (recordedText) {
        handleProcessInput(recordedText);
      }
    } else {
      // Start voice input
      setInputText('');
      setInterimText('');
      setUnrecognizedMessage('');
      setInterpretation('');
      startListening();
    }
  };

  // Process text or audio with Gemini via server
  const handleProcessInput = async (customText?: string, customAudioBase64?: string, customAudioMime?: string) => {
    stopListening();
    const textToProcess = (customText !== undefined ? customText : (inputText || interimText)).trim();

    if (!textToProcess && !customAudioBase64) return;

    if (textToProcess) {
      setInputText(textToProcess);
    }
    setInterimText('');
    setStage('processing');

    try {
      const response = await fetch('/api/gemini/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToProcess || undefined,
          audio: customAudioBase64 || undefined,
          mimeType: customAudioMime || undefined,
          categories: categoryKeys
        })
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        if (response.status === 429 || errorJson?.isQuota || errorJson?.error === 'QUOTA_EXHAUSTED') {
          // Attempt on-device regex parsing first so the user isn't stranded
          const fallback = parseLocally(textToProcess, categoryKeys);
          if (fallback.expenses.length > 0 || fallback.shoppingItems.length > 0) {
            setConfirmedExpenses(fallback.expenses);
            setConfirmedShoppingItems(fallback.shoppingItems);
            setInterpretation(fallback.interpretation ? `${fallback.interpretation} (Parsed on-device)` : 'Extracted on-device');
            setActiveFilter(fallback.expenses.length > 0 && fallback.shoppingItems.length > 0 ? 'all' : fallback.expenses.length > 0 ? 'expenses' : 'shopping');
            setStage('confirming');
            return;
          }
          const message = errorJson?.isDailyQuota || errorJson?.error === 'DAILY_QUOTA_EXHAUSTED'
            ? "Daily Gemini limit has been reached for today. It will reset tomorrow at midnight UTC. You can continue adding items manually using the '+' button anytime."
            : "Gemini rate limit reached (requests per minute). Please wait a moment and try again, or use manual entry directly.";

          setUnrecognizedMessage(message);
          setStage('unrecognized');
          return;
        }
        throw new Error(`Server returned ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        const data = result.data;

        // If Gemini classified as unrecognized (questions, chitchat, random)
        if (data.type === 'unrecognized') {
          setUnrecognizedMessage(
            data.explanation ||
            "Gemini didn't find any financial expenses or items to buy in this input. Try speaking expenses (e.g. 'chai 10 coffee 20') or shopping items (e.g. '2 kilo batata, 20 rs ki sev, doodh')."
          );
          setStage('unrecognized');
          return;
        }

        const hasExpenses = Array.isArray(data.expenses) && data.expenses.length > 0;
        const hasShopping = Array.isArray(data.shoppingItems) && data.shoppingItems.length > 0;

        if (hasExpenses || hasShopping) {
          const mappedExp: ParsedExpense[] = hasExpenses ? data.expenses.map((e: any, idx: number) => ({
            id: `exp_${Date.now()}_${idx}`,
            name: (e.name || 'Expense').trim(),
            amount: Number(e.amount) || 0,
            category: categories[e.category] ? e.category : (categoryKeys[0] || 'other')
          })) : [];

          const mappedShop: ParsedShoppingItem[] = hasShopping ? data.shoppingItems.map((s: any, idx: number) => ({
            id: `shop_${Date.now()}_${idx}`,
            name: (s.name || 'Item').trim(),
            category: categories[s.category] ? s.category : (categoryKeys[0] || 'groceries')
          })) : [];

          setConfirmedExpenses(mappedExp);
          setConfirmedShoppingItems(mappedShop);
          setInterpretation(
            data.interpretation ||
            (hasExpenses && hasShopping
              ? `Understood ${mappedExp.length} expenses & ${mappedShop.length} shopping items`
              : hasExpenses
              ? `Understood ${mappedExp.length} expenses`
              : `Understood ${mappedShop.length} shopping items`)
          );

          if (hasExpenses && hasShopping) {
            setActiveFilter('all');
          } else if (hasExpenses) {
            setActiveFilter('expenses');
          } else {
            setActiveFilter('shopping');
          }

          setStage('confirming');
          return;
        }

        // Fallback unrecognized
        setUnrecognizedMessage(
          data.explanation ||
          "Could not detect any expenses or shopping items. Say things like 'chai 10 coffee 20' or '2 kilo batata, 20 rs ki sev, doodh'."
        );
        setStage('unrecognized');
      } else {
        throw new Error('Invalid parser response');
      }
    } catch (err) {
      console.warn('Gemini parser API note, evaluating with local fallback:', err);
      const fallback = parseLocally(textToProcess, categoryKeys);
      if (fallback.type === 'unrecognized') {
        setUnrecognizedMessage(
          fallback.explanation ||
          "Gemini couldn't find any expenses or shopping items. Try saying 'chai 10 coffee 20' or '2 kilo batata, 20 rs ki sev, doodh'."
        );
        setStage('unrecognized');
      } else {
        setConfirmedExpenses(fallback.expenses);
        setConfirmedShoppingItems(fallback.shoppingItems);
        setInterpretation(fallback.interpretation || 'Extracted items');
        if (fallback.expenses.length > 0 && fallback.shoppingItems.length > 0) {
          setActiveFilter('all');
        } else if (fallback.expenses.length > 0) {
          setActiveFilter('expenses');
        } else {
          setActiveFilter('shopping');
        }
        setStage('confirming');
      }
    }
  };

  // Commit parsed items to Hisaab Barabar
  const handleConfirmAdd = async () => {
    if (userRole === 'viewer') return;
    setStage('submitting');
    const todayDate = new Date().toISOString().split('T')[0];

    try {
      // 1. Save expenses
      if (activeFilter === 'all' || activeFilter === 'expenses') {
        for (const exp of confirmedExpenses) {
          if (exp.name.trim() && exp.amount > 0) {
            await onSaveExpense({
              name: exp.name.trim(),
              amount: exp.amount,
              category: exp.category,
              date: todayDate,
              groupId: targetGroupId
            });
          }
        }
      }

      // 2. Save shopping items
      if (activeFilter === 'all' || activeFilter === 'shopping') {
        for (const item of confirmedShoppingItems) {
          if (item.name.trim()) {
            await onAddShoppingItem(item.name.trim(), {
              category: item.category
            });
          }
        }
      }

      setStage('success');
      setTimeout(() => {
        onClose();
      }, 950);
    } catch (err) {
      console.error('Failed to commit Gemini items:', err);
      setStage('confirming');
    }
  };

  if (!isOpen) return null;

  const totalExpenseCost = confirmedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const currentActiveText = (inputText + (interimText ? ' ' + interimText : '')).trim();

  // Suggestions including compound multi-intent queries
  const quickSuggestions = [
    { label: 'Chai 10, Coffee 20, Biscuit 30', type: 'expense' },
    { label: '2 Kilo Batata, Pav kilo Bhindi, Kotambir', type: 'shopping' },
    { label: 'Chai 10 + 20 rs ki Sev, 20 rs ke Murmura', type: 'both' }
  ];

  const hasBoth = confirmedExpenses.length > 0 && confirmedShoppingItems.length > 0;
  const showExpensesList = (activeFilter === 'all' || activeFilter === 'expenses') && confirmedExpenses.length > 0;
  const showShoppingList = (activeFilter === 'all' || activeFilter === 'shopping') && confirmedShoppingItems.length > 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 dark:bg-black/65 backdrop-blur-md transition-opacity duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-surface border border-border/80 rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS-style Top Grab Handle on mobile */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" aria-hidden="true" />

        {/* Clean Apple HIG + Material 3 Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-surface-hover/30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <GeminiIcon size={22} animate={stage === 'processing' || isRecording} />
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm sm:text-base font-semibold tracking-tight text-text-primary">
                Gemini
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-hover text-text-secondary border border-border/70 truncate max-w-[150px] font-medium">
                {targetLedgerName}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            title="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto overflow-x-hidden flex-1 space-y-4">
          {/* Offline notice if disconnected */}
          {!isOnline && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300">
              <WifiOff size={16} className="shrink-0 text-amber-500" />
              <span>Gemini requires an active internet connection to parse speech and text.</span>
            </div>
          )}

          {/* VIEW A: IDLE / LISTENING (Composer & Voice) */}
          {(stage === 'idle' || stage === 'listening') && (
            <div className="space-y-4">
              {/* Permission Banner if blocked in browser */}
              {micPermission === 'denied' && (
                <div className="p-3 rounded-2xl bg-surface-hover/80 border border-border flex items-center justify-between gap-3 text-xs text-text-secondary">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle size={15} className="text-amber-500 shrink-0" />
                    <span className="text-[11px] leading-tight text-text-secondary">
                      Microphone is blocked in browser settings. You can type below anytime.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    className="text-google-blue font-semibold text-[11px] hover:underline shrink-0 cursor-pointer ml-1"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Central Voice Pulse & Apple Siri / Google Material waveform */}
              <div className="py-4 flex flex-col items-center justify-center text-center">
                <div className="relative flex items-center justify-center mb-3">
                  {isRecording && (
                    <>
                      <div className="absolute w-28 h-28 rounded-full bg-google-blue/20 animate-ping opacity-60" />
                      <div className="absolute w-32 h-32 rounded-full bg-google-blue/10 animate-pulse" />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    disabled={!isOnline}
                    className={`relative w-20 h-20 sm:w-22 sm:h-22 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-lg active:scale-95 ${
                      isRecording
                        ? 'bg-google-blue text-white shadow-google-blue/40 scale-105 ring-4 ring-google-blue/20'
                        : 'bg-surface border-2 border-google-blue/30 hover:border-google-blue text-google-blue hover:bg-google-blue/5 shadow-md'
                    }`}
                    title={isRecording ? 'Tap to finish' : 'Tap to speak'}
                    aria-label={isRecording ? 'Stop listening and process' : 'Tap to speak'}
                  >
                    <Mic size={32} className={isRecording ? 'text-white' : 'text-google-blue'} />
                  </button>
                </div>

                {/* Ambient Listening Feedback (Apple Siri / Google Assistant design) */}
                <div className="flex flex-col items-center gap-1">
                  {isRecording ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-google-blue flex items-center gap-1.5 justify-center font-semibold text-xs">
                        <span className="inline-flex gap-0.5 items-end h-3">
                          <span className="w-0.5 h-2 bg-google-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-0.5 h-3.5 bg-google-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-0.5 h-2 bg-google-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          <span className="w-0.5 h-3 bg-google-blue rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
                        </span>
                        <span>Listening... tap mic to finish</span>
                      </span>
                      {recordingSeconds > 0 && (
                        <span className="text-[11px] text-text-secondary font-mono">
                          0:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs font-semibold tracking-tight text-text-secondary">
                      Tap mic to speak
                    </span>
                  )}
                </div>

                {/* Subtle streaming caption while speaking */}
                {isRecording && currentActiveText && (
                  <div className="mt-3 px-3 py-1.5 rounded-xl bg-surface-hover/80 border border-border/70 max-w-sm text-center">
                    <p className="text-xs text-text-primary font-medium italic">
                      "{currentActiveText}"
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Inspiration Chips */}
              {!currentActiveText && !isRecording && (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block px-1">
                    Try saying or typing:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {quickSuggestions.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setInputText(sug.label);
                          handleProcessInput(sug.label);
                        }}
                        className="text-xs px-3 py-1.5 rounded-full bg-surface-hover hover:bg-surface-active text-text-primary border border-border/80 transition-colors cursor-pointer text-left font-medium"
                      >
                        {sug.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Unified Omnibox Composer Bar */}
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block px-1 mb-1.5">
                  Or type here:
                </span>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (currentActiveText) {
                      handleProcessInput(currentActiveText);
                    }
                  }}
                  className="relative flex items-center gap-1.5 p-1 rounded-2xl bg-surface border border-border focus-within:border-google-blue focus-within:ring-2 focus-within:ring-google-blue/20 shadow-xs transition-all"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="e.g. chai 10, 2 kilo batata, 20 rs ki sev..."
                    className="flex-1 px-3 py-2 text-xs sm:text-sm text-text-primary bg-transparent outline-none min-w-0"
                  />

                  {inputText && (
                    <button
                      type="button"
                      onClick={() => setInputText('')}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer shrink-0"
                    >
                      <X size={14} />
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={!currentActiveText || !isOnline}
                    className="h-9 px-3.5 rounded-xl bg-google-blue hover:bg-google-blue-hover text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    <Sparkles size={14} />
                    <span className="hidden sm:inline">Process</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* VIEW B: PROCESSING WITH GEMINI */}
          {stage === 'processing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3.5">
              <div className="w-16 h-16 rounded-full bg-google-blue/10 flex items-center justify-center animate-spin">
                <GeminiIcon size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm sm:text-base font-semibold text-text-primary tracking-tight">
                  Gemini is organizing items...
                </h4>
                <p className="text-xs text-text-secondary max-w-xs leading-relaxed">
                  Correcting speech, extracting costs & categorizing for {targetLedgerName}
                </p>
              </div>
            </div>
          )}

          {/* VIEW C: UNRECOGNIZED INPUT */}
          {stage === 'unrecognized' && (
            <div className="py-4 flex flex-col items-center text-center space-y-3.5">
              <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
                <GeminiIcon size={24} />
              </div>

              <div className="space-y-1 max-w-xs">
                <h4 className="text-sm font-semibold text-text-primary">
                  No Items Detected
                </h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {unrecognizedMessage ||
                    "Gemini didn't find any financial expenses or items to buy in your input."}
                </p>
              </div>

              {inputText && (
                <div className="p-3 w-full rounded-2xl bg-surface-hover/70 border border-border text-left">
                  <span className="text-[10px] uppercase font-semibold text-text-secondary block mb-0.5">
                    Your input:
                  </span>
                  <p className="text-xs font-medium text-text-primary italic truncate">
                    "{inputText}"
                  </p>
                </div>
              )}

              {/* Guidance examples */}
              <div className="p-3 w-full rounded-2xl bg-google-blue/5 border border-google-blue/15 text-left text-xs space-y-1">
                <span className="font-semibold text-google-blue text-xs block">
                  Gemini handles:
                </span>
                <p className="text-[11px] text-text-secondary">
                  • <strong>Expenses:</strong> "chai 10 coffee 20", "petrol 500"
                </p>
                <p className="text-[11px] text-text-secondary">
                  • <strong>Shopping:</strong> "2 kilo batata", "20 rs ki sev", "pav kilo bhindi"
                </p>
                <p className="text-[11px] text-text-secondary">
                  • <strong>Both at once:</strong> "chai 10 and 20 rs ki sev"
                </p>
              </div>

              <div className="flex items-center gap-2 w-full pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setInputText('');
                    setStage('idle');
                    inputRef.current?.focus();
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Type Items
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInputText('');
                    setStage('listening');
                    startListening();
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-google-blue hover:bg-google-blue-hover text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <RotateCcw size={14} />
                  <span>Speak Again</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW D: CONFIRMATION SCREEN (MULTI-INTENT SUPPORT + ZERO COGNITIVE LOAD) */}
          {(stage === 'confirming' || stage === 'submitting') && (
            <div className="space-y-3.5">
              {/* Gemini Smart Interpretation Badge (Highlights understood intent rather than messy STT) */}
              <div className="p-3 rounded-2xl bg-google-blue/8 border border-google-blue/20 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles size={16} className="text-google-blue shrink-0" />
                  <span className="text-xs font-semibold text-text-primary tracking-tight truncate">
                    {interpretation || 'Understood and categorized items'}
                  </span>
                </div>

                {inputText && (
                  <button
                    type="button"
                    onClick={() => setShowRawTranscript(!showRawTranscript)}
                    className="text-[10px] text-text-secondary hover:text-text-primary cursor-pointer flex items-center gap-0.5 shrink-0"
                    title="View original speech"
                  >
                    <span>{showRawTranscript ? 'Hide speech' : 'Show speech'}</span>
                    <ChevronDown size={11} className={`transition-transform ${showRawTranscript ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {/* Optional collapsed view of raw dictation */}
              {showRawTranscript && inputText && (
                <div className="px-3 py-2 rounded-xl bg-surface-hover text-left text-[11px] text-text-secondary italic border border-border animate-in fade-in duration-150">
                  Dictated: "{inputText}"
                </div>
              )}

              {/* Segmented Filter Control (if both types exist) */}
              {hasBoth && (
                <div className="flex items-center justify-between gap-1 p-1 rounded-2xl bg-surface-hover border border-border">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeFilter === 'all'
                        ? 'bg-surface text-google-blue shadow-xs font-bold'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Layers size={13} />
                    <span>All ({confirmedExpenses.length + confirmedShoppingItems.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter('expenses')}
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeFilter === 'expenses'
                        ? 'bg-surface text-google-blue shadow-xs font-bold'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <IndianRupee size={13} />
                    <span>Expenses ({confirmedExpenses.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFilter('shopping')}
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeFilter === 'shopping'
                        ? 'bg-surface text-google-blue shadow-xs font-bold'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <ShoppingBag size={13} />
                    <span>Shopping ({confirmedShoppingItems.length})</span>
                  </button>
                </div>
              )}

              {/* SECTION 1: EXPENSES CARD LIST */}
              {showExpensesList && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                      <IndianRupee size={13} className="text-google-blue" />
                      <span>Expenses to record ({confirmedExpenses.length})</span>
                    </span>
                    <span className="text-xs font-bold text-text-primary">
                      Total: ₹{totalExpenseCost.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                    {confirmedExpenses.map((exp, idx) => {
                      const catData = categories[exp.category] || { name: exp.category, hex: '#888888' };
                      return (
                        <div
                          key={exp.id}
                          className="p-3 rounded-2xl bg-surface border border-border shadow-xs space-y-2 transition-colors hover:border-google-blue/30"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="w-5 h-5 rounded-full bg-surface-hover text-[11px] font-bold text-text-secondary flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <input
                                type="text"
                                value={exp.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setConfirmedExpenses(prev => prev.map(item => item.id === exp.id ? { ...item, name: val } : item));
                                }}
                                className="w-full text-xs sm:text-sm font-semibold text-text-primary bg-transparent outline-none truncate"
                                placeholder="Expense name"
                              />
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="flex items-center px-2 py-1 rounded-xl bg-surface-hover border border-border focus-within:border-google-blue">
                                <span className="text-xs font-bold text-text-secondary mr-0.5">₹</span>
                                <input
                                  type="number"
                                  value={exp.amount === 0 ? '' : exp.amount}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setConfirmedExpenses(prev => prev.map(item => item.id === exp.id ? { ...item, amount: val } : item));
                                  }}
                                  className="w-14 sm:w-16 text-xs sm:text-sm font-bold text-right text-text-primary bg-transparent outline-none"
                                  placeholder="0"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => setConfirmedExpenses(prev => prev.filter(item => item.id !== exp.id))}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
                                title="Remove expense"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/50">
                            <span 
                              className="w-2 h-2 rounded-full shrink-0" 
                              style={{ backgroundColor: catData.hex || '#888888' }} 
                            />
                            <select
                              value={exp.category}
                              onChange={(e) => {
                                const val = e.target.value;
                                setConfirmedExpenses(prev => prev.map(item => item.id === exp.id ? { ...item, category: val } : item));
                              }}
                              className="text-[11px] py-0.5 pr-2 rounded-lg bg-transparent text-text-secondary outline-none cursor-pointer max-w-[150px] font-medium"
                            >
                              {categoryKeys.map((catKey) => (
                                <option key={catKey} value={catKey}>
                                  {categories[catKey]?.name || catKey}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmedExpenses(prev => [
                          ...prev,
                          {
                            id: `exp_${Date.now()}_new`,
                            name: '',
                            amount: 0,
                            category: categoryKeys[0] || 'other'
                          }
                        ]);
                      }}
                      className="w-full py-1.5 border border-dashed border-border hover:border-google-blue text-xs font-medium text-text-secondary hover:text-google-blue rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Add another expense</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SECTION 2: SHOPPING LIST ITEMS */}
              {showShoppingList && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider px-1 flex items-center gap-1.5">
                    <ShoppingBag size={13} className="text-google-blue" />
                    <span>Shopping items to add ({confirmedShoppingItems.length})</span>
                  </span>

                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                    {confirmedShoppingItems.map((item, idx) => {
                      const catData = categories[item.category] || { name: item.category, hex: '#888888' };
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-2xl bg-surface border border-border shadow-xs space-y-2 transition-colors hover:border-google-blue/30"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="w-5 h-5 rounded-full bg-surface-hover text-[11px] font-bold text-text-secondary flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setConfirmedShoppingItems(prev => prev.map(s => s.id === item.id ? { ...s, name: val } : s));
                                }}
                                className="w-full text-xs sm:text-sm font-semibold text-text-primary bg-transparent outline-none truncate"
                                placeholder="Item name"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => setConfirmedShoppingItems(prev => prev.filter(s => s.id !== item.id))}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors shrink-0"
                              title="Remove item"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/50">
                            <span 
                              className="w-2 h-2 rounded-full shrink-0" 
                              style={{ backgroundColor: catData.hex || '#888888' }} 
                            />
                            <select
                              value={item.category}
                              onChange={(e) => {
                                const val = e.target.value;
                                setConfirmedShoppingItems(prev => prev.map(s => s.id === item.id ? { ...s, category: val } : s));
                              }}
                              className="text-[11px] py-0.5 pr-2 rounded-lg bg-transparent text-text-secondary outline-none cursor-pointer max-w-[150px] font-medium"
                            >
                              {categoryKeys.map((catKey) => (
                                <option key={catKey} value={catKey}>
                                  {categories[catKey]?.name || catKey}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmedShoppingItems(prev => [
                          ...prev,
                          {
                            id: `shop_${Date.now()}_new`,
                            name: '',
                            category: categoryKeys.includes('groceries') ? 'groceries' : (categoryKeys[0] || 'other')
                          }
                        ]);
                      }}
                      className="w-full py-1.5 border border-dashed border-border hover:border-google-blue text-xs font-medium text-text-secondary hover:text-google-blue rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Add another shopping item</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom Actions */}
              <div className="pt-2 border-t border-border flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStage('idle');
                    setInputText('');
                    setInterimText('');
                  }}
                  className="px-3.5 py-3 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                  title="Speak or type different items"
                >
                  <RotateCcw size={14} />
                  <span>Start Over</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAdd}
                  disabled={
                    stage === 'submitting' ||
                    (activeFilter === 'all'
                      ? confirmedExpenses.length === 0 && confirmedShoppingItems.length === 0
                      : activeFilter === 'expenses'
                      ? confirmedExpenses.length === 0
                      : confirmedShoppingItems.length === 0)
                  }
                  className="flex-1 py-3 px-4 rounded-xl bg-google-blue hover:bg-google-blue-hover text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-google-blue/20 active:scale-98 disabled:opacity-50 min-w-0"
                >
                  {stage === 'submitting' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span className="truncate">Adding to {targetLedgerName}...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span className="truncate">
                        {activeFilter === 'all' && hasBoth
                          ? `Add ${confirmedExpenses.length} ${confirmedExpenses.length === 1 ? 'Expense' : 'Expenses'} & ${confirmedShoppingItems.length} ${confirmedShoppingItems.length === 1 ? 'Item' : 'Items'}`
                          : activeFilter === 'expenses' || (!hasBoth && confirmedExpenses.length > 0)
                          ? `Add ${confirmedExpenses.length} ${confirmedExpenses.length === 1 ? 'Expense' : 'Expenses'} to ${targetLedgerName}`
                          : `Add ${confirmedShoppingItems.length} ${confirmedShoppingItems.length === 1 ? 'Item' : 'Items'} to Shopping List`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* VIEW E: SUCCESS STATE */}
          {stage === 'success' && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-2.5 animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-full bg-google-green/10 text-google-green flex items-center justify-center animate-bounce">
                <Check size={30} strokeWidth={2.5} />
              </div>
              <h4 className="text-base font-bold text-text-primary">
                Added Successfully!
              </h4>
              <p className="text-xs text-text-secondary max-w-xs leading-relaxed">
                {confirmedExpenses.length > 0 && confirmedShoppingItems.length > 0
                  ? `${confirmedExpenses.length} expenses recorded & ${confirmedShoppingItems.length} items added to Shopping List`
                  : confirmedExpenses.length > 0
                  ? `${confirmedExpenses.length} expenses recorded into ${targetLedgerName}`
                  : `${confirmedShoppingItems.length} items added to Shopping List`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
