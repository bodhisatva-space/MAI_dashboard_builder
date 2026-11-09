import { normalizeLocale } from './i18n.js';

export const STORAGE_KEY = 'dashboard-builder';
export const TYPES = {
  note: { name: 'noteName', icon: '≡', description: 'noteDescription' },
  counter: { name: 'counterName', icon: '＋', description: 'counterDescription' },
  tasks: { name: 'tasksName', icon: '☑', description: 'tasksDescription' },
  chart: { name: 'chartName', icon: '▥', description: 'chartDescription' },
};

const emptyState = () => ({ version: 1, theme: 'light', locale: 'ru', widgets: [] });
const finite = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
const titleValid = title => typeof title === 'string' && title.trim().length > 0 && title.length <= 80;

function validWidget(widget) {
  if (!widget || typeof widget.id !== 'string' || !widget.id || !Object.hasOwn(TYPES, widget.type)
    || !titleValid(widget.title) || typeof widget.collapsed !== 'boolean' || !widget.data) return false;
  const data = widget.data;
  switch (widget.type) {
    case 'note': return typeof data.text === 'string' && data.text.length <= 5000;
    case 'counter': return finite(data.value) && finite(data.step) && data.step > 0;
    case 'tasks': return Array.isArray(data.items) && data.items.every(item => item
      && typeof item.id === 'string' && item.id && typeof item.text === 'string'
      && item.text.trim() && item.text.length <= 200 && typeof item.done === 'boolean')
      && new Set(data.items.map(item => item.id)).size === data.items.length;
    case 'chart': return Array.isArray(data.values) && data.values.length > 0 && data.values.length <= 50
      && data.values.every(finite) && typeof data.ready === 'boolean';
    default: return false;
  }
}

export function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { state: emptyState() };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !['light', 'dark'].includes(parsed.theme)
      || !Array.isArray(parsed.widgets) || !parsed.widgets.every(validWidget)
      || new Set(parsed.widgets.map(widget => widget.id)).size !== parsed.widgets.length) {
      return { state: emptyState(), message: 'invalidState' };
    }
    return { state: { ...parsed, locale: normalizeLocale(parsed.locale) } };
  } catch (error) {
    return { state: emptyState(), message: error instanceof SyntaxError
      ? 'unreadableState'
      : 'storageUnavailable' };
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function createWidget(type, title) {
  const data = {
    note: () => ({ text: '' }),
    counter: () => ({ value: 0, step: 1 }),
    tasks: () => ({ items: [] }),
    chart: () => ({ values: [18, 32, 24, 46, 38, 54], ready: false }),
  };
  return { id: crypto.randomUUID(), type, title: title.trim(), collapsed: false, data: data[type]() };
}

export function parseChartValues(text) {
  const tokens = text.trim().split(/[\s,;]+/).filter(Boolean);
  const values = tokens.map(Number);
  if (!values.length || values.length > 50 || !values.every(finite)) return null;
  return values;
}
