import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  inputSize?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, inputSize = 'md', fullWidth = true, className, ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-8 px-3 text-xs rounded-[var(--radius-md)]',
      md: 'h-9 px-3 text-sm rounded-[var(--radius-md)]',
      lg: 'h-11 px-4 text-base rounded-[var(--radius-lg)]',
    };

    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {label && (
          <label
            className={cn(
              'text-sm font-medium',
              error ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'
            )}
          >
            {label}
            {props.required && <span className="text-[var(--danger)] ml-0.5">*</span>}
          </label>
        )}

        <input
          ref={ref}
          className={cn(
            'input w-full transition-all duration-200',
            'bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)]',
            'placeholder:text-[var(--text-secondary)] placeholder:opacity-60',
            'focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]',
            'disabled:bg-[var(--surface-highlight)] disabled:text-[var(--text-secondary)] disabled:cursor-not-allowed',
            sizeClasses[inputSize],
            error &&
              'border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]/10',
            className
          )}
          onWheel={e => {
            // Prevent scroll from changing number input values
            if (props.type === 'number') {
              e.currentTarget.blur();
            }
          }}
          {...props}
        />

        {(error || helperText) && (
          <p
            className={cn(
              'text-xs',
              error ? 'text-[var(--danger)] font-medium' : 'text-[var(--text-secondary)]'
            )}
            style={error ? { fontSize: 'small', color: 'red', marginTop: '4px' } : undefined}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
