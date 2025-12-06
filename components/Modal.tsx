import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ModalContextType {
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  showPrompt: (title: string, message: string, onSubmit: (value: string) => void, defaultValue?: string) => void;
  showDiscussionRequest: (currentHours: number, onSubmit: (reason: string, suggestedHours?: number) => void) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
}

type ModalType = 'confirm' | 'prompt' | 'discussionRequest' | null;

interface ModalState {
  type: ModalType;
  title: string;
  message: string;
  onConfirm?: () => void;
  onSubmit?: (value: string) => void;
  onDiscussionSubmit?: (reason: string, suggestedHours?: number) => void;
  defaultValue?: string;
  currentHours?: number;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [modal, setModal] = useState<ModalState>({
    type: null,
    title: '',
    message: '',
  });

  const showConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      setModal({ type: 'confirm', title, message, onConfirm });
    },
    []
  );

  const showPrompt = useCallback(
    (title: string, message: string, onSubmit: (value: string) => void, defaultValue = '') => {
      setModal({ type: 'prompt', title, message, onSubmit, defaultValue });
    },
    []
  );

  const showDiscussionRequest = useCallback(
    (currentHours: number, onSubmit: (reason: string, suggestedHours?: number) => void) => {
      setModal({ type: 'discussionRequest', title: '', message: '', onDiscussionSubmit: onSubmit, currentHours });
    },
    []
  );

  const closeModal = useCallback(() => {
    setModal({ type: null, title: '', message: '' });
  }, []);

  return (
    <ModalContext.Provider value={{ showConfirm, showPrompt, showDiscussionRequest, closeModal }}>
      {children}
      {modal.type === 'confirm' && (
        <ConfirmModal
          title={modal.title}
          message={modal.message}
          onConfirm={() => {
            modal.onConfirm?.();
            closeModal();
          }}
          onCancel={closeModal}
        />
      )}
      {modal.type === 'prompt' && (
        <PromptModal
          title={modal.title}
          message={modal.message}
          defaultValue={modal.defaultValue || ''}
          onSubmit={value => {
            modal.onSubmit?.(value);
            closeModal();
          }}
          onCancel={closeModal}
        />
      )}
      {modal.type === 'discussionRequest' && (
        <DiscussionRequestModal
          currentHours={modal.currentHours || 0}
          onSubmit={(reason, suggestedHours) => {
            modal.onDiscussionSubmit?.(reason, suggestedHours);
            closeModal();
          }}
          onCancel={closeModal}
        />
      )}
    </ModalContext.Provider>
  );
};

// Confirm Modal Component
interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ title, message, onConfirm, onCancel }) => {
  // Handle Escape key to close modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 max-w-md w-full shadow-2xl animate-scale-in">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="bg-yellow-500/10 p-3 rounded-full" aria-hidden="true">
              <AlertTriangle className="text-yellow-500" size={24} />
            </div>
            <div className="flex-1">
              <h2 id="confirm-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h2>
              <p id="confirm-modal-description" className="text-gray-600 dark:text-slate-400 text-sm">{message}</p>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// Prompt Modal Component
interface PromptModalProps {
  title: string;
  message: string;
  defaultValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

const PromptModal: React.FC<PromptModalProps> = ({
  title,
  message,
  defaultValue,
  onSubmit,
  onCancel,
}) => {
  const [value, setValue] = useState(defaultValue);

  // Handle Escape key to close modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-modal-title"
      aria-describedby="prompt-modal-description"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 max-w-md w-full shadow-2xl animate-scale-in">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 id="prompt-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h2>
                <p id="prompt-modal-description" className="text-gray-600 dark:text-slate-400 text-sm">{message}</p>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>
            <label htmlFor="prompt-input" className="sr-only">{title}</label>
            <textarea
              id="prompt-input"
              className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              value={value}
              onChange={e => setValue(e.target.value)}
              autoFocus
              placeholder="Enter your response..."
            />
          </div>
          <div className="flex gap-3 p-6 pt-0">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Discussion Request Modal Component
interface DiscussionRequestModalProps {
  currentHours: number;
  onSubmit: (reason: string, suggestedHours?: number) => void;
  onCancel: () => void;
}

const DiscussionRequestModal: React.FC<DiscussionRequestModalProps> = ({
  currentHours,
  onSubmit,
  onCancel,
}) => {
  const [reason, setReason] = useState('');
  const [suggestedHours, setSuggestedHours] = useState('');
  const [error, setError] = useState('');

  // Handle Escape key to close modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (reason.trim().length < 5) {
      setError('Reason must be at least 5 characters');
      return;
    }

    const hours = suggestedHours.trim() ? Number(suggestedHours) : undefined;
    if (suggestedHours.trim() && (isNaN(hours!) || hours! < 1)) {
      setError('Please enter a valid number of hours (at least 1)');
      return;
    }

    onSubmit(reason.trim(), hours);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discussion-modal-title"
      aria-describedby="discussion-modal-description"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 max-w-lg w-full shadow-2xl animate-scale-in">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 id="discussion-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Request Discussion</h2>
                <p id="discussion-modal-description" className="text-gray-600 dark:text-slate-400 text-sm">Explain what you need to discuss with the manager</p>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Reason */}
              <div>
                <label htmlFor="discussion-reason" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Reason for Discussion <span className="text-red-400" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <textarea
                  id="discussion-reason"
                  className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={4}
                  value={reason}
                  onChange={e => {
                    setReason(e.target.value);
                    setError('');
                  }}
                  autoFocus
                  required
                  aria-describedby="reason-hint"
                  placeholder="I don't think this is enough time because..."
                />
                <p id="reason-hint" className="text-xs text-gray-500 dark:text-slate-500 mt-1">Minimum 5 characters</p>
              </div>

              {/* Current Hours Display */}
              <div className="bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-slate-400">Current Allocation:</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white font-mono" aria-label={`${currentHours} hours`}>{currentHours}h</span>
                </div>
              </div>

              {/* Suggested Hours */}
              <div>
                <label htmlFor="suggested-hours" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Suggested Hours (Optional)
                </label>
                <input
                  id="suggested-hours"
                  type="number"
                  min="1"
                  step="1"
                  className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={suggestedHours}
                  onChange={e => {
                    setSuggestedHours(e.target.value);
                    setError('');
                  }}
                  aria-describedby="hours-hint"
                  placeholder="Leave empty to discuss without suggesting new hours"
                />
                <p id="hours-hint" className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                  Enter a number if you want to propose different hours
                </p>
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-3" role="alert">
                  <p className="text-sm text-red-400 flex items-center gap-2">
                    <AlertTriangle size={16} aria-hidden="true" />
                    {error}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 p-6 pt-0">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
            >
              Send Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
