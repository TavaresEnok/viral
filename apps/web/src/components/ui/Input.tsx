import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, label, error, id, ...props }, ref) => {
  return (
    <label className="block space-y-2 text-sm text-ink-secondary" htmlFor={id}>
      {label && <span className="font-medium">{label}</span>}
      <input
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        className={cn(
          'h-12 w-full rounded-input border border-hairline-subtle bg-surface px-4 text-sm text-ink-primary outline-none transition duration-150 ease-smooth placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent/25',
          error && 'border-danger focus:border-danger focus:ring-danger/30',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-[#FF8A8A]">{error}</p>}
    </label>
  );
});

Input.displayName = 'Input';
