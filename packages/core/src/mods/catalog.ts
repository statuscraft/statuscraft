import type { WidgetOption } from '../widgets/define';
import type { ModInstance, ModOptionValue, ModsConfig } from './schema';

// Where a mod shows up in Claude Code. The editor draws one drop zone per slot.
export const MOD_SLOTS = [
  { id: 'band', name: 'Above the prompt', emoji: '🎞️', description: 'A live band between the answer and the prompt box' },
  { id: 'spinner', name: 'Spinner', emoji: '🌀', description: 'The “Thinking…” line while Claude works' },
  { id: 'tools', name: 'Tool calls', emoji: '🛠️', description: 'The row Claude Code draws for each tool Claude uses' },
  { id: 'footer', name: 'Under each answer', emoji: '🧾', description: 'A short line after every answer' },
  { id: 'hint', name: 'Prompt hint', emoji: '💡', description: 'The hint line under the prompt box' },
  { id: 'alert', name: 'Pop-up alerts', emoji: '🔔', description: 'A notice when something needs your attention' },
  { id: 'guard', name: 'Safety guards', emoji: '🛡️', description: 'Asks you before Claude runs something risky' },
  { id: 'prompt', name: 'Prompt shortcuts', emoji: '⌨️', description: 'Short codes that grow into full prompts when you send them' },
  { id: 'command', name: 'Slash commands', emoji: '⚡', description: 'Your own /commands that answer at once' },
] as const;

export type ModSlot = (typeof MOD_SLOTS)[number]['id'];

export interface ModDefinition {
  // Saved in config files: never rename an existing type
  readonly type: string;
  readonly name: string;
  readonly description: string;
  readonly emoji: string;
  readonly slot: ModSlot;
  readonly color: string;
  // Can be placed more than once
  readonly multiple?: boolean;
  readonly options?: readonly WidgetOption[];
}

const COLOR_CHOICES = [
  { value: 'default', label: 'Terminal default' },
  { value: 'gray', label: 'Gray' },
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'blue', label: 'Blue' },
  { value: 'magenta', label: 'Magenta' },
  { value: 'cyan', label: 'Cyan' },
] as const;

const PLACEHOLDERS = 'Use {model} {context} {branch} {cost} {project} {tools} {turns} {limit}';

export const MODS: readonly ModDefinition[] = [
  {
    type: 'live-statusline',
    name: 'Live Status Line',
    description: 'Your status line, drawn above the prompt and refreshed every second, so clocks and timers tick',
    emoji: '🎞️',
    slot: 'band',
    color: '#E53935',
    options: [
      { key: 'profile', label: 'Profile (empty: the one in use)', kind: 'text', placeholder: 'default', default: '' },
      { key: 'refresh', label: 'Refresh every (seconds)', kind: 'number', min: 1, max: 60, default: 1 },
    ],
  },
  {
    type: 'context-meter',
    name: 'Context Meter',
    description: 'A big context bar that turns yellow, then red, with a sparkline of the last turns',
    emoji: '🌡️',
    slot: 'band',
    color: '#8E24AA',
    options: [
      { key: 'label', label: 'Label', kind: 'text', placeholder: 'Context', default: 'Context' },
      { key: 'width', label: 'Bar width', kind: 'number', min: 8, max: 60, default: 24 },
      { key: 'sparkline', label: 'Show the last turns', kind: 'toggle', default: true },
    ],
  },
  {
    type: 'band-text',
    name: 'Banner Text',
    description: 'A line of your own text above the prompt. ' + PLACEHOLDERS,
    emoji: '✏️',
    slot: 'band',
    color: '#546E7A',
    multiple: true,
    options: [
      { key: 'text', label: 'Text', kind: 'text', placeholder: '🌿 {branch} · {model}', default: '🌿 {branch} · 🤖 {model} · 💰 {cost}' },
      { key: 'color', label: 'Color', kind: 'select', choices: COLOR_CHOICES, default: 'cyan' },
      { key: 'bold', label: 'Bold', kind: 'toggle', default: false },
    ],
  },
  {
    type: 'burn-rate',
    name: 'Burn Rate',
    description: 'What this session costs per hour, and whether your 5-hour limit lasts until it resets at this pace',
    emoji: '💸',
    slot: 'band',
    color: '#2E7D32',
    options: [
      { key: 'cost', label: 'Show cost per hour', kind: 'toggle', default: true },
      { key: 'limit', label: 'Show the 5-hour limit forecast', kind: 'toggle', default: true },
    ],
  },
  {
    type: 'limit-bars',
    name: 'Limit Bars',
    description: 'Bars for your 5-hour and weekly limits, with the time until each resets',
    emoji: '🔋',
    slot: 'band',
    color: '#00838F',
    options: [{ key: 'width', label: 'Bar width', kind: 'number', min: 4, max: 30, default: 10 }],
  },
  {
    type: 'spinner-tools',
    name: 'Tool Counter',
    description: 'Shows how many tools Claude used, next to the spinner',
    emoji: '🔧',
    slot: 'spinner',
    color: '#FB8C00',
    options: [
      {
        key: 'scope',
        label: 'Count',
        kind: 'select',
        choices: [
          { value: 'turn', label: 'This answer' },
          { value: 'session', label: 'The whole session' },
        ],
        default: 'turn',
      },
    ],
  },
  {
    type: 'spinner-timer',
    name: 'Turn Timer',
    description: 'Shows how long Claude has been working on this answer',
    emoji: '⏱️',
    slot: 'spinner',
    color: '#F4511E',
  },
  {
    type: 'spinner-active-tool',
    name: 'Active Tool',
    description: 'Shows which tool Claude is running right now, next to the spinner',
    emoji: '▶️',
    slot: 'spinner',
    color: '#EF6C00',
  },
  {
    type: 'spinner-pip',
    name: 'Pip in the Spinner',
    description: 'Pip rides along the spinner and panics when context or limits run low',
    emoji: '🧱',
    slot: 'spinner',
    color: '#FDD835',
    options: [
      {
        key: 'style',
        label: 'Face',
        kind: 'select',
        choices: [
          { value: 'kaomoji', label: '(^_^) Kaomoji' },
          { value: 'emoji', label: '😄 Emoji' },
          { value: 'ascii', label: ':D ASCII' },
        ],
        default: 'kaomoji',
      },
    ],
  },
  {
    type: 'spinner-words',
    name: 'Spinner Words',
    description: 'Swap “Thinking” for words of your own, a new one each answer',
    emoji: '💬',
    slot: 'spinner',
    color: '#00897B',
    options: [{ key: 'words', label: 'Words (comma separated)', kind: 'text', placeholder: 'Stacking, Snapping', default: 'Stacking bricks, Snapping studs, Building, Clicking together' }],
  },
  {
    type: 'tool-timer',
    name: 'Tool Timer',
    description: 'Shows how long a tool call took, on its row, when it was slow',
    emoji: '⏲️',
    slot: 'tools',
    color: '#5D4037',
    options: [{ key: 'over', label: 'Only when slower than (seconds)', kind: 'number', min: 0, max: 600, default: 2 }],
  },
  {
    type: 'turn-summary',
    name: 'Turn Summary',
    description: 'A line under each answer: how long it took, tools used and tokens',
    emoji: '🧾',
    slot: 'footer',
    color: '#43A047',
    options: [
      { key: 'time', label: 'Show time', kind: 'toggle', default: true },
      { key: 'tools', label: 'Show tools', kind: 'toggle', default: true },
      { key: 'tokens', label: 'Show tokens', kind: 'toggle', default: true },
      { key: 'context', label: 'Show context', kind: 'toggle', default: false },
    ],
  },
  {
    type: 'prompt-hint',
    name: 'Prompt Hint',
    description: 'Your own text in the hint line under the prompt. ' + PLACEHOLDERS,
    emoji: '💡',
    slot: 'hint',
    color: '#1E88E5',
    options: [{ key: 'text', label: 'Text', kind: 'text', placeholder: '{branch} · {context}', default: '🌿 {branch} · 🧠 {context} used' }],
  },
  {
    type: 'context-alert',
    name: 'Context Alert',
    description: 'A pop-up when the context gets full, so you can /compact in time',
    emoji: '🔔',
    slot: 'alert',
    color: '#C62828',
    options: [{ key: 'at', label: 'Warn at (%)', kind: 'number', min: 10, max: 99, default: 80 }],
  },
  {
    type: 'limit-alert',
    name: 'Limit Alert',
    description: 'A pop-up when your 5-hour usage limit gets close',
    emoji: '⏳',
    slot: 'alert',
    color: '#AD1457',
    options: [{ key: 'at', label: 'Warn at (%)', kind: 'number', min: 10, max: 99, default: 80 }],
  },
  {
    type: 'done-alert',
    name: 'Done Alert',
    description: 'A pop-up when Claude finishes a long answer, so you can look away',
    emoji: '✅',
    slot: 'alert',
    color: '#558B2F',
    options: [{ key: 'after', label: 'For answers longer than (seconds)', kind: 'number', min: 5, max: 3600, default: 60 }],
  },
  {
    type: 'danger-guard',
    name: 'Danger Guard',
    description: 'Asks you first when Claude wants to delete files, force push or throw work away',
    emoji: '🛡️',
    slot: 'guard',
    color: '#3949AB',
    options: [
      { key: 'deletes', label: 'Deleting folders (rm -rf)', kind: 'toggle', default: true },
      { key: 'forcePush', label: 'Force push (git push --force)', kind: 'toggle', default: true },
      { key: 'discard', label: 'Throwing work away (git reset --hard, git clean -f)', kind: 'toggle', default: true },
      { key: 'words', label: 'Also ask when a command contains', kind: 'text', placeholder: 'terraform destroy, DROP TABLE', default: '' },
    ],
  },
  {
    type: 'protected-files',
    name: 'Protected Files',
    description: 'Asks before Claude edits matching files with its file tools',
    emoji: '🔐',
    slot: 'guard',
    color: '#283593',
    options: [
      {
        key: 'files',
        label: 'Files to protect (comma separated, * is a wildcard)',
        kind: 'text',
        placeholder: '.env, *.pem, .git/',
        default: '.env, .env.*, *.pem, *.key, id_rsa, id_ed25519, .git/, package-lock.json, bun.lock, yarn.lock, pnpm-lock.yaml',
      },
    ],
  },
  {
    type: 'prompt-shortcuts',
    name: 'Prompt Shortcuts',
    description: 'Type ;tests and it grows into a full prompt when you send it',
    emoji: '⌨️',
    slot: 'prompt',
    color: '#4527A0',
    options: [
      {
        key: 'shortcuts',
        label: 'Shortcuts (;name = prompt, separated by |)',
        kind: 'text',
        placeholder: ';tests = Write tests for what you just changed',
        default: ';tests = Write tests for what you just changed, then run them | ;review = Review my uncommitted changes and list anything risky | ;explain = Explain the last change in plain words',
      },
    ],
  },
  {
    type: 'quick-command',
    name: 'Quick Command',
    description: 'A /command that runs a shell command you review and approve',
    emoji: '⚡',
    slot: 'command',
    color: '#6D4C41',
    multiple: true,
    options: [
      { key: 'name', label: 'Command name (after the /)', kind: 'text', placeholder: 'gs', default: 'gs' },
      { key: 'command', label: 'Runs', kind: 'text', placeholder: 'git status --short', default: 'git status --short' },
      { key: 'description', label: 'Description', kind: 'text', placeholder: 'What it does', default: 'Quick git status' },
    ],
  },
];

const BY_TYPE = new Map(MODS.map((mod) => [mod.type, mod]));

export function getMod(type: string): ModDefinition | undefined {
  return BY_TYPE.get(type);
}

export function modsInSlot(slot: ModSlot): readonly ModDefinition[] {
  return MODS.filter((mod) => mod.slot === slot);
}

export function slotOf(instance: Pick<ModInstance, 'type'>): ModSlot | undefined {
  return getMod(instance.type)?.slot;
}

// Placed, switched on and known, in the order they were placed
export function enabledMods(config: ModsConfig, slot?: ModSlot): ModInstance[] {
  return config.mods.filter((mod) => mod.enabled !== false && getMod(mod.type) && (!slot || getMod(mod.type)!.slot === slot));
}

export function canAddMod(config: ModsConfig, type: string): boolean {
  const definition = getMod(type);
  if (!definition) return false;
  return definition.multiple === true || !config.mods.some((mod) => mod.type === type);
}

function optionDefault(type: string, key: string): ModOptionValue | undefined {
  return getMod(type)?.options?.find((option) => option.key === key)?.default;
}

export function modString(instance: ModInstance, key: string, fallback = ''): string {
  const value = instance.options[key] ?? optionDefault(instance.type, key);
  return value === undefined ? fallback : String(value);
}

export function modNumber(instance: ModInstance, key: string, fallback = 0): number {
  const value = Number(instance.options[key] ?? optionDefault(instance.type, key));
  return Number.isFinite(value) ? value : fallback;
}

export function modBoolean(instance: ModInstance, key: string, fallback = false): boolean {
  const value = instance.options[key] ?? optionDefault(instance.type, key);
  if (value === undefined) return fallback;
  return value === true || value === 'true' || value === 1;
}

export function newModInstance(type: string, existing: readonly ModInstance[] = []): ModInstance {
  let n = existing.length + 1;
  const ids = new Set(existing.map((mod) => mod.id));
  while (ids.has(`${type}-${n}`)) n++;
  const options: Record<string, ModOptionValue> = {};
  if (type === 'quick-command') {
    // Each quick command needs its own name, and one without a name of its own is /gs
    const names = new Set(existing.filter((mod) => mod.type === 'quick-command').map((mod) => modString(mod, 'name')));
    let i = 1;
    while (names.has(i === 1 ? 'gs' : `cmd${i}`)) i++;
    if (i > 1) options['name'] = `cmd${i}`;
  }
  return { id: `${type}-${n}`, type, enabled: true, options };
}
