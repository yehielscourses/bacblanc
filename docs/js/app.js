import { SERIES_LENGTH, THEME_IDS, assetUrl } from './config.js';
import {
  getMasteredIds,
  appendAnswer,
  appendSeriesResult,
  resetAllProgress,
  getAnswerLog,
  getSeriesResults,
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
 * @type {{ question: import('./config.js').Question, selected: string | null, correct: boolean, reviewed: boolean }[]}
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

/** @type {ReturnType<typeof setTimeout> | null} */
let autoAdvanceTimer = null;

function clearAutoAdvance() {
  if (autoAdvanceTimer) {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
}

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
  const res = await fetch(QCM_DATA_URL());
  if (!res.ok) throw new Error(`Impossible de charger les questions (${res.status})`);
  const data = await res.json();
  questions = data.questions || [];
  if (questions.length === 0) throw new Error('Aucune question dans le fichier');
  const count = data.nombre_questions_uniques ?? questions.length;
  const countEl = document.getElementById('question-bank-count');
  if (countEl) countEl.textContent = String(count);
}

function renderHomeStats() {
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
  }).filter(Boolean).join('');

  if (themeLines) {
    statsEl.innerHTML += `<div class="stat-block" style="grid-column:1/-1"><div class="stat-block__label">Sous-notes par thème (illimité)</div>${themeLines}</div>`;
  }

  $('#mastered-count').textContent =
    `${mastered} question${mastered > 1 ? 's' : ''} maîtrisée${mastered > 1 ? 's' : ''} · ${avail} restante${avail > 1 ? 's' : ''} dans la banque`;
}

function startMode(mode) {
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
      return;
    }
    if (seriesQueue.length < SERIES_LENGTH) {
      const ok = confirm(
        `Il ne reste que ${seriesQueue.length} question(s) non maîtrisée(s). Lancer une série de ${seriesQueue.length} ?`
      );
      if (!ok) return;
    }
    showCurrentSeriesQuestion();
  } else {
    advanceToNewQuestion();
  }

  $('#quiz-mode-label').textContent = mode === 'series' ? 'Série E3C' : 'Illimité';
  updateLiveScores();
  showScreen('quiz');
}

function getCurrentQuestion() {
  if (isReviewingHistory && historyIndex >= 0) {
    return sessionHistory[historyIndex].question;
  }
  if (currentMode === 'series') return seriesQueue[seriesIndex] ?? null;
  const last = sessionHistory[historyIndex];
  if (last && !last.reviewed && historyIndex === sessionHistory.length - 1) {
    return last.question;
  }
  return sessionHistory[historyIndex]?.question ?? null;
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
  const entry = { question: q, selected: null, correct: false, reviewed: false };
  sessionHistory.push(entry);
  historyIndex = sessionHistory.length - 1;
  renderQuestion(q, null);
  updateQuizChrome();
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
  const entry = { question: q, selected: null, correct: false, reviewed: false };
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
  $('#question-enonce').textContent = q.enonce;

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
      else if (r.lettre === selectedLetter && selectedLetter !== q.bonne_reponse) extraClass = ' answer-btn--wrong';
      else if (answered) extraClass = ' answer-btn--dimmed';
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
  const btnShowExp = $('#btn-show-explanation');

  if (answered) {
    feedback.hidden = false;
    if (isCorrect) {
      msg.textContent = isReviewingHistory ? 'Réponse correcte' : 'Bonne réponse !';
      msg.className = 'feedback__message feedback__message--success';
      if (isReviewingHistory) entry.reviewed = true;
      explanation.hidden = !entry?.reviewed;
      $('#explanation-text').textContent = q.explication;
      btnShowExp.hidden = entry?.reviewed;
      if (!entry?.reviewed) {
        btnShowExp.onclick = () => {
          entry.reviewed = true;
          explanation.hidden = false;
          btnShowExp.hidden = true;
        };
      }
      if (isReviewingHistory) {
        btnContinue.hidden = false;
        btnContinue.textContent = 'Reprendre';
        btnContinue.onclick = () => onResumeFromReview();
      } else if (currentMode === 'unlimited') {
        btnContinue.hidden = false;
        btnContinue.textContent = 'Question suivante';
        btnContinue.onclick = () => onContinueAfterCorrect();
      } else if (currentMode === 'series') {
        btnContinue.hidden = false;
        btnContinue.textContent =
          seriesIndex >= seriesQueue.length - 1 ? 'Voir les résultats' : 'Question suivante';
        btnContinue.onclick = () => onContinueAfterCorrect();
      } else {
        btnContinue.hidden = true;
      }
    } else {
      msg.textContent = 'Mauvaise réponse';
      msg.className = 'feedback__message feedback__message--error';
      explanation.hidden = false;
      $('#explanation-text').textContent = q.explication;
      btnShowExp.hidden = true;
      btnContinue.hidden = false;
      btnContinue.textContent = isReviewingHistory ? 'Retour' : 'Continuer';
      btnContinue.onclick = () => onContinueAfterWrong();
    }
  } else {
    feedback.hidden = true;
    explanation.hidden = true;
    btnContinue.hidden = true;
    btnShowExp.hidden = true;
  }

  $('#btn-back').disabled = historyIndex <= 0;
}

function onAnswerSelected(letter) {
  if (awaitingContinue || isReviewingHistory) return;
  const entry = getCurrentSessionEntry();
  if (!entry || entry.selected != null) return;

  const q = entry.question;
  const correct = letter === q.bonne_reponse;
  entry.selected = letter;
  entry.correct = correct;
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
  }

  renderQuestion(q, letter);
  updateLiveScores();
  updateQuizChrome();

  if (correct) {
    clearAutoAdvance();
    autoAdvanceTimer = setTimeout(() => {
      autoAdvanceTimer = null;
      if (!isReviewingHistory && entry === getCurrentSessionEntry() && entry.selected != null) {
        awaitingContinue = false;
        if (currentMode === 'unlimited') {
          advanceToNewQuestion();
        } else if (seriesIndex < seriesQueue.length - 1) {
          seriesIndex += 1;
          showCurrentSeriesQuestion();
        } else {
          finishSeries();
        }
      }
    }, 1400);
  }
}

function onResumeFromReview() {
  clearAutoAdvance();
  awaitingContinue = false;
  isReviewingHistory = false;
  const entry = getCurrentSessionEntry();
  const q = entry?.question ?? getCurrentQuestion();
  if (q && entry) renderQuestion(q, entry.selected);
  updateQuizChrome();
}

function onContinueAfterCorrect() {
  clearAutoAdvance();
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

function onContinueAfterWrong() {
  clearAutoAdvance();
  awaitingContinue = false;
  if (isReviewingHistory) {
    isReviewingHistory = false;
    const q = getCurrentQuestion();
    renderQuestion(q, getCurrentSessionEntry()?.selected ?? null);
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
      const q = questions.find((x) => x.theme_id === id);
      const name = q ? `${id}` : id;
      html += `<div class="score-row"><span class="score-row__theme">Thème ${name}</span><span>${t.correct} / ${t.total}</span></div>`;
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
  renderHomeStats();
  showScreen('results');
}

function quitQuiz() {
  clearAutoAdvance();
  if (sessionHistory.some((e) => e.selected != null)) {
    const ok = confirm('Quitter la session en cours ?');
    if (!ok) return;
  }
  currentMode = null;
  renderHomeStats();
  showScreen('home');
}

function bindEvents() {
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => startMode(/** @type {Mode} */ (btn.getAttribute('data-mode'))));
  });

  $('#btn-quit').addEventListener('click', quitQuiz);
  $('#btn-back').addEventListener('click', goBack);
  $('#btn-reset-progress').addEventListener('click', () => {
    if (confirm('Effacer toute la progression (questions maîtrisées, historique, notes) ?')) {
      resetAllProgress();
      renderHomeStats();
    }
  });

  $('#btn-new-series').addEventListener('click', () => startMode('series'));
  $('#btn-home-from-results').addEventListener('click', () => {
    renderHomeStats();
    showScreen('home');
  });

  initThemeSwitcher(document.querySelector('.theme-switch'));
}

async function init() {
  const repoLink = $('#footer-repo');
  if (repoLink) {
    repoLink.innerHTML = `<a href="https://github.com/yehielscourses/bacblanc" target="_blank" rel="noopener">bacblanc</a>`;
  }

  applyColorScheme(getColorSchemePreference());

  try {
    await loadQuestions();
    $('#loading').hidden = true;
    $('#app').hidden = false;
    bindEvents();
    renderHomeStats();
  } catch (err) {
    $('#loading').innerHTML = `<p class="error-banner">${escapeHtml(err instanceof Error ? err.message : String(err))}</p>`;
  }
}

init();
