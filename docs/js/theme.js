import { getColorSchemePreference, setColorSchemePreference } from './storage.js';

function resolveScheme(preference) {
  if (preference === 'light' || preference === 'dark') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyColorScheme(preference) {
  const resolved = resolveScheme(preference);
  document.documentElement.setAttribute('data-theme', resolved);
}

export function initThemeSwitcher(container) {
  const pref = getColorSchemePreference();
  updateActiveButtons(container, pref);

  container.querySelectorAll('[data-scheme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const scheme = /** @type {HTMLButtonElement} */ (btn).dataset.scheme;
      if (!scheme) return;
      setColorSchemePreference(scheme);
      applyColorScheme(scheme);
      updateActiveButtons(container, scheme);
    });
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getColorSchemePreference() === 'system') applyColorScheme('system');
  });
}

function updateActiveButtons(container, pref) {
  container.querySelectorAll('[data-scheme]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-scheme') === pref);
  });
}
