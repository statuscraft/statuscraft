import { useEffect, useMemo, useRef, useState } from 'react';
import { previewModState, type ModContext } from '@statuscraft/core';
import { useEditor } from '../store';
import { usePreviewContext } from './preview';

function useTicker(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

// The same data the mod gets in Claude Code, from the chosen preview scenario. It ticks every
// second, and the turn timer starts when the preview opens, so timers move like the real thing.
export function useModContext(): ModContext {
  const base = usePreviewContext();
  const config = useEditor((s) => s.config);
  const now = useTicker(1000);
  const opened = useRef(Date.now());
  return useMemo(() => {
    const widgets = { ...base, now };
    const state = previewModState(base);
    const elapsed = state.turnStartedAt === undefined ? undefined : base.now - state.turnStartedAt;
    const turnStartedAt = elapsed === undefined ? undefined : opened.current - elapsed;
    return {
      widgets: { ...widgets, companion: widgets.companion && { ...widgets.companion, turnStartedAt } },
      state: { ...state, turnStartedAt },
      config,
      columns: base.terminalWidth,
    };
  }, [base, now, config]);
}
