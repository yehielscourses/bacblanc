/**
 * Compatibilité navigateurs renforcés (Vanadium, mode strict, etc.)
 */

/** @type {boolean | null} */
let storageOk = null;

export function isStorageAvailable() {
  if (storageOk !== null) return storageOk;
  try {
    const probe = '__nsi_quiz_storage_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    storageOk = true;
  } catch {
    storageOk = false;
  }
  return storageOk;
}

/** @param {string} key */
export function safeStorageGet(key) {
  if (!isStorageAvailable()) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** @param {string} key @param {string} value */
export function safeStorageSet(key, value) {
  if (!isStorageAvailable()) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** @param {string} key */
export function safeStorageRemove(key) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Remplace le contenu d'un élément (polyfill replaceChildren).
 * @param {HTMLElement} el
 * @param {Node | Node[]} content
 */
export function setElementContent(el, content) {
  const nodes = Array.isArray(content) ? content : [content];
  if (typeof el.replaceChildren === 'function') {
    el.replaceChildren(...nodes);
    return;
  }
  while (el.firstChild) el.removeChild(el.firstChild);
  for (const node of nodes) {
    if (node) el.appendChild(node);
  }
}

/** Laisse le navigateur afficher le spinner avant un gros JSON.parse */
export function yieldToMain() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/** Indice pour Vanadium / GrapheneOS (JIT souvent désactivé par site). */
export function mayNeedJitHint() {
  return /Android/i.test(navigator.userAgent);
}
