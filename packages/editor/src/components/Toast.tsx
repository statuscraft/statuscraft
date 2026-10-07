import { useEditor } from '../store';
import { Pip } from './Pip';

export function Toast() {
  const toast = useEditor((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div key={toast.id} role="status" className="card pointer-events-auto flex max-w-xl animate-pop items-center gap-3 px-4 py-3">
        <Pip mood={toast.mood} size={44} className="shrink-0" />
        <p className="font-bold">{toast.text}</p>
      </div>
    </div>
  );
}
