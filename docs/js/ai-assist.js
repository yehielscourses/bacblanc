/**
 * Ouverture d'assistants IA avec la question QCM pré-remplie.
 * Android : intents SEND ou VIEW vers le package de l'app (pas le Play Store).
 */

/** @typedef {'send' | 'view'} AndroidLaunchMode */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   androidPackage?: string,
 *   androidLaunch?: AndroidLaunchMode,
 *   buildAppUrl?: (prompt: string) => string,
 *   iosScheme?: string,
 * }} AiProvider
 */

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
    androidPackage: 'com.google.android.apps.bard',
    androidLaunch: 'send',
    buildAppUrl: (prompt) =>
      `https://gemini.google.com/app?q=${encodeURIComponent(prompt.slice(0, 8000))}`,
    iosScheme: 'googlegemini://',
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    androidPackage: 'com.openai.chatgpt',
    androidLaunch: 'view',
    buildAppUrl: (prompt) => `https://chatgpt.com/?q=${encodeURIComponent(prompt.slice(0, 8000))}`,
    iosScheme: 'chatgpt://',
  },
  {
    id: 'claude',
    label: 'Claude',
    androidPackage: 'com.anthropic.claude',
    androidLaunch: 'view',
    buildAppUrl: (prompt) =>
      `https://claude.ai/new?q=${encodeURIComponent(prompt.slice(0, 8000))}`,
    iosScheme: 'claude://',
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    androidPackage: 'ai.perplexity.app.android',
    androidLaunch: 'view',
    buildAppUrl: (prompt) =>
      `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt.slice(0, 8000))}`,
    iosScheme: 'perplexity://',
  },
  {
    id: 'grok',
    label: 'Grok',
    androidPackage: 'com.twitter.android',
    androidLaunch: 'view',
    buildAppUrl: (prompt) => `https://grok.com/?q=${encodeURIComponent(prompt.slice(0, 8000))}`,
    iosScheme: 'twitter://',
  },
];

const MAX_INTENT_TEXT = 4000;

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Intent SEND : ouvre l'app ciblée avec android.intent.extra.TEXT (Gemini, etc.).
 * @param {string} packageName
 * @param {string} text
 */
export function buildAndroidSendIntent(packageName, text) {
  const body = encodeURIComponent(text.slice(0, MAX_INTENT_TEXT));
  return `intent://send/#Intent;action=android.intent.action.SEND;type=text/plain;S.android.intent.extra.TEXT=${body};package=${packageName};end`;
}

/**
 * Intent VIEW : lien https ouvert dans l'app si installée (ChatGPT ?q=, etc.).
 * Pas de browser_fallback_url ? évite le Play Store.
 * @param {string} packageName
 * @param {string} httpsUrl
 */
export function buildAndroidViewIntent(packageName, httpsUrl) {
  const u = new URL(httpsUrl);
  const hostPath = `${u.host}${u.pathname}${u.search}`;
  return `intent://${hostPath}#Intent;scheme=https;package=${packageName};action=android.intent.action.VIEW;end`;
}

/**
 * @param {AiProvider} provider
 * @param {string} prompt
 */
export function buildAndroidIntentUrl(provider, prompt) {
  if (!provider.androidPackage) return null;

  if (provider.androidLaunch === 'send') {
    return buildAndroidSendIntent(provider.androidPackage, prompt);
  }

  if (provider.buildAppUrl) {
    return buildAndroidViewIntent(provider.androidPackage, provider.buildAppUrl(prompt));
  }

  return buildAndroidSendIntent(provider.androidPackage, prompt);
}

/**
 * @param {string} intentUrl
 */
function launchAndroidIntent(intentUrl) {
  const a = document.createElement('a');
  a.href = intentUrl;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

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

export function canLaunchNativeAiApp() {
  return getAiLaunchPlatform() !== 'other';
}

/**
 * @param {AiProvider} provider
 * @param {string} prompt
 * @returns {Promise<{ copied: boolean, method: 'android-send' | 'android-view' | 'ios' | 'unsupported', launched: boolean }>}
 */
export async function openAiProvider(provider, prompt) {
  const copied = await copyPrompt(prompt);
  const platform = getAiLaunchPlatform();

  if (platform === 'android' && provider.androidPackage) {
    const intentUrl = buildAndroidIntentUrl(provider, prompt);
    if (intentUrl) {
      try {
        launchAndroidIntent(intentUrl);
        return {
          copied,
          method: provider.androidLaunch === 'send' ? 'android-send' : 'android-view',
          launched: true,
        };
      } catch {
        return {
          copied,
          method: provider.androidLaunch === 'send' ? 'android-send' : 'android-view',
          launched: false,
        };
      }
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

export function getAiMenuHint() {
  const platform = getAiLaunchPlatform();
  if (platform === 'android') {
    return "Android : intent vers l'app installée avec le texte de la question (SEND ou lien ?q=). Si le champ reste vide, collez depuis le presse-papiers.";
  }
  if (platform === 'ios') {
    return "iOS : l'app s'ouvre si installée ; le texte est copié (préremplissage limité par Safari).";
  }
  return "Sur ordinateur : texte copié — ouvrez l'app mobile et collez-le.";
}
