import React, { useState, useRef, useCallback } from 'react';

interface VoiceInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
  required?: boolean;
  error?: string;
  name?: string;
  disabled?: boolean;
}

/**
 * Textarea with optional voice-to-text input using the native Web Speech API.
 * Gracefully degrades: if Speech API is not supported, just shows a normal textarea.
 */
export const VoiceInput: React.FC<VoiceInputProps> = ({
  value,
  onChange,
  placeholder = 'Tap the mic to dictate or type here...',
  rows = 3,
  label,
  required = false,
  error,
  name,
  disabled = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(
    () => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  );
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    if (disabled) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      // Append transcript to existing value
      onChange(value ? `${value} ${transcript}` : transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [value, onChange, disabled]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  return (
    <div>
      {label && (
        <label
          className={`block text-sm font-semibold mb-1 ${error ? 'text-red-500' : 'text-gray-700'}`}
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <textarea
          name={name}
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`input pr-12 resize-none disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 bg-red-50/10' : ''}`}
        />
        {isSupported && !disabled && (
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            title={isListening ? 'Stop dictation' : 'Dictate with voice'}
            className={`
              absolute right-2 bottom-2 p-2 rounded-lg transition-all
              ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-gray-100 text-gray-500 hover:bg-[var(--primary)] hover:text-white'
              }
            `}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 15c1.66 0 2.99-1.34 2.99-3L15 6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 15 6.7 12H5c0 3.41 2.72 6.23 6 6.72V21h2v-2.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
            </svg>
          </button>
        )}
      </div>
      {isListening && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse inline-block" />
          Listening... speak clearly
        </p>
      )}
      {error && (
        <p
          className="text-red-500 text-xs mt-1"
          style={{ fontSize: 'small', color: 'red', marginTop: '4px' }}
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default VoiceInput;
