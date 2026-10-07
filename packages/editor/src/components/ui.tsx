import { useEffect } from 'react';
import clsx from 'clsx';

export function ToyButton({
  tone = 'white',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'green' | 'yellow' | 'blue' | 'red' | 'white' }) {
  const tones = {
    green: 'bg-brick-green text-white',
    yellow: 'bg-brick-yellow text-ink-800',
    blue: 'bg-brick-blue text-white',
    red: 'bg-brick-red text-white',
    white: 'bg-white text-ink-800',
  };
  return <button type="button" className={clsx('toy-button', tones[tone], className)} {...props} />;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={clsx('card max-h-[90vh] w-full animate-pop overflow-y-auto p-6', wide ? 'max-w-5xl' : 'max-w-xl')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-black">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full px-2 text-2xl leading-none text-ink-400 hover:text-ink-800" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-1.5">
      <span>
        <span className="font-bold">{label}</span>
        {hint && <span className="block text-sm text-ink-400">{hint}</span>}
      </span>
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(event) => (event.key === ' ' || event.key === 'Enter') && (event.preventDefault(), onChange(!checked))}
        onClick={(event) => (event.preventDefault(), onChange(!checked))}
        className={clsx(
          'relative mt-0.5 h-7 w-12 shrink-0 rounded-full border-[3px] border-ink-800 transition-colors',
          checked ? 'bg-brick-green' : 'bg-cream-200',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-[18px] w-[18px] rounded-full border-2 border-ink-800 bg-white transition-all',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </span>
    </label>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: React.ReactNode; title?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          type="button"
          key={String(option.value)}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={clsx('chip', option.value === value && 'chip-on')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx('mb-5', className)}>
      <h3 className="field-label">{title}</h3>
      {children}
    </section>
  );
}
