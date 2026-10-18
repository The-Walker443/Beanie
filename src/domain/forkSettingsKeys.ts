// Synced gateway-store keys owned by fork customizations (FORK.md). They live
// under "beanie.fork." so they can never collide with keys upstream Beanie adds
// later — upstream's skin shares the "beanie" store namespace on the machine.
// settingsStore.ts appends FORK_SYNCED_SETTING_KEYS to its synced key list.

// A3: descaling reminder (domain/forkDescale.ts).
export const descaleStateKey = 'beanie.fork.descale.state';
export const descaleIntervalKey = 'beanie.fork.descale.interval';

export const FORK_SYNCED_SETTING_KEYS: readonly string[] = [descaleStateKey, descaleIntervalKey];
