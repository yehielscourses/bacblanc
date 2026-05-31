/**
 * Ouverture d'assistants IA avec la question QCM pré-remplie.
 * Android : intents vers le bon package (manifeste Google App / ChatGPT, etc.).
 */

/** Package Gemini intégré dans l'app Google (manifeste googlequicksearchbox). */
export const GEMINI_ANDROID_PACKAGE = 'com.google.android.googlequicksearchbox';

/** Ancienne app Bard autonome (certains appareils). */
export const GEMINI_BARD_PACKAGE = 'com.google.android.apps.bard';

/**
 * @typedef {'send' | 'view' | 'text-assist' | 'process-text' | 'gemini'} AndroidLaunchMode
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   androidPackage?: string,
 *   androidPackageFallbacks?: string[],
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
    androidPackage: GEMINI_ANDROID_PACKAGE,
    androidPackageFallbacks: [GEMINI_BARD_PACKAGE],
    androidLaunch: 'gemini',
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

function encodedTextSlice(text) {
  return encodeURIComponent(text.slice(0, MAX_INTENT_TEXT));
}

/**
 * Intent SEND + EXTRA_TEXT (SharesheetAimEntrypoint dans le manifeste Google).
 * @param {string} packageName
 * @param {string} text
 */
export function buildAndroidSendIntent(packageName, text) {
  const body = encodedTextSlice(text);
  return `intent://send/#Intent;action=android.intent.action.SEND;type=text/plain;S.android.intent.extra.TEXT=${body};package=${packageName};end`;
}

/**
 * Intent VIEW : App Link https (gemini.google.com/app, chatgpt.com/?q=, …).
 * @param {string} packageName
 * @param {string} httpsUrl
 */
export function buildAndroidViewIntent(packageName, httpsUrl) {
  const u = new URL(httpsUrl);
  const hostPath = `${u.host}${u.pathname}${u.search}`;
  return `intent://${hostPath}#Intent;scheme=https;package=${packageName};action=android.intent.action.VIEW;end`;
}

/**
 * Intent TEXT_ASSIST — action déclarée par GoogleAppTextAssistEntrypointExternal.
 * @param {string} packageName
 * @param {string} text
 */
export function buildAndroidTextAssistIntent(packageName, text) {
  const body = encodedTextSlice(text);
  return `intent:#Intent;action=com.google.android.googlequicksearchbox.TEXT_ASSIST;package=${packageName};S.android.intent.extra.TEXT=${body};end`;
}

/**
 * Intent PROCESS_TEXT — ProcessTextGatewayActivity (Robin / Gemini).
 * @param {string} packageName
 * @param {string} text
 */
export function buildAndroidProcessTextIntent(packageName, text) {
  const body = encodedTextSlice(text);
  return `intent:#Intent;action=android.intent.action.PROCESS_TEXT;type=text/plain;S.android.intent.extra.PROCESS_TEXT=${body};package=${packageName};end`;
}

/**
 * Stratégies Android pour Gemini (ordre : App Link ? TEXT_ASSIST ? PROCESS_TEXT ? SEND).
 * @param {string} prompt
 * @param {string} packageName
 * @returns {{ url: string, method: string }[]}
 */
export function buildGeminiAndroidIntents(prompt, packageName = GEMINI_ANDROID_PACKAGE) {
  const text = prompt.slice(0, MAX_INTENT_TEXT);
  const appUrl = `https://gemini.google.com/app?q=${encodeURIComponent(prompt.slice(0, 8000))}`;
  return [
    { url: buildAndroidViewIntent(packageName, appUrl), method: 'android-view' },
    { url: buildAndroidTextAssistIntent(packageName, text), method: 'android-text-assist' },
    { url: buildAndroidProcessTextIntent(packageName, text), method: 'android-process-text' },
    { url: buildAndroidSendIntent(packageName, text), method: 'android-send' },
  ];
}

/**
 * @param {AiProvider} provider
 * @param {string} prompt
 * @param {string} [packageOverride]
 * @returns {{ url: string, method: string } | null}
 */
export function buildAndroidIntent(provider, prompt, packageOverride) {
  const pkg = packageOverride ?? provider.androidPackage;
  if (!pkg) return null;

  if (provider.androidLaunch === 'gemini') {
    return buildGeminiAndroidIntents(prompt, pkg)[0];
  }

  if (provider.androidLaunch === 'send') {
    return { url: buildAndroidSendIntent(pkg, prompt), method: 'android-send' };
  }

  if (provider.buildAppUrl) {
    return {
      url: buildAndroidViewIntent(pkg, provider.buildAppUrl(prompt)),
      method: 'android-view',
    };
  }

  return { url: buildAndroidSendIntent(pkg, prompt), method: 'android-send' };
}

/** @deprecated Utiliser buildAndroidIntent */
export function buildAndroidIntentUrl(provider, prompt) {
  return buildAndroidIntent(provider, prompt)?.url ?? null;
}

/**
 * @param {string} intentUrl
 */
function launchAndroidIntent(intentUrl) {
  window.location.href = intentUrl;
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
 * @returns {Promise<{ copied: boolean, method: string, launched: boolean }>}
 */
export async function openAiProvider(provider, prompt) {
  const copied = await copyPrompt(prompt);
  const platform = getAiLaunchPlatform();

  if (platform === 'android' && provider.androidPackage) {
    const packages = [
      provider.androidPackage,
      ...(provider.androidPackageFallbacks ?? []),
    ];

    for (const pkg of packages) {
      const intent = buildAndroidIntent(provider, prompt, pkg);
      if (!intent) continue;
      try {
        launchAndroidIntent(intent.url);
        return { copied, method: intent.method, launched: true };
      } catch {
        /* essayer le package suivant */
      }
    }

    return { copied, method: 'android-failed', launched: false };
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
    return "Gemini s'ouvre via l'app Google (com.google.android.googlequicksearchbox) avec le lien gemini.google.com/app?q=… — pas le Play Store. Texte aussi copié.";
  }
  if (platform === 'ios') {
    return "iOS : l'app s'ouvre si installée ; le texte est copié (préremplissage limité par Safari).";
  }
  return "Sur ordinateur : texte copié — ouvrez l'app mobile et collez-le.";
}
