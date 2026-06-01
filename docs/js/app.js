import { SERIES_LENGTH, THEME_IDS, assetUrl } from './config.js';
import {
  getMasteredIds,
  getSeenIds,
  appendAnswer,
  appendSeriesResult,
  resetAllProgress,
  resetScoresOnly,
  getAnswerLog,
  getSeriesResults,
  getPausedSeriesList,
  savePausedSeries,
  removePausedSeries,
} from './storage.js';
import {
  unlimitedMainScore,
  unlimitedThemeScores,
  seriesThemeScores,
  lastSeriesAverage,
} from './scoring.js';
import { initThemeSwitcher, applyColorScheme } from './theme.js';
import {
  buildSeriesQueue,
  getNextQuestion,
  recordAnswerOutcome,
  markQuestionSeen,
  countMastered,
  countAvailable,
  countAvailableForSeries,
} from './quiz-engine.js';
import { getColorSchemePreference } from './storage.js';
import { setRichContent } from './rich-text.js';
import { AI_PROVIDERS, buildQuizPrompt, openAiProvider, getAiMenuHint } from './ai-assist.js';
import { getAiProviderIcon } from './ai-icons.js';
import { yieldToMain, mayNeedJitHint, isStorageAvailable } from './compat.js';

const QCM_DATA_URL = () => assetUrl('data/qcm.json');
const DONT_KNOW = '?';

/** @typedef {'home' | 'quiz' | 'results'} Screen */
/** @typedef {'series' | 'unlimited' | 'theme'} Mode */

/** @type {import('./config.js').Question[]} */
let questions = [];

/** @type {Mode | null} */
let currentMode = null;

/** @type {string | null} */
let currentThemeId = null;

/** @type {string | null} */
let activePausedId = null;

/** @type {import('./config.js').Question[]} */
let seriesQueue = [];

/** @type {number} */
let seriesIndex = 0;

/**
 * @type {{ question: import('./config.js').Question, selected: string | null, correct: boolean, explanationCollapsed: boolean }[]}
 */
let sessionHistory = [];

/** @type {number} */
let historyIndex = -1;

/** @type {{ themeId: string, correct: boolean }[]} */
let currentSeriesAnswers = [];

/** @type {boolean} */
let awaitingContinue = false;

/** @type {boolean} */
let isReviewingHistory = false;

const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('screen--active', el.id === `screen-${name}`);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function themeLabel(themeId) {
  const q = questions.find((x) => x.theme_id === themeId);
  return q ? `${themeId} — ${q.theme_nom}` : themeId;
}

function newPausedId() {
  return `pause-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function loadQuestions() {
  const url = QCM_DATA_URL();
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(`Impossible de joindre les données (${url}). Vérifiez l'URL de la page.`);
  }
  if (!res.ok) throw new Error(`Impossible de charger les questions (${res.status}) — ${url}`);
  const text = await res.text();
  await yieldToMain();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Fichier des questions illisible (JSON invalide).');
  }
  questions = data.questions || [];
  if (questions.length === 0) throw new Error('Aucune question dans le fichier');
  const count = data.nombre_questions_uniques ?? questions.length;
  const countEl = document.getElementById('question-bank-count');
  if (countEl) countEl.textContent = String(count);
}

function questionById(id) {
  return questions.find((q) => q.id === id) ?? null;
}

function isSeriesMode() {
  return currentMode === 'series' || currentMode === 'theme';
}

function pausedSeriesLabel(paused) {
  if (paused.kind === 'theme' && paused.themeId) {
    return `Série thématique · ${themeLabel(paused.themeId)}`;
  }
  return 'Série E3C';
}

function renderResumeBanner() {
  const container = $('#paused-series-container');
  if (!container) return;

  const list = getPausedSeriesList();
  if (list.length === 0) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  container.hidden = false;
  container.innerHTML = list
    .map((paused) => {
      const answered = paused.sessionHistory.filter((e) => e.selected != null).length;
      const total = paused.seriesQueueIds.length;
      const idx = Math.min(paused.seriesIndex + 1, total);
      const label = pausedSeriesLabel(paused);
      return `
        <div class="resume-banner card" data-pause-id="${escapeHtml(paused.id)}">
          <div class="resume-banner__text">
            <strong>${escapeHtml(label)} — en pause</strong>
            <p class="muted">Question ${idx} / ${total} · ${answered} réponse${answered > 1 ? 's' : ''} enregistrée${answered > 1 ? 's' : ''}</p>
          </div>
          <div class="resume-banner__actions">
            <button type="button" class="btn btn--primary btn--sm" data-resume-id="${escapeHtml(paused.id)}">Reprendre</button>
            <button type="button" class="btn btn--ghost btn--sm" data-abandon-id="${escapeHtml(paused.id)}" title="Abandonner cette série">✕</button>
          </div>
        </div>`;
    })
    .join('');

  container.querySelectorAll('[data-resume-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-resume-id');
      if (id) resumePausedSeries(id);
    });
  });

  container.querySelectorAll('[data-abandon-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-abandon-id');
      if (!id) return;
      if (confirm('Abandonner définitivement cette série en pause ?')) {
        removePausedSeries(id);
        renderResumeBanner();
      }
    });
  });
}

function renderHomeStats() {
  renderResumeBanner();
  const log = getAnswerLog();
  const seriesHist = getSeriesResults();
  const mastered = countMastered();
  const avail = countAvailable(questions);
  const ul = unlimitedMainScore(log);
  const themes = unlimitedThemeScores(log);
  const lastSeries = lastSeriesAverage(seriesHist);

  const statsEl = $('#home-stats');
  let html = '';

  if (lastSeries) {
    html += `
      <div class="stat-block">
        <div class="stat-block__label">Dernière série</div>
        <div class="stat-block__value">${lastSeries.score} / ${lastSeries.total}</div>
        <div class="stat-block__sub">Note E3C sur 42</div>
      </div>`;
  }

  html += `
    <div class="stat-block">
      <div class="stat-block__label">Mode illimité</div>
      <div class="stat-block__value">${ul.note !== null ? `${ul.note} / 100` : '—'}</div>
      <div class="stat-block__sub">100 dernières réponses (${ul.total} enregistrées)</div>
    </div>`;

  statsEl.innerHTML = html || '<p class="muted">Commencez une session pour voir vos notes.</p>';

  const themeLines = THEME_IDS.map((id) => {
    const t = themes[id];
    if (!t || t.note === null) return '';
    const name = themeLabel(id);
    return `<div class="score-row"><span class="score-row__theme">${escapeHtml(name)}</span><span>${t.note} / 20</span></div>`;
  })
    .filter(Boolean)
    .join('');

  if (themeLines) {
    statsEl.innerHTML += `<div class="stat-block stat-block--themes"><div class="stat-block__label">Sous-notes par thème (illimité)</div>${themeLines}</div>`;
  }

  const storageNote = !isStorageAvailable()
    ? ' · stockage local indisponible (progression non sauvegardée)'
    : '';
  $('#mastered-count').textContent =
    `${mastered} question${mastered > 1 ? 's' : ''} maîtrisée${mastered > 1 ? 's' : ''} · ${avail} restante${avail > 1 ? 's' : ''} dans la banque${storageNote}`;
}

function findResumeSeriesIndex(queue, sessionHist) {
  const historyByQ = new Map(sessionHist.map((e) => [e.questionId, e]));

  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    const h = historyByQ.get(q.id);
    if (!h || h.selected == null) return i;
  }

  return Math.max(0, queue.length - 1);
}

function persistPausedSeries() {
  if (!isSeriesMode() || seriesQueue.length === 0) return;

  const id = activePausedId || newPausedId();
  activePausedId = id;

  savePausedSeries({
    id,
    kind: currentMode === 'theme' ? 'theme' : 'e3c',
    themeId: currentThemeId ?? undefined,
    seriesQueueIds: seriesQueue.map((q) => q.id),
    seriesIndex,
    sessionHistory: sessionHistory.map((e) => ({
      questionId: e.question.id,
      selected: e.selected,
      correct: e.correct,
    })),
    currentSeriesAnswers: [...currentSeriesAnswers],
    savedAt: Date.now(),
  });
  renderResumeBanner();
}

function resumePausedSeries(pauseId) {
  const paused = getPausedSeriesList().find((p) => p.id === pauseId);
  if (!paused) return;

  const queue = paused.seriesQueueIds.map((id) => questionById(id)).filter(Boolean);
  if (queue.length === 0) {
    removePausedSeries(pauseId);
    renderResumeBanner();
    alert('Impossible de reprendre : questions introuvables.');
    return;
  }

  activePausedId = pauseId;
  currentMode = paused.kind === 'theme' ? 'theme' : 'series';
  currentThemeId = paused.themeId ?? null;
  seriesQueue = queue;
  seriesIndex = findResumeSeriesIndex(
    queue,
    paused.sessionHistory
  );
  currentSeriesAnswers = [...paused.currentSeriesAnswers];
  sessionHistory = paused.sessionHistory
    .map((e) => {
      const q = questionById(e.questionId);
      if (!q) return null;
      return {
        question: q,
        selected: e.selected,
        correct: e.correct,
        explanationCollapsed: false,
      };
    })
    .filter(Boolean);
  isReviewingHistory = false;
  awaitingContinue = false;

  showCurrentSeriesQuestion();
  updateQuizModeLabel();
  updateLiveScores();
  updateQuizChrome();
  showScreen('quiz');
}

function updateQuizModeLabel() {
  if (currentMode === 'series') {
    $('#quiz-mode-label').textContent = 'Série E3C';
  } else if (currentMode === 'theme' && currentThemeId) {
    $('#quiz-mode-label').textContent = `Thème ${currentThemeId}`;
  } else {
    $('#quiz-mode-label').textContent = 'Illimité';
  }
}

function showThemePicker() {
  const picker = $('#theme-picker');
  const list = $('#theme-picker-list');
  if (!picker || !list) return;

  list.innerHTML = THEME_IDS.map((id) => {
    const avail = countAvailableForSeries(questions, id);
    const disabled = avail === 0;
    return `
      <button type="button" class="theme-picker__item" data-theme-id="${id}" ${disabled ? 'disabled' : ''}>
        <span class="theme-picker__item-label">${escapeHtml(themeLabel(id))}</span>
        <span class="theme-picker__item-meta">${avail} dispo.</span>
      </button>`;
  }).join('');

  list.querySelectorAll('[data-theme-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const themeId = btn.getAttribute('data-theme-id');
      if (themeId) {
        picker.hidden = true;
        startMode('theme', { themeId });
      }
    });
  });

  picker.hidden = false;
}

function hideThemePicker() {
  const picker = $('#theme-picker');
  if (picker) picker.hidden = true;
}

function startMode(mode, { resume = false, themeId = null, pauseId = null } = {}) {
  if (resume && pauseId) {
    resumePausedSeries(pauseId);
    return;
  }

  if (mode === 'theme' && !themeId) {
    showThemePicker();
    return;
  }

  hideThemePicker();

  if (isSeriesMode() || mode === 'series' || mode === 'theme') {
    const existing = getPausedSeriesList();
    if (existing.length > 0 && (mode === 'series' || mode === 'theme')) {
      const choice = confirm(
        `Vous avez ${existing.length} série(s) en pause. OK = lancer une nouvelle série (les pauses restent disponibles à l'accueil). Annuler = revenir.`
      );
      if (!choice) return;
    }
  }

  currentMode = mode;
  currentThemeId = themeId;
  activePausedId = newPausedId();
  sessionHistory = [];
  historyIndex = -1;
  currentSeriesAnswers = [];
  isReviewingHistory = false;
  awaitingContinue = false;

  if (mode === 'series' || mode === 'theme') {
    const mastered = getMasteredIds();
    const seen = getSeenIds();
    let pool = questions.filter((q) => !mastered.has(q.id) && !seen.has(q.id));
    if (mode === 'theme' && themeId) {
      pool = pool.filter((q) => q.theme_id === themeId);
    }

    const targetLen = mode === 'series' ? SERIES_LENGTH : Math.min(SERIES_LENGTH, pool.length);
    seriesQueue = buildSeriesQueue(pool, targetLen, {
      referencePool: questions,
      themeId: themeId ?? undefined,
    });
    seriesIndex = 0;

    if (seriesQueue.length === 0) {
      alert(
        mode === 'theme'
          ? 'Aucune question disponible pour ce thème. Réinitialisez la progression ou choisissez un autre thème.'
          : 'Félicitations ! Vous avez maîtrisé toutes les questions. Réinitialisez la progression pour recommencer.'
      );
      currentMode = null;
      return;
    }

    if (mode === 'series' && seriesQueue.length < SERIES_LENGTH) {
      const ok = confirm(
        `Il ne reste que ${seriesQueue.length} question(s) non maîtrisée(s). Lancer une série de ${seriesQueue.length} ?`
      );
      if (!ok) {
        currentMode = null;
        return;
      }
    }

    if (mode === 'theme' && seriesQueue.length < targetLen && seriesQueue.length < pool.length) {
      const ok = confirm(`Lancer une série de ${seriesQueue.length} question(s) pour ce thème ?`);
      if (!ok) {
        currentMode = null;
        return;
      }
    }

    showCurrentSeriesQuestion();
  } else {
    advanceToNewQuestion();
  }

  updateQuizModeLabel();
  updateLiveScores();
  updateQuizChrome();
  showScreen('quiz');
}

function getCurrentSessionEntry() {
  if (historyIndex < 0 || historyIndex >= sessionHistory.length) return null;
  return sessionHistory[historyIndex];
}

function showCurrentSeriesQuestion() {
  const q = seriesQueue[seriesIndex];
  if (!q) {
    finishSeries();
    return;
  }

  markQuestionSeen(q.id);

  const existing = sessionHistory.find((e) => e.question.id === q.id && e.selected == null);
  if (existing) {
    historyIndex = sessionHistory.indexOf(existing);
    renderQuestion(q, null);
  } else {
    const entry = { question: q, selected: null, correct: false, explanationCollapsed: false };
    sessionHistory.push(entry);
    historyIndex = sessionHistory.length - 1;
    renderQuestion(q, null);
  }
  updateQuizChrome();
  persistPausedSeries();
}

function advanceToNewQuestion() {
  isReviewingHistory = false;
  const q = getNextQuestion(questions);
  if (!q) {
    alert('Plus aucune question disponible dans la banque ! Réinitialisez la progression pour recommencer.');
    showScreen('home');
    renderHomeStats();
    return;
  }
  markQuestionSeen(q.id);
  const entry = { question: q, selected: null, correct: false, explanationCollapsed: false };
  sessionHistory.push(entry);
  historyIndex = sessionHistory.length - 1;
  renderQuestion(q, null);
  updateQuizChrome();
}

function renderQuestion(q, selectedLetter) {
  const entry = getCurrentSessionEntry();
  const answered = entry?.selected != null;
  const isCorrect = entry?.correct ?? false;
  const isDontKnow = selectedLetter === DONT_KNOW;

  $('#question-theme').textContent = `${q.theme_id} — ${q.theme_nom}`;
  $('#question-theme').setAttribute('data-theme-id', q.theme_id);
  $('#question-id').textContent = q.numero_original || `#${q.id}`;
  setRichContent($('#question-enonce'), q.enonce, 'enonce');

  const answersEl = $('#answers');
  answersEl.innerHTML = '';
  q.reponses.forEach((r) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'answer-btn';
    btn.dataset.letter = r.lettre;
    let extraClass = '';
    if (answered) {
      btn.disabled = true;
      if (r.lettre === q.bonne_reponse) extraClass = ' answer-btn--correct';
      else if (
        !isDontKnow &&
        r.lettre === selectedLetter &&
        selectedLetter !== q.bonne_reponse
      )
        extraClass = ' answer-btn--wrong';
      else extraClass = ' answer-btn--dimmed';
    }
    if (
      selectedLetter === r.lettre &&
      !extraClass.includes('correct') &&
      !extraClass.includes('wrong')
    ) {
      extraClass = ' answer-btn--selected';
    }
    btn.className = `answer-btn${extraClass}`;
    btn.innerHTML = `<span class="answer-btn__letter">${r.lettre}</span><span>${escapeHtml(r.texte)}</span>`;
    if (!answered && !isReviewingHistory) {
      btn.addEventListener('click', () => onAnswerSelected(r.lettre));
    }
    answersEl.appendChild(btn);
  });

  const secondary = $('#answers-secondary');
  const btnDontKnow = $('#btn-dont-know');
  if (secondary && btnDontKnow) {
    const showSecondary = !answered && !isReviewingHistory;
    secondary.hidden = !showSecondary;
    if (showSecondary) {
      btnDontKnow.onclick = () => onDontKnow();
    }
  }

  const feedback = $('#feedback');
  const explanation = $('#explanation');
  const msg = $('#feedback-message');
  const btnContinue = $('#btn-continue');
  const btnToggleExp = $('#btn-toggle-explanation');

  if (answered) {
    feedback.hidden = false;
    if (isDontKnow) {
      msg.textContent = 'Pas de souci — la bonne réponse est ' + q.bonne_reponse;
    } else {
      msg.textContent = isCorrect
        ? isReviewingHistory
          ? 'Réponse correcte'
          : 'Bonne réponse !'
        : 'Mauvaise réponse — la bonne réponse est ' + q.bonne_reponse;
    }
    msg.className = isCorrect
      ? 'feedback__message feedback__message--success'
      : 'feedback__message feedback__message--error';

    explanation.hidden = false;
    setRichContent($('#explanation-text'), q.explication, 'explanation');
    const collapsed = entry?.explanationCollapsed ?? false;
    explanation.classList.toggle('explanation--collapsed', collapsed);
    btnToggleExp.hidden = false;
    btnToggleExp.textContent = collapsed ? "Voir l'explication" : 'Réduire';
    btnToggleExp.onclick = () => {
      if (!entry) return;
      entry.explanationCollapsed = !entry.explanationCollapsed;
      explanation.classList.toggle('explanation--collapsed', entry.explanationCollapsed);
      btnToggleExp.textContent = entry.explanationCollapsed ? "Voir l'explication" : 'Réduire';
    };

    btnContinue.hidden = false;
    if (isReviewingHistory) {
      btnContinue.textContent = 'Revenir à la question en cours';
      btnContinue.onclick = () => onResumeFromReview();
    } else if (isSeriesMode()) {
      btnContinue.textContent =
        seriesIndex >= seriesQueue.length - 1 ? 'Voir les résultats' : 'Question suivante';
      btnContinue.onclick = () => onContinueAfterAnswer();
    } else {
      btnContinue.textContent = 'Question suivante';
      btnContinue.onclick = () => onContinueAfterAnswer();
    }
  } else {
    feedback.hidden = true;
    explanation.hidden = true;
    btnContinue.hidden = true;
    btnToggleExp.hidden = true;
  }

  $('#btn-back').disabled = historyIndex <= 0;
  $('#btn-pause-series').hidden = !isSeriesMode();
}

function submitAnswer(letter, correct) {
  if (awaitingContinue || isReviewingHistory) return;
  const entry = getCurrentSessionEntry();
  if (!entry || entry.selected != null) return;

  const q = entry.question;
  entry.selected = letter;
  entry.correct = correct;
  entry.explanationCollapsed = false;
  awaitingContinue = true;

  recordAnswerOutcome(q.id, correct);
  const modeKey =
    currentMode === 'theme' ? 'theme' : currentMode === 'series' ? 'series' : 'unlimited';
  appendAnswer({
    questionId: q.id,
    themeId: q.theme_id,
    correct,
    at: Date.now(),
    mode: modeKey,
  });

  if (isSeriesMode()) {
    currentSeriesAnswers.push({ themeId: q.theme_id, correct });
    persistPausedSeries();
  }

  renderQuestion(q, letter);
  updateLiveScores();
  updateQuizChrome();
}

function onAnswerSelected(letter) {
  const entry = getCurrentSessionEntry();
  if (!entry) return;
  submitAnswer(letter, letter === entry.question.bonne_reponse);
}

function onDontKnow() {
  submitAnswer(DONT_KNOW, false);
}

function onResumeFromReview() {
  awaitingContinue = false;
  isReviewingHistory = false;
  if (isSeriesMode()) {
    const q = seriesQueue[seriesIndex];
    const idx = sessionHistory.findIndex((e) => e.question.id === q?.id);
    if (idx >= 0) historyIndex = idx;
    else historyIndex = sessionHistory.length - 1;
  } else {
    historyIndex = sessionHistory.length - 1;
  }
  const entry = getCurrentSessionEntry();
  if (entry) renderQuestion(entry.question, entry.selected);
  updateQuizChrome();
}

function onContinueAfterAnswer() {
  awaitingContinue = false;
  if (isReviewingHistory) {
    onResumeFromReview();
    return;
  }
  if (isSeriesMode()) {
    if (seriesIndex >= seriesQueue.length - 1) {
      finishSeries();
      return;
    }
    seriesIndex += 1;
    showCurrentSeriesQuestion();
  } else {
    advanceToNewQuestion();
  }
}

function goBack() {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  isReviewingHistory = true;
  awaitingContinue = false;
  const entry = sessionHistory[historyIndex];
  renderQuestion(entry.question, entry.selected);
  updateQuizChrome();
}

function updateQuizChrome() {
  $('#btn-pause-series').hidden = !isSeriesMode();

  if (isSeriesMode()) {
    const total = seriesQueue.length;
    const current = isReviewingHistory
      ? `Révision · question ${historyIndex + 1}`
      : `Question ${seriesIndex + 1} / ${total}`;
    $('#quiz-progress').textContent = current;
  } else {
    const mastered = countMastered();
    $('#quiz-progress').textContent = isReviewingHistory
      ? `Révision · ${historyIndex + 1} / ${sessionHistory.length}`
      : `${mastered} maîtrisées · ${countAvailable(questions)} restantes`;
  }
}

function updateLiveScores() {
  const el = $('#live-scores-content');
  if (isSeriesMode()) {
    const correct = currentSeriesAnswers.filter((a) => a.correct).length;
    const total = currentSeriesAnswers.length;
    const byTheme = seriesThemeScores(currentSeriesAnswers);
    let html = `<div class="score-row score-row--main"><span>Série en cours</span><span>${correct} / ${total}</span></div>`;
    html += `<div class="score-row"><span class="muted">Objectif</span><span>${seriesQueue.length} questions</span></div>`;
    for (const id of THEME_IDS) {
      const t = byTheme[id];
      if (!t) continue;
      html += `<div class="score-row"><span class="score-row__theme">Thème ${id}</span><span>${t.correct} / ${t.total}</span></div>`;
    }
    el.innerHTML = html;
  } else {
    const log = getAnswerLog();
    const ul = unlimitedMainScore(log);
    const themes = unlimitedThemeScores(log);
    let html = `<div class="score-row score-row--main"><span>Note (100 dernières)</span><span>${ul.note !== null ? `${ul.note} / 100` : '—'}</span></div>`;
    for (const id of THEME_IDS) {
      const t = themes[id];
      if (t.note === null) continue;
      html += `<div class="score-row"><span class="score-row__theme">Thème ${id} (20 dernières)</span><span>${t.note} / 20</span></div>`;
    }
    el.innerHTML = html;
  }
}

function finishSeries() {
  if (activePausedId) removePausedSeries(activePausedId);
  activePausedId = null;
  renderResumeBanner();

  const correct = currentSeriesAnswers.filter((a) => a.correct).length;
  const total = currentSeriesAnswers.length;
  const byTheme = seriesThemeScores(currentSeriesAnswers);

  appendSeriesResult({
    at: Date.now(),
    score: correct,
    total,
    byTheme,
  });

  const denom = currentMode === 'series' ? SERIES_LENGTH : seriesQueue.length;
  const note20 = ((correct * 20) / denom).toFixed(1);
  $('#series-final-score').textContent = `${correct} / ${total}`;
  const shortened =
    currentMode === 'series' && total < SERIES_LENGTH
      ? ` Série raccourcie (${total} question${total > 1 ? 's' : ''} jouée${total > 1 ? 's' : ''}).`
      : '';
  const title =
    currentMode === 'theme' && currentThemeId
      ? `Série thématique (${currentThemeId}) terminée`
      : 'Série terminée';
  const resultsHeading = document.querySelector('#screen-results h2');
  if (resultsHeading) resultsHeading.textContent = title;

  $('#series-summary').textContent =
    currentMode === 'series'
      ? `Équivalent bac : ${note20} / 20 (barème officiel : ${correct} × 20/42).${shortened}`
      : `${correct} bonne${correct > 1 ? 's' : ''} réponse${correct > 1 ? 's' : ''} sur ${total}.${shortened}`;

  const themeEl = $('#series-theme-scores');
  let html = '<h3>Par thème</h3>';
  for (const id of THEME_IDS) {
    const t = byTheme[id];
    if (!t) continue;
    const label = themeLabel(id);
    const pct = t.total ? (t.correct / t.total) * 100 : 0;
    html += `
      <div class="theme-score-item">
        <span class="theme-score-item__label">${escapeHtml(label)}</span>
        <div class="theme-score-item__bar-wrap"><div class="theme-score-item__bar" style="width:${pct}%"></div></div>
        <span class="theme-score-item__value">${t.correct} / ${t.total}</span>
      </div>`;
  }
  themeEl.innerHTML = html;
  currentMode = null;
  currentThemeId = null;
  renderHomeStats();
  showScreen('results');
}

function pauseSeries() {
  if (!isSeriesMode()) return;
  persistPausedSeries();
  currentMode = null;
  currentThemeId = null;
  activePausedId = null;
  renderHomeStats();
  showScreen('home');
}

function quitQuiz() {
  if (isSeriesMode() && sessionHistory.some((e) => e.selected != null)) {
    const pause = confirm(
      'Mettre la série en pause pour la reprendre plus tard ?\n\nOK = pause · Annuler = choisir une autre action'
    );
    if (pause) {
      pauseSeries();
      return;
    }
    const abandon = confirm('Abandonner définitivement cette série ? La progression de la série sera perdue.');
    if (!abandon) return;
    if (activePausedId) removePausedSeries(activePausedId);
    activePausedId = null;
  } else if (sessionHistory.some((e) => e.selected != null)) {
    const ok = confirm('Quitter la session en cours ?');
    if (!ok) return;
  }
  currentMode = null;
  currentThemeId = null;
  activePausedId = null;
  renderHomeStats();
  showScreen('home');
}

function getCurrentQuestionForAi() {
  const entry = getCurrentSessionEntry();
  if (entry) return entry.question;
  if (isSeriesMode()) return seriesQueue[seriesIndex] ?? null;
  return null;
}

function openAiMenu() {
  const q = getCurrentQuestionForAi();
  if (!q) return;
  const menu = $('#ai-menu');
  const list = $('#ai-menu-providers');
  const hint = $('#ai-menu-hint');
  if (hint) hint.textContent = getAiMenuHint();
  list.innerHTML = '';
  const prompt = buildQuizPrompt(q);

  for (const provider of AI_PROVIDERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ai-menu__item';
    btn.innerHTML = `<span class="ai-menu__item-icon">${getAiProviderIcon(provider.id)}</span><span>${escapeHtml(provider.label)}</span>`;
    btn.addEventListener('click', async () => {
      closeAiMenu();
      const result = await openAiProvider(provider, prompt);
      const toast = document.createElement('p');
      toast.className = 'ai-toast';
      if (result.method === 'unsupported') {
        toast.textContent = result.copied
          ? `Texte copié — ouvrez l'app ${provider.label} et collez-le (ouverture auto impossible sur cet appareil).`
          : `Ouvrez l'app ${provider.label} et collez la question (presse-papiers indisponible).`;
      } else if (!result.launched) {
        toast.textContent = result.copied
          ? `Texte copié — installez l'app ${provider.label} puis collez le texte.`
          : `Installez l'app ${provider.label}.`;
      } else {
        const viaIntent =
          result.method === 'android-view'
            ? ' (App Link ?q=)'
            : result.method === 'android-text-assist'
              ? ' (TEXT_ASSIST)'
              : result.method === 'android-send'
                ? ' (SEND)'
                : '';
        toast.textContent = result.copied
          ? `Ouverture de ${provider.label}${viaIntent} — texte aussi copié.`
          : `Ouverture de ${provider.label}${viaIntent}…`;
      }
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4200);
    });
    list.appendChild(btn);
  }

  menu.hidden = false;
}

function closeAiMenu() {
  $('#ai-menu').hidden = true;
}

function bindEvents() {
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = /** @type {Mode} */ (btn.getAttribute('data-mode'));
      if (mode === 'theme') {
        showThemePicker();
      } else {
        hideThemePicker();
        startMode(mode);
      }
    });
  });

  bindOptional('btn-close-theme-picker', 'click', hideThemePicker);
  bindOptional('btn-quit', 'click', quitQuiz);
  bindOptional('btn-pause-series', 'click', pauseSeries);
  bindOptional('btn-back', 'click', goBack);
  bindOptional('btn-ask-ai', 'click', openAiMenu);
  bindOptional('ai-menu-close', 'click', closeAiMenu);
  bindOptional('ai-menu-backdrop', 'click', closeAiMenu);

  bindOptional('btn-reset-scores', 'click', () => {
    if (
      confirm(
        'Réinitialiser uniquement les notes (historique des réponses et séries terminées) ?\n\nLes questions déjà vues ne seront pas reposées.'
      )
    ) {
      resetScoresOnly();
      renderHomeStats();
    }
  });

  bindOptional('btn-reset-progress', 'click', () => {
    if (
      confirm(
        'Effacer toute la progression (questions vues, maîtrisées, historique, notes, séries en pause) ?'
      )
    ) {
      resetAllProgress();
      renderHomeStats();
    }
  });

  bindOptional('btn-new-series', 'click', () => startMode('series'));
  bindOptional('btn-home-from-results', 'click', () => {
    renderHomeStats();
    showScreen('home');
  });

  const themeEl = document.querySelector('.theme-switch');
  if (themeEl) initThemeSwitcher(themeEl);
}

function hideLoadingScreen() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.remove('loading--active');
    loading.classList.add('loading--done');
  }
  document.body.classList.remove('is-loading');
}

function showLoadingError(err) {
  const loading = document.getElementById('loading');
  if (!loading) return;
  loading.classList.add('loading--active');
  loading.classList.remove('loading--done');
  loading.classList.add('loading--error');
  document.body.classList.add('is-loading');
  const msg = err instanceof Error ? err.message : String(err);
  const jitTip = mayNeedJitHint()
    ? '<p class="muted" style="margin-top:0.5rem;font-size:0.8125rem">Sur <strong>Vanadium</strong> : menu ⋮ → « Paramètres du site » → activer <strong>JavaScript JIT</strong>, puis recharger.</p>'
    : '';
  const storageTip = !isStorageAvailable()
    ? '<p class="muted" style="margin-top:0.5rem;font-size:0.8125rem">Le stockage local est bloqué : la progression ne sera pas sauvegardée.</p>'
    : '';
  loading.innerHTML = `<p class="error-banner">${escapeHtml(msg)}</p><p class="muted" style="margin-top:0.75rem;font-size:0.875rem">Rechargez la page. Si le problème persiste, videz le cache du site.</p>${jitTip}${storageTip}`;
}

function bindOptional(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

async function init() {
  document.body.classList.add('is-loading');

  const repoLink = $('#footer-repo');
  if (repoLink) {
    repoLink.innerHTML = `<a href="https://github.com/yehielscourses/bacblanc" target="_blank" rel="noopener">bacblanc</a>`;
  }

  applyColorScheme(getColorSchemePreference());

  const loadTimeout = window.setTimeout(() => {
    const loading = document.getElementById('loading');
    if (loading && loading.classList.contains('loading--active') && !loading.classList.contains('loading--error')) {
      if (!loading.querySelector('.loading__hint')) {
        const hint = document.createElement('p');
        hint.className = 'muted loading__hint';
        hint.textContent = mayNeedJitHint()
          ? 'Chargement lent… Sur Vanadium, activez « JavaScript JIT » pour ce site (menu ⋮ → Paramètres du site).'
          : 'Le chargement prend plus de temps que prévu…';
        loading.appendChild(hint);
      }
    }
  }, 6000);

  try {
    await loadQuestions();
    hideLoadingScreen();
    bindEvents();
    renderHomeStats();
  } catch (err) {
    console.error('Échec initialisation quiz:', err);
    showLoadingError(err);
  } finally {
    window.clearTimeout(loadTimeout);
  }
}

init();
