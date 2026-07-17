/**
 * ConfirmDialog — Branded replacement for window.confirm / window.prompt / window.alert
 *
 * Two ways to use it (both backed by the same provider):
 *
 * 1. Hook (inside components):
 *    const { confirm, prompt } = useConfirm();
 *    if (await confirm({ title: 'Delete?', message: 'This cannot be undone.' })) { ... }
 *
 * 2. Imperative (anywhere, including plain handlers — no hook needed):
 *    import { confirmDialog, promptDialog } from '@/components/ui';
 *    if (await confirmDialog({ title: 'Delete?', variant: 'danger' })) { ... }
 *    const reason = await promptDialog({ title: 'Reason', message: 'Enter reason:' });
 *
 * Mount <ConfirmDialogProvider> once near the app root.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Trash2, Info, CheckCircle2 } from 'lucide-react';

type Variant = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
}

export interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  required?: boolean;
}

interface DialogState {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: Variant;
  /** if set, renders a text input (prompt mode) */
  promptOptions?: { placeholder?: string; required?: boolean };
  resolve?: (value: boolean | string | null) => void;
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

// Module-level registry so plain functions can open the dialog without the hook.
let registeredConfirm: ConfirmContextValue['confirm'] | null = null;
let registeredPrompt: ConfirmContextValue['prompt'] | null = null;

/** Imperative confirm — usable outside React components. Falls back to `false` if the provider is not mounted. */
export const confirmDialog = (opts: ConfirmOptions): Promise<boolean> => {
  if (!registeredConfirm) return Promise.resolve(false);
  return registeredConfirm(opts);
};

/** Imperative prompt — usable outside React components. Falls back to `null` if the provider is not mounted. */
export const promptDialog = (opts: PromptOptions): Promise<string | null> => {
  if (!registeredPrompt) return Promise.resolve(null);
  return registeredPrompt(opts);
};

const variantConfig: Record<
  Variant,
  { icon: React.ReactNode; iconBg: string; confirmCls: string }
> = {
  danger: {
    icon: <Trash2 className="w-5 h-5 text-red-600" />,
    iconBg: 'bg-red-100',
    confirmCls: 'bg-red-600 hover:bg-red-700 text-white border-transparent focus:ring-red-500',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
    iconBg: 'bg-amber-100',
    confirmCls:
      'bg-amber-500 hover:bg-amber-600 text-white border-transparent focus:ring-amber-400',
  },
  info: {
    icon: <Info className="w-5 h-5 text-blue-600" />,
    iconBg: 'bg-blue-100',
    confirmCls: 'bg-[var(--primary)] hover:opacity-90 text-white border-transparent',
  },
  success: {
    icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
    iconBg: 'bg-green-100',
    confirmCls:
      'bg-green-600 hover:bg-green-700 text-white border-transparent focus:ring-green-500',
  },
};

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DialogState>({
    open: false,
    title: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    variant: 'danger',
  });

  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions): Promise<boolean> =>
      new Promise(resolve => {
        setState({
          open: true,
          title: opts.title,
          message: opts.message,
          confirmLabel: opts.confirmLabel ?? 'Confirm',
          cancelLabel: opts.cancelLabel ?? 'Cancel',
          variant: opts.variant ?? 'danger',
          promptOptions: undefined,
          resolve: resolve as DialogState['resolve'],
        });
      }),
    []
  );

  const prompt = useCallback((opts: PromptOptions): Promise<string | null> => {
    setInputValue('');
    return new Promise(resolve => {
      setState({
        open: true,
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? 'Submit',
        cancelLabel: opts.cancelLabel ?? 'Cancel',
        variant: opts.variant ?? 'info',
        promptOptions: {
          placeholder: opts.placeholder,
          required: opts.required ?? true,
        },
        resolve: resolve as DialogState['resolve'],
      });
      // focus input after render
      setTimeout(() => inputRef.current?.focus(), 50);
    });
  }, []);

  // Register the imperative API for non-hook call sites
  useEffect(() => {
    registeredConfirm = confirm;
    registeredPrompt = prompt;
    return () => {
      registeredConfirm = null;
      registeredPrompt = null;
    };
  }, [confirm, prompt]);

  const handleConfirm = useCallback(() => {
    setState(s => {
      if (!s.open) return s;
      if (s.promptOptions) {
        if (s.promptOptions.required && !inputValue.trim()) return s;
        s.resolve?.(inputValue.trim() || null);
      } else {
        s.resolve?.(true);
      }
      return { ...s, open: false };
    });
  }, [inputValue]);

  const handleCancel = useCallback(() => {
    setState(s => {
      if (!s.open) return s;
      s.resolve?.(s.promptOptions ? null : false);
      return { ...s, open: false };
    });
  }, []);

  // Keyboard support: Escape cancels; Enter confirms (non-prompt mode — the
  // prompt input handles its own Enter so typing isn't hijacked)
  useEffect(() => {
    if (!state.open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleCancel();
      } else if (e.key === 'Enter' && !state.promptOptions) {
        e.stopPropagation();
        handleConfirm();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [state.open, state.promptOptions, handleCancel, handleConfirm]);

  const cfg = variantConfig[state.variant];

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}

      {state.open && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCancel}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            className="relative bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--border)]"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${cfg.iconBg}`}
                >
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2
                    id="confirm-title"
                    className="text-base font-semibold text-[var(--text-primary)] leading-tight"
                  >
                    {state.title}
                  </h2>
                  {state.message && (
                    <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                      {state.message}
                    </p>
                  )}
                </div>
              </div>

              {state.promptOptions && (
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleConfirm();
                  }}
                  placeholder={state.promptOptions.placeholder ?? ''}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface-secondary)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition"
                />
              )}
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-highlight)] border border-[var(--border)] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--border)]"
              >
                {state.cancelLabel}
              </button>
              <button
                onClick={handleConfirm}
                disabled={!!state.promptOptions?.required && !inputValue.trim()}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${cfg.confirmCls}`}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmContextValue => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used inside <ConfirmDialogProvider>');
  }
  return ctx;
};
