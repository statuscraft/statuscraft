import { useEditor } from '../store';
import { Pip } from './Pip';

const STEPS = [
  { emoji: '🧱', title: 'Pick bricks', text: 'Click or drag bricks from the brick box. Drag them around to change the order.' },
  { emoji: '🎨', title: 'Make it yours', text: 'Click a brick to recolor it. Click empty space to change the whole look.' },
  { emoji: '🚀', title: 'Press Apply', text: 'Claude Code shows your new status line after its next answer.' },
];

export function HowItWorks() {
  const installed = useEditor((s) => s.server?.install.ours);
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center gap-3">
        <Pip mood="happy" size={40} />
        <h2 className="text-lg font-black">How it works</h2>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="rounded-xl bg-cream-100 p-3">
            <span className="text-2xl">{step.emoji}</span>
            <p className="font-black">
              {i + 1}. {step.title}
            </p>
            <p className="text-sm text-ink-600">{step.text}</p>
          </li>
        ))}
      </ol>
      <details className="mt-3 text-sm text-ink-600">
        <summary className="cursor-pointer font-bold text-ink-800">More tricks</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <b>Profiles</b> keep several designs. Let one switch on by itself in certain repos or folders (Profile → Manage).
          </li>
          <li>
            <b>Project</b> saves a design for one project only. Commit <code>.claude/statuscraft.json</code> to share it with your team.
          </li>
          <li>
            <b>Turn Timer</b> and <b>Tool Calls</b> need the StatusCraft plugin: run <code>/plugin marketplace add statuscraft/statuscraft</code> then{' '}
            <code>/plugin install statuscraft@statuscraft</code> in Claude Code.
          </li>
          <li>
            Something not showing? Run <code>npx statuscraft doctor</code>.{installed ? '' : ' Your status line switches on when you press Apply.'}
          </li>
        </ul>
      </details>
    </section>
  );
}
