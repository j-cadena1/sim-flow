import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ModalContextType {
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  showPrompt: (title: string, message: string, onSubmit: (value: string) => void, defaultValue?: string) => void;
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

type ModalType = 'confirm' | 'prompt' | null;

interface ModalState {
  type: ModalType;
  title: string;
  message: string;
  onConfirm?: () => void;
  onSubmit?: (value: string) => void;
  defaultValue?: string;
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

  const closeModal = useCallback(() => {
    setModal({ type: null, title: '', message: '' });
  }, []);

  return (
    <ModalContext.Provider value={{ showConfirm, showPrompt, closeModal }}>
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
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 max-w-md w-full shadow-2xl animate-scale-in">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="bg-yellow-500/10 p-3 rounded-full">
              <AlertTriangle className="text-yellow-500" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
              <p className="text-slate-400 text-sm">{message}</p>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 max-w-md w-full shadow-2xl animate-scale-in">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm">{message}</p>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <textarea
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
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
