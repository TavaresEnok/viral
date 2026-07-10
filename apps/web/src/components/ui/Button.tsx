import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-pill text-sm font-semibold transition duration-150 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50',
          size === 'md' ? 'h-[46px] px-5' : 'h-9 px-4',
          variant === 'primary' && 'bg-accent font-bold text-[#10120A] hover:brightness-105',
          variant === 'secondary' && 'border border-hairline-strong bg-transparent text-ink-primary hover:bg-elevated/60',
          variant === 'tonal' && 'bg-elevated text-ink-primary hover:bg-overlay',
          variant === 'ghost' && 'text-ink-secondary hover:bg-elevated hover:text-ink-primary',
          variant === 'danger' && 'border border-[rgba(255,79,90,0.35)] bg-[rgba(255,79,90,0.12)] text-[#FF8A8A] hover:bg-[rgba(255,79,90,0.2)]',
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
