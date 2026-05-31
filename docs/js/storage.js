import { safeStorageGet, safeStorageRemove, safeStorageSet } from './compat.js';

const KEYS = {
  mastered: 'nsi-quiz-mastered-ids',
  answerLog: 'nsi-quiz-answer-log',
  colorScheme: 'nsi-quiz-color-scheme',
  seriesHistory: 'nsi-quiz-series-results',
  pausedSeries: 'nsi-quiz-paused-series',
};

/** @typedef {{ seriesQueueIds: number[], seriesIndex: number, sessionHistory: { questionId: number, selected: string | null, correct: boolean }[], currentSeriesAnswers: { themeId: string, correct: boolean }[], savedAt: number }} PausedSeries */

/** @typedef {{ questionId: number, themeId: string, correct: boolean, at: number, mode: 'series' | 'unlimited' }} AnswerEntry */

/** @typedef {{ at: number, score: number, total: number, byTheme: Record<string, { correct: number, total: number }> }} SeriesResult */

export function getMasteredIds() {
  try {
    const raw = safeStorageGet(KEYS.mastered);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function addMasteredId(id) {
  const set = getMasteredIds();
  set.add(id);
  safeStorageSet(KEYS.mastered, JSON.stringify([...set]));
}

export function clearMastered() {
  safeStorageRemove(KEYS.mastered);
}

export function getAnswerLog() {
  try {
    const raw = safeStorageGet(KEYS.answerLog);
    return raw ? /** @type {AnswerEntry[]} */ (JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function appendAnswer(entry) {
  const log = getAnswerLog();
  log.push(entry);
  const max = 2000;
  if (log.length > max) log.splice(0, log.length - max);
  safeStorageSet(KEYS.answerLog, JSON.stringify(log));
}

export function clearAnswerLog() {
  safeStorageRemove(KEYS.answerLog);
}

export function getSeriesResults() {
  try {
    const raw = safeStorageGet(KEYS.seriesHistory);
    return raw ? /** @type {SeriesResult[]} */ (JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function appendSeriesResult(result) {
  const list = getSeriesResults();
  list.push(result);
  if (list.length > 50) list.splice(0, list.length - 50);
  safeStorageSet(KEYS.seriesHistory, JSON.stringify(list));
}

export function resetAllProgress() {
  clearMastered();
  clearAnswerLog();
  safeStorageRemove(KEYS.seriesHistory);
  clearPausedSeries();
}

/** @returns {PausedSeries | null} */
export function getPausedSeries() {
  try {
    const raw = safeStorageGet(KEYS.pausedSeries);
    return raw ? /** @type {PausedSeries} */ (JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** @param {PausedSeries} state */
export function savePausedSeries(state) {
  safeStorageSet(KEYS.pausedSeries, JSON.stringify(state));
}

export function clearPausedSeries() {
  safeStorageRemove(KEYS.pausedSeries);
}

export function getColorSchemePreference() {
  const v = safeStorageGet(KEYS.colorScheme);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

export function setColorSchemePreference(scheme) {
  safeStorageSet(KEYS.colorScheme, scheme);
}
