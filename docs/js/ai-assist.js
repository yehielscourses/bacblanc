/**
 * Ouverture d'assistants IA avec la question QCM pré-remplie (Android + web).
 */

/** @typedef {{ id: string, label: string, icon: string, buildUrl: (prompt: string) => string, androidPackage?: string }} AiProvider */

/** @param {import('./config.js').Question} q */
export function buildQuizPrompt(q) {
  const lines = [
    'Je prépare le bac blanc NSI Première (E3C). Aide-moi sur cette question QCM :',
    '',
    q.enonce.trim(),
    '',
    'Réponses possibles :',
  ];
  for (const r of q.reponses) {
    lines.push(`${r.lettre}. ${r.texte}`);
  }
  lines.push('');
  lines.push(`Thème : ${q.theme_id} — ${q.theme_nom}`);
  lines.push('');
  lines.push(
    "Explique-moi le raisonnement pour trouver la bonne réponse, sans me donner directement la lettre au début — guide-moi pédagogiquement."
  );
  return lines.join('\n');
}

/** @type {AiProvider[]} */
export const AI_PROVIDERS = [
  {
    id: 'gemini',
    label: 'Gemini',
    icon: '?',
    androidPackage: 'com.google.android.apps.bard',
    buildUrl: (prompt) =>
      `https://gemini.google.com/app?q=${encodeURIComponent(prompt.slice(0, 8000))}`,
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    icon: '?',
    androidPackage: 'com.openai.chatgpt',
    buildUrl: (prompt) => `https://chatgpt.com/?q=${encodeURIComponent(prompt.slice(0, 8000))}`,
  },
  {
    id: 'claude',
    label: 'Claude',
    icon: '?',
    androidPackage: 'com.anthropic.claude',
    buildUrl: (prompt) => `https://claude.ai/new?q=${encodeURIComponent(prompt.slice(0, 8000))}`,
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    icon: '?',
    androidPackage: 'ai.perplexity.app.android',
    buildUrl: (prompt) => `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt.slice(0, 8000))}`,
  },
  {
    id: 'grok',
    label: 'Grok',
    icon: '??',
    androidPackage: 'com.twitter.android',
    buildUrl: (prompt) => `https://grok.com/?q=${encodeURIComponent(prompt.slice(0, 8000))}`,
  },
];

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

/**
 * Intent Android : ouvre l'app native avec le texte dans le presse-papiers partagé via SEND.
 * @param {string} prompt
 * @param {string} [packageName]
 */
function openAndroidIntent(prompt, packageName, fallbackUrl) {
  const encoded = encodeURIComponent(prompt);
  const extras = `S.android.intent.extra.TEXT=${encoded}`;
  const pkg = packageName ? `;package=${packageName}` : '';
  const fallback = fallbackUrl
    ? `;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)}`
    : '';
  const intent = `intent://send/#Intent;action=android.intent.action.SEND;type=text/plain;${extras}${pkg}${fallback};end`;
  window.location.href = intent;
}

async function copyPrompt(prompt) {
  try {
    await navigator.clipboard.writeText(prompt);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {AiProvider} provider
 * @param {string} prompt
 */
export async function openAiProvider(provider, prompt) {
  const copied = await copyPrompt(prompt);

  if (isAndroid() && provider.androidPackage) {
    try {
      openAndroidIntent(prompt, provider.androidPackage);
      return { copied, method: 'intent' };
    } catch {
      /* fallback web */
    }
  }

  const url = provider.buildUrl(prompt);
  window.open(url, '_blank', 'noopener,noreferrer');
  return { copied, method: 'web' };
}

/**
 * @param {HTMLElement} anchor
 * @param {import('./config.js').Question} question
 * @param {(provider: AiProvider) => void} onSelect
 */
export function bindAiMenu(anchor, question, onSelect) {
  anchor.addEventListener('click', (e) => {
    e.stopPropagation();
    onSelect(question);
  });
}
