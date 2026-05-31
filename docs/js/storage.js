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
    const raw = localStorage.getItem(KEYS.mastered);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function addMasteredId(id) {
  const set = getMasteredIds();
  set.add(id);
  localStorage.setItem(KEYS.mastered, JSON.stringify([...set]));
}

export function clearMastered() {
  localStorage.removeItem(KEYS.mastered);
}

export function getAnswerLog() {
  try {
    const raw = localStorage.getItem(KEYS.answerLog);
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
  localStorage.setItem(KEYS.answerLog, JSON.stringify(log));
}

export function clearAnswerLog() {
  localStorage.removeItem(KEYS.answerLog);
}

export function getSeriesResults() {
  try {
    const raw = localStorage.getItem(KEYS.seriesHistory);
    return raw ? /** @type {SeriesResult[]} */ (JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function appendSeriesResult(result) {
  const list = getSeriesResults();
  list.push(result);
  if (list.length > 50) list.splice(0, list.length - 50);
  localStorage.setItem(KEYS.seriesHistory, JSON.stringify(list));
}

export function resetAllProgress() {
  clearMastered();
  clearAnswerLog();
  localStorage.removeItem(KEYS.seriesHistory);
  clearPausedSeries();
}

/** @returns {PausedSeries | null} */
export function getPausedSeries() {
  try {
    const raw = localStorage.getItem(KEYS.pausedSeries);
    return raw ? /** @type {PausedSeries} */ (JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** @param {PausedSeries} state */
export function savePausedSeries(state) {
  localStorage.setItem(KEYS.pausedSeries, JSON.stringify(state));
}

export function clearPausedSeries() {
  localStorage.removeItem(KEYS.pausedSeries);
}

export function getColorSchemePreference() {
  const v = localStorage.getItem(KEYS.colorScheme);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

export function setColorSchemePreference(scheme) {
  localStorage.setItem(KEYS.colorScheme, scheme);
}
