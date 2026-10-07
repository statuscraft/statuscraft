import { canAddMod, newModInstance, slotOf, type ModInstance, type ModOptionValue, type ModsConfig } from '@statuscraft/core';

export function addMod(config: ModsConfig, type: string): { config: ModsConfig; id?: string } {
  if (!canAddMod(config, type)) return { config };
  const mod = newModInstance(type, config.mods);
  return { config: { ...config, mods: [...config.mods, mod] }, id: mod.id };
}

export function removeMod(config: ModsConfig, id: string): ModsConfig {
  return { ...config, mods: config.mods.filter((mod) => mod.id !== id) };
}

export function updateMod(config: ModsConfig, id: string, update: (mod: ModInstance) => ModInstance): ModsConfig {
  return { ...config, mods: config.mods.map((mod) => (mod.id === id ? update(mod) : mod)) };
}

export function setModOption(config: ModsConfig, id: string, key: string, value: ModOptionValue): ModsConfig {
  return updateMod(config, id, (mod) => ({ ...mod, options: { ...mod.options, [key]: value } }));
}

// Swaps a mod with its neighbour in the same slot, which changes the order it draws in
export function moveMod(config: ModsConfig, id: string, direction: -1 | 1): ModsConfig {
  const index = config.mods.findIndex((mod) => mod.id === id);
  const mod = config.mods[index];
  if (!mod) return config;
  const slot = slotOf(mod);
  let target = index + direction;
  while (target >= 0 && target < config.mods.length && slotOf(config.mods[target]!) !== slot) target += direction;
  if (target < 0 || target >= config.mods.length) return config;
  const mods = [...config.mods];
  [mods[index], mods[target]] = [mods[target]!, mods[index]!];
  return { ...config, mods };
}

export function findMod(config: ModsConfig, id: string | undefined): ModInstance | undefined {
  return id ? config.mods.find((mod) => mod.id === id) : undefined;
}
