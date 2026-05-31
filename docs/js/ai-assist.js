/**
 * Ouverture d'assistants IA avec la question QCM pré-remplie.
 * Tente d'ouvrir l'application native (Android / iOS) — pas le site web.
 */

/** @typedef {{ id: string, label: string, icon: string, androidPackage?: string, iosScheme?: string }} AiProvider */

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
    iosScheme: 'googlegemini://',
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    icon: '??',
    androidPackage: 'com.openai.chatgpt',
    iosScheme: 'chatgpt://',
  },
  {
    id: 'claude',
    label: 'Claude',
    icon: '??',
    androidPackage: 'com.anthropic.claude',
    iosScheme: 'claude://',
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    icon: '??',
    androidPackage: 'ai.perplexity.app.android',
    iosScheme: 'perplexity://',
  },
  {
    id: 'grok',
    label: 'Grok',
    icon: '??',
    androidPackage: 'com.twitter.android',
    iosScheme: 'twitter://',
  },
];

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Lance l'application Android par nom de package (écran d'accueil de l'app).
 * @param {string} packageName
 */
function launchAndroidApp(packageName) {
  const intent = `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${packageName};end`;
  window.location.href = intent;
}

/**
 * Tente d'ouvrir l'app iOS via son schéma d'URL.
 * @param {string} scheme
 */
function launchIosApp(scheme) {
  window.location.href = scheme;
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
 * @returns {'android' | 'ios' | 'other'}
 */
export function getAiLaunchPlatform() {
  if (isAndroid()) return 'android';
  if (isIos()) return 'ios';
  return 'other';
}

/**
 * Indique si l'on peut tenter d'ouvrir une application native sur cet appareil.
 */
export function canLaunchNativeAiApp() {
  return getAiLaunchPlatform() !== 'other';
}

/**
 * @param {AiProvider} provider
 * @param {string} prompt
 * @returns {Promise<{ copied: boolean, method: 'android' | 'ios' | 'unsupported', launched: boolean }>}
 */
export async function openAiProvider(provider, prompt) {
  const copied = await copyPrompt(prompt);
  const platform = getAiLaunchPlatform();

  if (platform === 'android' && provider.androidPackage) {
    try {
      launchAndroidApp(provider.androidPackage);
      return { copied, method: 'android', launched: true };
    } catch {
      return { copied, method: 'android', launched: false };
    }
  }

  if (platform === 'ios' && provider.iosScheme) {
    try {
      launchIosApp(provider.iosScheme);
      return { copied, method: 'ios', launched: true };
    } catch {
      return { copied, method: 'ios', launched: false };
    }
  }

  return { copied, method: 'unsupported', launched: false };
}

/**
 * Message d'aide affiché dans le menu selon la plateforme.
 */
export function getAiMenuHint() {
  const platform = getAiLaunchPlatform();
  if (platform === 'android') {
    return "La question est copiée dans le presse-papiers, puis l'application choisie s'ouvre. Collez le texte dans le chat de l'app (aucun site web).";
  }
  if (platform === 'ios') {
    return "La question est copiée, puis l'application s'ouvre si elle est installée. Collez le texte dans le chat — l'app ne peut pas être préremplie depuis Safari.";
  }
  return "Sur ordinateur, impossible d'ouvrir automatiquement l'app mobile : le texte est copié — ouvrez vous-même Gemini, ChatGPT, etc. et collez-le.";
}
