import ru from './locales/ru.js';
import en from './locales/en.js';

const messages = { ru, en };
let locale = 'ru';

export function normalizeLocale(value) {
  return Object.hasOwn(messages, value) ? value : 'ru';
}

export function setLocale(value) {
  locale = normalizeLocale(value);
  return locale;
}

export function t(key, params = {}) {
  const dictionary = Object.hasOwn(messages[locale], key) ? messages[locale] : ru;
  const text = Object.hasOwn(dictionary, key) ? dictionary[key] : key;
  return text.replace(/\{(\w+)\}/g, (placeholder, name) => Object.hasOwn(params, name) ? String(params[name]) : placeholder);
}

export function translatePage() {
  document.documentElement.lang = locale;
  document.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
  for (const attribute of ['aria-label', 'content']) {
    document.querySelectorAll(`[data-i18n-${attribute}]`).forEach(node => {
      node.setAttribute(attribute, t(node.getAttribute(`data-i18n-${attribute}`)));
    });
  }
}
