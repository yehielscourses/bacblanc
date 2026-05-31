import { SERIES_LENGTH } from './config.js';
import { getMasteredIds, addMasteredId } from './storage.js';

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
 * @param {import('./config.js').Question[]} pool
 * @param {number} count
 */
export function buildSeriesQueue(pool, count = SERIES_LENGTH) {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * @param {import('./config.js').Question[]} allQuestions
 */
export function getNextQuestion(allQuestions) {
  const mastered = getMasteredIds();
  const pool = getAvailablePool(allQuestions, mastered);
  return pickRandom(pool);
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

export function countAvailable(allQuestions) {
  const mastered = getMasteredIds();
  return getAvailablePool(allQuestions, mastered).length;
}
