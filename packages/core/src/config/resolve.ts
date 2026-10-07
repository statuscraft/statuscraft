import { currentDir, projectDir } from '../input/parse';
import type { StatusInput } from '../input/types';
import { createDefaultSettings, type Settings } from '../types/settings';
import { DEFAULT_PROFILE, type ProjectConfig, type RuleMatch, type StatusCraftConfig } from './model';

export type LayoutSource =
  | 'env'
  | 'session'
  | 'local-file'
  | 'project-file'
  | 'rule'
  | 'active-profile'
  | 'built-in';

export interface ResolveOptions {
  readonly config?: StatusCraftConfig;
  readonly project?: ProjectConfig;
  readonly local?: ProjectConfig;
  readonly envProfile?: string;
  readonly sessionProfile?: string;
  readonly input?: StatusInput;
  readonly home?: string;
}

export interface ResolvedLayout {
  readonly layout: Settings;
  readonly source: LayoutSource;
  readonly profile?: string;
}

// First match wins: env var, session pick, local project file, shared project file,
// first matching rule, active profile, built-in default.
export function resolveLayout(options: ResolveOptions): ResolvedLayout {
  const profiles = options.config?.profiles ?? {};
  const named = (name: string | undefined, source: LayoutSource): ResolvedLayout | undefined => {
    const layout = name ? profiles[name] : undefined;
    return layout && name ? { layout, source, profile: name } : undefined;
  };

  const fromProjectFile = (file: ProjectConfig | undefined, source: LayoutSource): ResolvedLayout | undefined => {
    if (!file) return undefined;
    if (file.layout) return { layout: file.layout as Settings, source };
    return named(file.profile, source);
  };

  const resolved =
    named(options.envProfile, 'env') ??
    named(options.sessionProfile, 'session') ??
    fromProjectFile(options.local, 'local-file') ??
    fromProjectFile(options.project, 'project-file') ??
    matchRules(options) ??
    named(options.config?.activeProfile, 'active-profile') ??
    named(DEFAULT_PROFILE, 'active-profile');

  return resolved ?? { layout: createDefaultSettings(), source: 'built-in' };
}

function matchRules(options: ResolveOptions): ResolvedLayout | undefined {
  const input = options.input;
  if (!input || !options.config) return undefined;
  for (const rule of options.config.rules) {
    const layout = options.config.profiles[rule.profile];
    if (layout && ruleMatches(rule.match, input, options.home)) {
      return { layout, source: 'rule', profile: rule.profile };
    }
  }
  return undefined;
}

export function ruleMatches(match: RuleMatch, input: StatusInput, home?: string): boolean {
  const checks: boolean[] = [];
  if (match.repo !== undefined) {
    const repo = input.workspace?.repo;
    checks.push(Boolean(repo?.name) && globMatch(match.repo, `${repo?.owner ?? ''}/${repo?.name ?? ''}`));
  }
  if (match.path !== undefined) {
    const dirs = [projectDir(input), currentDir(input)].filter((d): d is string => Boolean(d));
    // "~/work/" means the same folder as "~/work"
    const pattern = (home ? match.path.replace(/^~(?=$|[\\/])/, home) : match.path).replace(/(?<=.)[\\/]+$/, '');
    // A folder pattern also matches everything inside the folder
    const base = pattern.replace(/[\\/]\*+$/, '');
    const inside = (dir: string) => (/[\\/]$/.test(base) ? dir.startsWith(base) : dir.startsWith(base + '/') || dir.startsWith(base + '\\'));
    checks.push(dirs.some((dir) => globMatch(pattern, dir) || dir === base || inside(dir)));
  }
  if (match.model !== undefined) {
    const needle = match.model.toLowerCase();
    checks.push([input.model?.id, input.model?.display_name].some((v) => v?.toLowerCase().includes(needle)));
  }
  if (match.agent !== undefined) {
    checks.push(input.agent?.name !== undefined && globMatch(match.agent, input.agent.name));
  }
  return checks.length > 0 && checks.every(Boolean);
}

export function globMatch(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(value);
}
