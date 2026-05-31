import { UNLIMITED_WINDOW, THEME_WINDOW, THEME_IDS } from './config.js';

/**
 * Note sur 100 pour les N dernières réponses (ou proportionnel si < N).
 * @param {import('./storage.js').AnswerEntry[]} log
 */
export function unlimitedMainScore(log) {
  const unlimited = log.filter((e) => e.mode === 'unlimited');
  const slice = unlimited.slice(-UNLIMITED_WINDOW);
  if (slice.length === 0) return { correct: 0, total: 0, note: null, window: UNLIMITED_WINDOW };
  const correct = slice.filter((e) => e.correct).length;
  const denom = Math.min(slice.length, UNLIMITED_WINDOW);
  const note = Math.round((correct / denom) * 100);
  return { correct, total: slice.length, note, window: UNLIMITED_WINDOW };
}

/**
 * Sous-notes par thème : 20 dernières questions de chaque thème (mode illimité).
 * @param {import('./storage.js').AnswerEntry[]} log
 */
export function unlimitedThemeScores(log) {
  const unlimited = log.filter((e) => e.mode === 'unlimited');
  /** @type {Record<string, { correct: number, total: number, note: number | null }>} */
  const out = {};
  for (const themeId of THEME_IDS) {
    const themeEntries = unlimited.filter((e) => e.themeId === themeId).slice(-THEME_WINDOW);
    if (themeEntries.length === 0) {
      out[themeId] = { correct: 0, total: 0, note: null };
      continue;
    }
    const correct = themeEntries.filter((e) => e.correct).length;
    const denom = Math.min(themeEntries.length, THEME_WINDOW);
    out[themeId] = {
      correct,
      total: themeEntries.length,
      note: Math.round((correct / denom) * 20),
    };
  }
  return out;
}

/**
 * @param {{ themeId: string, correct: boolean }[]} seriesAnswers
 */
export function seriesThemeScores(seriesAnswers) {
  /** @type {Record<string, { correct: number, total: number }>} */
  const byTheme = {};
  for (const a of seriesAnswers) {
    if (!byTheme[a.themeId]) byTheme[a.themeId] = { correct: 0, total: 0 };
    byTheme[a.themeId].total += 1;
    if (a.correct) byTheme[a.themeId].correct += 1;
  }
  return byTheme;
}

/**
 * @param {import('./storage.js').SeriesResult[]} history
 */
export function lastSeriesAverage(history) {
  if (history.length === 0) return null;
  const last = history[history.length - 1];
  return { score: last.score, total: last.total };
}
