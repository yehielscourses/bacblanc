import { SERIES_LENGTH, THEME_IDS, assetUrl } from './config.js';
import {
  getMasteredIds,
  appendAnswer,
  appendSeriesResult,
  resetAllProgress,
  getAnswerLog,
  getSeriesResults,
  getPausedSeries,
  savePausedSeries,
  clearPausedSeries,
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
  countMastered,
  countAvailable,
} from './quiz-engine.js';
import { getColorSchemePreference } from './storage.js';
import { setRichContent } from './rich-text.js';
import { AI_PROVIDERS, buildQuizPrompt, openAiProvider, getAiMenuHint } from './ai-assist.js';
import { yieldToMain, mayNeedJitHint, isStorageAvailable } from './compat.js';

const QCM_DATA_URL = () => assetUrl('data/qcm.json');

/** @typedef {'home' | 'quiz' | 'results'} Screen */
/** @typedef {'series' | 'unlimited'} Mode */

/** @type {import('./config.js').Question[]} */
let questions = [];

/** @type {Mode | null} */
let currentMode = null;

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

function renderResumeBanner() {
  const paused = getPausedSeries();
  const banner = $('#resume-series-banner');
  if (!banner) return;
  if (!paused || !paused.seriesQueueIds?.length) {
    banner.hidden = true;
    return;
  }
  const answered = paused.sessionHistory.filter((e) => e.selected != null).length;
  const total = paused.seriesQueueIds.length;
  const idx = Math.min(paused.seriesIndex + 1, total);
  $('#resume-series-detail').textContent =
    `Question ${idx} / ${total} · ${answered} réponse${answered > 1 ? 's' : ''} enregistrée${answered > 1 ? 's' : ''}`;
  banner.hidden = false;
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
    const q = questions.find((x) => x.theme_id === id);
    const name = q ? `${id} — ${q.theme_nom}` : id;
    return `<div class="score-row"><span class="score-row__theme">${escapeHtml(name)}</span><span>${t.note} / 20</span></div>`;
  })
    .filter(Boolean)
    .join('');

  if (themeLines) {
    statsEl.innerHTML += `<div class="stat-block" style="grid-column:1/-1"><div class="stat-block__label">Sous-notes par thème (illimité)</div>${themeLines}</div>`;
  }

  const storageNote = !isStorageAvailable()
    ? ' · stockage local indisponible (progression non sauvegardée)'
    : '';
  $('#mastered-count').textContent =
    `${mastered} question${mastered > 1 ? 's' : ''} maîtrisée${mastered > 1 ? 's' : ''} · ${avail} restante${avail > 1 ? 's' : ''} dans la banque${storageNote}`;
}

function persistPausedSeries() {
  if (currentMode !== 'series' || seriesQueue.length === 0) return;
  savePausedSeries({
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

function resumePausedSeries() {
  const paused = getPausedSeries();
  if (!paused) return;

  const queue = paused.seriesQueueIds.map((id) => questionById(id)).filter(Boolean);
  if (queue.length === 0) {
    clearPausedSeries();
    renderResumeBanner();
    alert('Impossible de reprendre : questions introuvables.');
    return;
  }

  currentMode = 'series';
  seriesQueue = queue;
  seriesIndex = Math.min(paused.seriesIndex, seriesQueue.length - 1);
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

  const q = seriesQueue[seriesIndex];
  const histIdx = sessionHistory.findIndex((e) => e.question.id === q?.id);
  if (histIdx >= 0) {
    historyIndex = histIdx;
    renderQuestion(q, sessionHistory[histIdx].selected);
  } else if (q) {
    const entry = { question: q, selected: null, correct: false, explanationCollapsed: false };
    sessionHistory.push(entry);
    historyIndex = sessionHistory.length - 1;
    renderQuestion(q, null);
  }

  $('#quiz-mode-label').textContent = 'Série E3C';
  updateLiveScores();
  updateQuizChrome();
  showScreen('quiz');
}

function startMode(mode, { resume = false } = {}) {
  if (mode === 'series' && resume) {
    resumePausedSeries();
    return;
  }

  if (mode === 'series' && getPausedSeries()) {
    const choice = confirm(
      'Une série est en pause. OK = nouvelle série (l\'ancienne sera abandonnée). Annuler = revenir à l\'accueil.'
    );
    if (!choice) return;
    clearPausedSeries();
    renderResumeBanner();
  }

  currentMode = mode;
  sessionHistory = [];
  historyIndex = -1;
  currentSeriesAnswers = [];
  isReviewingHistory = false;
  awaitingContinue = false;

  if (mode === 'series') {
    const mastered = getMasteredIds();
    const pool = questions.filter((q) => !mastered.has(q.id));
    seriesQueue = buildSeriesQueue(pool, SERIES_LENGTH);
    seriesIndex = 0;
    if (seriesQueue.length === 0) {
      alert('Félicitations ! Vous avez maîtrisé toutes les questions. Réinitialisez la progression pour recommencer.');
      currentMode = null;
      return;
    }
    if (seriesQueue.length < SERIES_LENGTH) {
      const ok = confirm(
        `Il ne reste que ${seriesQueue.length} question(s) non maîtrisée(s). Lancer une série de ${seriesQueue.length} ?`
      );
      if (!ok) {
        currentMode = null;
        return;
      }
    }
    showCurrentSeriesQuestion();
  } else {
    advanceToNewQuestion();
  }

  $('#quiz-mode-label').textContent = mode === 'series' ? 'Série E3C' : 'Illimité';
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
    alert('Toutes les questions ont été maîtrisées ! Réinitialisez la progression pour recommencer.');
    showScreen('home');
    renderHomeStats();
    return;
  }
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
      else if (r.lettre === selectedLetter && selectedLetter !== q.bonne_reponse)
        extraClass = ' answer-btn--wrong';
      else extraClass = ' answer-btn--dimmed';
    }
    if (selectedLetter === r.lettre && !extraClass.includes('correct') && !extraClass.includes('wrong')) {
      extraClass = ' answer-btn--selected';
    }
    btn.className = `answer-btn${extraClass}`;
    btn.innerHTML = `<span class="answer-btn__letter">${r.lettre}</span><span>${escapeHtml(r.texte)}</span>`;
    if (!answered && !isReviewingHistory) {
      btn.addEventListener('click', () => onAnswerSelected(r.lettre));
    }
    answersEl.appendChild(btn);
  });

  const feedback = $('#feedback');
  const explanation = $('#explanation');
  const msg = $('#feedback-message');
  const btnContinue = $('#btn-continue');
  const btnToggleExp = $('#btn-toggle-explanation');

  if (answered) {
    feedback.hidden = false;
    msg.textContent = isCorrect
      ? isReviewingHistory
        ? 'Réponse correcte'
        : 'Bonne réponse !'
      : 'Mauvaise réponse — la bonne réponse est ' + q.bonne_reponse;
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
    } else if (currentMode === 'series') {
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

  $('#btn-pause-series').hidden = currentMode !== 'series';
}

function onAnswerSelected(letter) {
  if (awaitingContinue || isReviewingHistory) return;
  const entry = getCurrentSessionEntry();
  if (!entry || entry.selected != null) return;

  const q = entry.question;
  const correct = letter === q.bonne_reponse;
  entry.selected = letter;
  entry.correct = correct;
  entry.explanationCollapsed = false;
  awaitingContinue = true;

  recordAnswerOutcome(q.id, correct);
  appendAnswer({
    questionId: q.id,
    themeId: q.theme_id,
    correct,
    at: Date.now(),
    mode: currentMode,
  });

  if (currentMode === 'series') {
    currentSeriesAnswers.push({ themeId: q.theme_id, correct });
    persistPausedSeries();
  }

  renderQuestion(q, letter);
  updateLiveScores();
  updateQuizChrome();
}

function onResumeFromReview() {
  awaitingContinue = false;
  isReviewingHistory = false;
  if (currentMode === 'series') {
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
  if (currentMode === 'series') {
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
  $('#btn-pause-series').hidden = currentMode !== 'series';

  if (currentMode === 'series') {
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
  if (currentMode === 'series') {
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
  clearPausedSeries();
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

  const note20 = ((correct * 20) / SERIES_LENGTH).toFixed(1);
  $('#series-final-score').textContent = `${correct} / ${total}`;
  const shortened =
    total < SERIES_LENGTH
      ? ` Série raccourcie (${total} question${total > 1 ? 's' : ''} jouée${total > 1 ? 's' : ''}).`
      : '';
  $('#series-summary').textContent =
    `Équivalent bac : ${note20} / 20 (barème officiel : ${correct} × 20/42).${shortened}`;

  const themeEl = $('#series-theme-scores');
  let html = '<h3>Par thème</h3>';
  for (const id of THEME_IDS) {
    const t = byTheme[id];
    if (!t) continue;
    const q = questions.find((x) => x.theme_id === id);
    const label = q ? `${id} — ${q.theme_nom}` : id;
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
  renderHomeStats();
  showScreen('results');
}

function pauseSeries() {
  if (currentMode !== 'series') return;
  persistPausedSeries();
  currentMode = null;
  renderHomeStats();
  showScreen('home');
}

function quitQuiz() {
  if (currentMode === 'series' && sessionHistory.some((e) => e.selected != null)) {
    const pause = confirm(
      'Mettre la série en pause pour la reprendre plus tard ?\n\nOK = pause · Annuler = choisir une autre action'
    );
    if (pause) {
      pauseSeries();
      return;
    }
    const abandon = confirm('Abandonner définitivement cette série ? La progression de la série sera perdue.');
    if (!abandon) return;
    clearPausedSeries();
  } else if (sessionHistory.some((e) => e.selected != null)) {
    const ok = confirm('Quitter la session en cours ?');
    if (!ok) return;
  }
  currentMode = null;
  renderHomeStats();
  showScreen('home');
}

function getCurrentQuestionForAi() {
  const entry = getCurrentSessionEntry();
  if (entry) return entry.question;
  if (currentMode === 'series') return seriesQueue[seriesIndex] ?? null;
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
    btn.innerHTML = `<span class="ai-menu__item-icon">${provider.icon}</span><span>${escapeHtml(provider.label)}</span>`;
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
        toast.textContent = result.copied
          ? `Texte copié — ouverture de ${provider.label}… Collez dans le chat.`
          : `Ouverture de ${provider.label}…`;
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
    btn.addEventListener('click', () => startMode(/** @type {Mode} */ (btn.getAttribute('data-mode'))));
  });

  bindOptional('btn-resume-series', 'click', () => startMode('series', { resume: true }));
  bindOptional('btn-quit', 'click', quitQuiz);
  bindOptional('btn-pause-series', 'click', pauseSeries);
  bindOptional('btn-back', 'click', goBack);
  bindOptional('btn-ask-ai', 'click', openAiMenu);
  bindOptional('ai-menu-close', 'click', closeAiMenu);
  bindOptional('ai-menu-backdrop', 'click', closeAiMenu);

  bindOptional('btn-reset-progress', 'click', () => {
    if (confirm('Effacer toute la progression (questions maîtrisées, historique, notes, séries en pause) ?')) {
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
