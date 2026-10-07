import { forwardRef } from 'react';
import clsx from 'clsx';
import { readableTextOn } from '../lib/colors';

export interface BrickProps extends React.HTMLAttributes<HTMLDivElement> {
  color: string;
  emoji: string;
  name: string;
  value?: string | null;
  selected?: boolean;
  dragging?: boolean;
  compact?: boolean;
}

export const Brick = forwardRef<HTMLDivElement, BrickProps>(function Brick(
  { color, emoji, name, value, selected, dragging, compact, className, style, ...rest },
  ref,
) {
  const studs = Math.min(4, Math.max(2, Math.round((name.length + (value?.length ?? 0) / 2) / 6)));
  return (
    <div
      ref={ref}
      className={clsx('brick select-none', selected && 'brick-selected', dragging && 'brick-dragging', className)}
      style={{ '--brick': color, '--brick-text': readableTextOn(color), ...style } as React.CSSProperties}
      {...rest}
    >
      <div className="brick-studs" aria-hidden>
        {Array.from({ length: studs }, (_, i) => (
          <span key={i} className="brick-stud" />
        ))}
      </div>
      <div className={clsx('flex items-center gap-2', compact ? 'px-2.5 py-1.5' : 'px-3 py-2')}>
        <span className="text-base leading-none" aria-hidden>{emoji}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold leading-tight">{name}</span>
          {value && <span className="block max-w-[11rem] truncate font-mono text-[11px] leading-tight opacity-85">{value}</span>}
        </span>
      </div>
    </div>
  );
});
