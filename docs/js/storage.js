import { safeStorageGet, safeStorageRemove, safeStorageSet } from './compat.js';

const KEYS = {
  mastered: 'nsi-quiz-mastered-ids',
  seen: 'nsi-quiz-seen-ids',
  answerLog: 'nsi-quiz-answer-log',
  colorScheme: 'nsi-quiz-color-scheme',
  seriesHistory: 'nsi-quiz-series-results',
  pausedSeries: 'nsi-quiz-paused-series',
};

/** @typedef {'e3c' | 'theme'} PausedSeriesKind */

/**
 * @typedef {{
 *   id: string,
 *   kind: PausedSeriesKind,
 *   themeId?: string,
 *   seriesQueueIds: number[],
 *   seriesIndex: number,
 *   sessionHistory: { questionId: number, selected: string | null, correct: boolean }[],
 *   currentSeriesAnswers: { themeId: string, correct: boolean }[],
 *   savedAt: number,
 * }} PausedSeries
 */

/** @typedef {{ questionId: number, themeId: string, correct: boolean, at: number, mode: 'series' | 'unlimited' | 'theme' }} AnswerEntry */

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

export function getSeenIds() {
  try {
    const raw = safeStorageGet(KEYS.seen);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function addSeenId(id) {
  const set = getSeenIds();
  set.add(id);
  safeStorageSet(KEYS.seen, JSON.stringify([...set]));
}

export function clearSeen() {
  safeStorageRemove(KEYS.seen);
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

/** Efface notes et historique ; conserve questions vues et maîtrisées. */
export function resetScoresOnly() {
  clearAnswerLog();
  safeStorageRemove(KEYS.seriesHistory);
  clearAllPausedSeries();
}

export function resetAllProgress() {
  clearMastered();
  clearSeen();
  clearAnswerLog();
  safeStorageRemove(KEYS.seriesHistory);
  clearAllPausedSeries();
}

function migrateLegacyPaused(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return /** @type {PausedSeries[]} */ (parsed);
    if (parsed && typeof parsed === 'object' && parsed.seriesQueueIds) {
      return [
        {
          id: `legacy-${parsed.savedAt ?? Date.now()}`,
          kind: 'e3c',
          seriesQueueIds: parsed.seriesQueueIds,
          seriesIndex: parsed.seriesIndex ?? 0,
          sessionHistory: parsed.sessionHistory ?? [],
          currentSeriesAnswers: parsed.currentSeriesAnswers ?? [],
          savedAt: parsed.savedAt ?? Date.now(),
        },
      ];
    }
  } catch {
    /* ignore */
  }
  return [];
}

/** @returns {PausedSeries[]} */
export function getPausedSeriesList() {
  try {
    const raw = safeStorageGet(KEYS.pausedSeries);
    return migrateLegacyPaused(raw);
  } catch {
    return [];
  }
}

/** @param {PausedSeries} state */
export function savePausedSeries(state) {
  const list = getPausedSeriesList().filter((p) => p.id !== state.id);
  list.push(state);
  list.sort((a, b) => b.savedAt - a.savedAt);
  safeStorageSet(KEYS.pausedSeries, JSON.stringify(list));
}

/** @param {string} id */
export function removePausedSeries(id) {
  const list = getPausedSeriesList().filter((p) => p.id !== id);
  if (list.length === 0) {
    safeStorageRemove(KEYS.pausedSeries);
  } else {
    safeStorageSet(KEYS.pausedSeries, JSON.stringify(list));
  }
}

export function clearAllPausedSeries() {
  safeStorageRemove(KEYS.pausedSeries);
}

/** @deprecated Utiliser getPausedSeriesList */
export function getPausedSeries() {
  const list = getPausedSeriesList();
  return list.length > 0 ? list[0] : null;
}

/** @deprecated Utiliser removePausedSeries */
export function clearPausedSeries() {
  clearAllPausedSeries();
}

export function getColorSchemePreference() {
  const v = safeStorageGet(KEYS.colorScheme);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

export function setColorSchemePreference(scheme) {
  safeStorageSet(KEYS.colorScheme, scheme);
}
