import { SERIES_LENGTH, THEME_IDS } from './config.js';
import { getMasteredIds, addMasteredId, getSeenIds, addSeenId } from './storage.js';
import { unlimitedThemeScores } from './scoring.js';
import { getAnswerLog } from './storage.js';

const MIN_THEME_WEIGHT = 3;

/**
 * @param {import('./config.js').Question[]} allQuestions
 * @param {Set<number>} excludeIds
 */
export function getAvailablePool(allQuestions, excludeIds) {
  return allQuestions.filter((q) => !excludeIds.has(q.id));
}

/**
 * @param {import('./config.js').Question[]} pool
 */
export function pickRandom(pool) {
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Répartition cible par thème (méthode des plus grands restes).
 * @param {import('./config.js').Question[]} referencePool
 * @param {number} total
 */
export function computeThemeTargets(referencePool, total) {
  const counts = /** @type {Record<string, number>} */ ({});
  for (const q of referencePool) {
    counts[q.theme_id] = (counts[q.theme_id] || 0) + 1;
  }
  const grand = referencePool.length;
  const themes = THEME_IDS.filter((id) => counts[id] > 0);

  const parts = themes.map((id) => {
    const exact = (counts[id] / grand) * total;
    const floor = Math.floor(exact);
    return { id, floor, remainder: exact - floor };
  });

  let assigned = parts.reduce((s, p) => s + p.floor, 0);
  const targets = Object.fromEntries(parts.map((p) => [p.id, p.floor]));

  const byRemainder = [...parts].sort((a, b) => b.remainder - a.remainder);
  let i = 0;
  while (assigned < total && i < byRemainder.length) {
    targets[byRemainder[i].id] += 1;
    assigned += 1;
    i += 1;
  }

  return targets;
}

/**
 * @param {import('./config.js').Question[]} pool
 * @param {number} count
 * @param {{ referencePool?: import('./config.js').Question[], themeId?: string }} [opts]
 */
export function buildSeriesQueue(pool, count = SERIES_LENGTH, opts = {}) {
  const { referencePool = pool, themeId } = opts;
  const filtered = themeId ? pool.filter((q) => q.theme_id === themeId) : pool;
  if (filtered.length === 0) return [];

  const targetCount = Math.min(count, filtered.length);

  if (themeId) {
    return shuffleAndTake(filtered, targetCount);
  }

  const targets = computeThemeTargets(referencePool, targetCount);
  const byTheme = /** @type {Record<string, import('./config.js').Question[]>} */ ({});
  for (const q of filtered) {
    if (!byTheme[q.theme_id]) byTheme[q.theme_id] = [];
    byTheme[q.theme_id].push(q);
  }

  /** @type {import('./config.js').Question[]} */
  const selected = [];
  for (const id of THEME_IDS) {
    const need = targets[id] || 0;
    if (need <= 0) continue;
    const themePool = byTheme[id] || [];
    const shuffled = shuffleCopy(themePool);
    selected.push(...shuffled.slice(0, Math.min(need, shuffled.length)));
  }

  if (selected.length < targetCount) {
    const used = new Set(selected.map((q) => q.id));
    const rest = shuffleCopy(filtered.filter((q) => !used.has(q.id)));
    for (const q of rest) {
      if (selected.length >= targetCount) break;
      selected.push(q);
    }
  }

  return shuffleCopy(selected).slice(0, targetCount);
}

/**
 * @param {import('./config.js').Question[]} allQuestions
 */
export function getNextQuestion(allQuestions) {
  const mastered = getMasteredIds();
  const seen = getSeenIds();
  const exclude = new Set([...mastered, ...seen]);
  const pool = getAvailablePool(allQuestions, exclude);
  if (pool.length === 0) return null;

  const log = getAnswerLog().filter((e) => e.mode === 'unlimited');
  const themeScores = unlimitedThemeScores(log);

  /** @type {Record<string, number>} */
  const themeWeights = {};
  for (const id of THEME_IDS) {
    const note = themeScores[id]?.note;
    themeWeights[id] =
      note === null ? 10 : Math.max(MIN_THEME_WEIGHT, 21 - note);
  }

  let totalWeight = 0;
  const weights = pool.map((q) => {
    const w = themeWeights[q.theme_id] ?? 10;
    totalWeight += w;
    return w;
  });

  let r = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * @param {number} questionId
 */
export function markQuestionSeen(questionId) {
  addSeenId(questionId);
}

/**
 * @param {number} questionId
 * @param {boolean} correct
 */
export function recordAnswerOutcome(questionId, correct) {
  if (correct) addMasteredId(questionId);
}

export function countMastered() {
  return getMasteredIds().size;
}

/**
 * @param {import('./config.js').Question[]} allQuestions
 */
export function countAvailable(allQuestions) {
  const mastered = getMasteredIds();
  const seen = getSeenIds();
  const exclude = new Set([...mastered, ...seen]);
  return getAvailablePool(allQuestions, exclude).length;
}

/**
 * @param {import('./config.js').Question[]} allQuestions
 * @param {string} [themeId]
 */
export function countAvailableForSeries(allQuestions, themeId) {
  const mastered = getMasteredIds();
  let pool = getAvailablePool(allQuestions, mastered);
  if (themeId) pool = pool.filter((q) => q.theme_id === themeId);
  return pool.length;
}

function shuffleCopy(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function shuffleAndTake(pool, count) {
  return shuffleCopy(pool).slice(0, count);
}
