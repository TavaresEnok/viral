import { type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: Array<{ label: string; value: string }>;
}

export function Select({ label, error, options, className, id, ...props }: SelectProps) {
  return (
    <label className="block space-y-2 text-sm text-ink-secondary" htmlFor={id}>
      <span className="font-medium">{label}</span>
      <select
        id={id}
        className={cn(
          'h-12 w-full rounded-input border border-hairline-subtle bg-surface px-4 text-sm text-ink-primary outline-none transition duration-150 ease-smooth focus:border-accent focus:ring-2 focus:ring-accent/25',
          error && 'border-danger',
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-[#FF8A8A]">{error}</p>}
    </label>
  );
}
