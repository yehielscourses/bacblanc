/**
 * Icônes SVG inline pour le menu assistants IA (pas d'emoji — rendu fiable partout).
 */

/** @type {Record<string, string>} */
const ICONS = {
  gemini: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><defs><linearGradient id="gemGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4285f4"/><stop offset="45%" stop-color="#9b72cb"/><stop offset="100%" stop-color="#d96570"/></linearGradient></defs><path fill="url(#gemGrad)" d="M12 3l1.6 4.9h5.1l-4.1 3 1.6 4.9L12 12.8 7.8 16.8l1.6-4.9-4.1-3h5.1z"/></svg>`,

  chatgpt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#10a37f"/><path fill="#fff" d="M12 5.5c-2.2 0-3.5 1.2-3.5 2.8 0 1.2.7 1.9 2 2.4l1.8.6c1 .3 1.4.7 1.4 1.3 0 .8-.7 1.4-1.9 1.4-1.1 0-2-.5-2.6-1.2l-1.5 1.4c.9 1.1 2.3 1.8 4 1.8 2.4 0 3.8-1.2 3.8-3 0-1.3-.8-2-2.2-2.5l-1.9-.6c-.9-.3-1.3-.7-1.3-1.2 0-.7.6-1.2 1.7-1.2 1 0 1.8.4 2.3 1l1.4-1.3c-.8-.9-2-1.5-3.4-1.5zm-4.5 8.5h-2v2h2v-2zm9 0h-2v2h2v-2z"/></svg>`,

  claude: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#d97757"/><path fill="#fff" d="M7 17l3.5-10h1.2l2.2 6.4 2.2-6.4h1.2L21 17h-1.8l-2.4-7.2-2.3 7.2h-1.2l-2.3-7.2L8.8 17z"/></svg>`,

  perplexity: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1f6feb"/><path fill="#fff" d="M12 4l2.5 7h7l-5.7 4.1 2.2 7L12 18l-5 4.1 2.2-7L3.5 11h7z"/></svg>`,

  grok: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#000"/><path fill="#fff" d="M6 6h4.5l3 4.5L16.5 6H21l-6.75 9L21 24h-4.5l-3-4.5L10.5 24H6l6.75-9z"/></svg>`,
};

/**
 * @param {string} providerId
 * @returns {string}
 */
export function getAiProviderIcon(providerId) {
  return ICONS[providerId] ?? ICONS.chatgpt;
}
