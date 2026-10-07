import { useState } from 'react';
import { decodeShareCode, encodeShareCode } from '@statuscraft/core';
import { selectLayout, useEditor } from '../store';
import { PipSays } from './Pip';
import { Modal, ToyButton } from './ui';

function CopyField({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex gap-2">
        <input className="input font-mono text-xs" readOnly value={text} onFocus={(event) => event.target.select()} />
        <ToyButton
          tone={copied ? 'green' : 'white'}
          onClick={async () => {
            await navigator.clipboard?.writeText(text).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </ToyButton>
      </div>
    </div>
  );
}

export function ShareDialog() {
  const open = useEditor((s) => s.dialog === 'share');
  const mode = useEditor((s) => s.mode);
  const openDialog = useEditor((s) => s.openDialog);
  const layout = useEditor(selectLayout);
  const change = useEditor((s) => s.change);
  const showToast = useEditor((s) => s.showToast);
  const [incoming, setIncoming] = useState('');
  const [error, setError] = useState<string>();
  const code = encodeShareCode(layout);

  return (
    <Modal open={open} onClose={() => openDialog(undefined)} title="🔗 Share your status line">
      {mode === 'demo' && (
        <div className="mb-5">
          <PipSays mood="content">
            <p>This page is a demo, so it can’t change Claude Code by itself. Paste this in your terminal to install your design:</p>
          </PipSays>
        </div>
      )}
      <div className="space-y-4">
        <CopyField label="Install it with one command" text={`npx statuscraft apply ${code} && npx statuscraft init`} />
        <CopyField label="Share code" text={code} />
        <div>
          <span className="field-label">Got a code from someone?</span>
          <div className="flex gap-2">
            <input
              className="input font-mono text-xs"
              placeholder="sc1.…"
              value={incoming}
              onChange={(event) => (setIncoming(event.target.value), setError(undefined))}
            />
            <ToyButton
              tone="blue"
              disabled={!incoming.trim()}
              onClick={() => {
                const decoded = decodeShareCode(incoming);
                if (!decoded.ok) return setError(decoded.error);
                change(() => decoded.value);
                setIncoming('');
                openDialog(undefined);
                showToast('Loaded! Have a look at the preview.');
              }}
            >
              Load
            </ToyButton>
          </div>
          {error && <p className="mt-1 text-sm font-bold text-brick-red">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}

export function ProjectDialog() {
  const open = useEditor((s) => s.dialog === 'project');
  const openDialog = useEditor((s) => s.openDialog);
  const project = useEditor((s) => s.server?.project);
  const busy = useEditor((s) => s.busy);
  const saveForProject = useEditor((s) => s.saveForProject);

  return (
    <Modal open={open} onClose={() => openDialog(undefined)} title="📁 Use it in one project">
      <p className="mb-4 text-ink-600">
        Projects can have their own status line. When Claude Code runs in <code className="rounded bg-cream-200 px-1 font-mono text-sm">{project?.dir}</code>, StatusCraft draws this design instead of your usual one.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" disabled={busy} onClick={() => saveForProject('project')} className="rounded-2xl border-[3px] border-ink-800 bg-white p-4 text-left shadow-chunky hover:-translate-y-0.5">
          <span className="block text-lg font-black">👥 For the whole team</span>
          <span className="block text-sm text-ink-600">Saved in <code>.claude/statuscraft.json</code>. Commit it and teammates get it too.</span>
          {project?.project && <span className="mt-2 block text-xs font-bold text-brick-green">This project already has one: it will be replaced.</span>}
        </button>
        <button type="button" disabled={busy} onClick={() => saveForProject('local')} className="rounded-2xl border-[3px] border-ink-800 bg-white p-4 text-left shadow-chunky hover:-translate-y-0.5">
          <span className="block text-lg font-black">🙋 Just for me</span>
          <span className="block text-sm text-ink-600">Saved in <code>.claude/statuscraft.local.json</code>. Add it to .gitignore.</span>
          {project?.local && <span className="mt-2 block text-xs font-bold text-brick-green">You already have one here: it will be replaced.</span>}
        </button>
      </div>
    </Modal>
  );
}
