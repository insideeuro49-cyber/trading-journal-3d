// ─── Strategy Color Palette ───────────────────────────────────────────────────
// Each of the user's named strategies gets a unique, distinct color.
// Unknown/custom strategies get a deterministic color from the fallback palette.

export const STRATEGY_COLOR_MAP: Record<string, string> = {
  // ── User's named strategies ──
  'MISSED ICT':                '#EF4444', // Red     – missed opportunity = loss energy
  'DECISIONAL':                '#8B5CF6', // Violet  – decision/confluence zones
  'EXTREME 4H CANDLE':         '#F97316', // Orange  – extreme candle = high volatility
  'LIQ AFTER DEC':             '#06B6D4', // Cyan    – liquidity sweeps = blue water
  'CNTR TREND':                '#10B981', // Emerald – counter-trend = green reversal
  'MARKET OPENING':            '#3B82F6', // Blue    – market open = fresh session
  'COUNTER TREND PSYCHOLOGY':  '#EC4899', // Pink    – psychology = emotional/pink

  // ── Common presets ──
  'SMC':             '#FBBF24', // Gold
  'ICT':             '#60A5FA', // Sky Blue
  'BREAKOUT':        '#34D399', // Teal
  'SCALPING':        '#F472B6', // Rose
  'TREND FOLLOWING': '#A78BFA', // Purple
  'REVERSAL':        '#FB923C', // Amber
  'OPEN':            '#94A3B8', // Slate
};

// Fallback palette for dynamically-created strategies not in the map above
const FALLBACK_PALETTE = [
  '#4F46E5', '#10B981', '#FBBF24', '#EF4444',
  '#6366F1', '#34D399', '#FCD34D', '#F87171',
  '#06B6D4', '#EC4899', '#8B5CF6', '#F59E0B',
  '#14B8A6', '#E11D48', '#7C3AED', '#0EA5E9',
];

// Cache to keep the same color across renders for unlisted strategies
const _cache: Record<string, string> = {};

/**
 * Returns a stable, vibrant hex color for any strategy name.
 * Known strategies get their designated brand color;
 * all others get a consistent color derived from the name string.
 */
export function getStrategyColor(strategy: string): string {
  if (!strategy || strategy.trim() === '') return '#6B7280';
  const key = strategy.toUpperCase().trim();
  if (STRATEGY_COLOR_MAP[key]) return STRATEGY_COLOR_MAP[key];
  if (_cache[key]) return _cache[key];
  // Deterministic hash → index into fallback palette
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
  _cache[key] = color;
  return color;
}

// ─── Section Header Colors ────────────────────────────────────────────────────
export const SECTION_COLORS = {
  PSYCHOLOGY_MISTAKES:  '#EF4444', // Red   – mistakes = danger
  STRATEGY_HARVEST:     '#F59E0B', // Amber – harvest = reward/gold
  INTELLIGENCE_INSIGHT: '#06B6D4', // Cyan  – intelligence = clarity
  TRADE_HISTORY:        '#8B5CF6', // Violet– history = depth/time
};

// Helper to get sanitized key name
function getStrategyKey(strategy: string): string {
  if (!strategy || strategy.trim() === '') return 'default';
  const val = strategy.toUpperCase().trim();
  if (val === 'MISSED ICT') return 'missed-ict';
  if (val === 'DECISIONAL') return 'decisional';
  if (val === 'EXTREME 4H CANDLE') return 'extreme-4h-candle';
  if (val === 'LIQ AFTER DEC') return 'liq-after-dec';
  if (val === 'CNTR TREND') return 'cntr-trend';
  if (val === 'MARKET OPENING') return 'market-opening';
  if (val === 'COUNTER TREND PSYCHOLOGY') return 'counter-trend-psychology';
  if (val === 'SMC') return 'smc';
  if (val === 'ICT') return 'ict';
  if (val === 'BREAKOUT') return 'breakout';
  if (val === 'SCALPING') return 'scalping';
  if (val === 'TREND FOLLOWING') return 'trend-following';
  if (val === 'REVERSAL') return 'reversal';
  if (val === 'OPEN') return 'open';

  // Fallback hashing
  let hash = 0;
  for (let i = 0; i < val.length; i++) {
    hash = val.charCodeAt(i) + ((hash << 5) - hash);
  }
  const fallbackIndex = Math.abs(hash) % 16;
  return `fallback-${fallbackIndex}`;
}

/**
 * Returns a stable, predefined CSS class for any strategy name.
 */
export function getStrategyClass(strategy: string): string {
  return `strat-${getStrategyKey(strategy)}`;
}

/**
 * Returns the text color CSS class for any strategy name.
 */
export function getStrategyTextClass(strategy: string): string {
  return `text-strat-${getStrategyKey(strategy)}`;
}

/**
 * Returns the background color CSS class for any strategy name.
 */
export function getStrategyBgClass(strategy: string): string {
  return `bg-strat-${getStrategyKey(strategy)}`;
}

/**
 * Returns the top-border and shadow card CSS class for any strategy name.
 */
export function getStrategyCardClass(strategy: string): string {
  return `strat-card-${getStrategyKey(strategy)}`;
}

/**
 * Returns the hover gradient highlight CSS class for any strategy name.
 */
export function getStrategyGradientClass(strategy: string): string {
  return `strat-gradient-${getStrategyKey(strategy)}`;
}

/**
 * Returns the filter button active/inactive CSS class for any strategy name.
 */
export function getStrategyFilterClass(strategy: string, isActive: boolean): string {
  const key = getStrategyKey(strategy);
  return isActive ? `strat-btn-active-${key}` : `strat-btn-inactive-${key}`;
}


