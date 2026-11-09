import { TYPES, parseChartValues } from './state.js';
import { element, button, field, numberInput } from './ui.js';
import { openModal, closeModal } from './modal.js';
import { t } from './i18n.js';

export function editWidget(widget, onSave) {
  const form = element('form', 'modal-form');
  const title = element('input');
  title.value = widget.title;
  title.required = true;
  title.maxLength = 80;
  title.addEventListener('input', () => title.setCustomValidity(''));
  title.addEventListener('invalid', () => {
    if (title.validity.valueMissing) title.setCustomValidity(t('titleRequired'));
  });
  form.append(field(t('title'), title));
  let text;
  if (widget.type === 'note') {
    text = element('textarea');
    text.rows = 7;
    text.maxLength = 5000;
    text.value = widget.data.text;
    form.append(field(t('noteText'), text));
  }
  const actions = element('div', 'modal-actions');
  const cancel = button(t('cancel'), t('cancelChanges'), 'button secondary');
  cancel.addEventListener('click', closeModal);
  const save = element('button', 'button primary', t('save'));
  save.type = 'submit';
  actions.append(cancel, save);
  form.append(actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!title.value.trim()) {
      title.setCustomValidity(t('titleRequired'));
      title.reportValidity();
      return;
    }
    widget.title = title.value.trim();
    if (text) widget.data.text = text.value;
    closeModal();
    onSave();
  });
  openModal(t(widget.type === 'note' ? 'editNote' : 'editTitle'), form);
}

function renderNote(widget, body, actions) {
  const text = element('p', `note-text${widget.data.text ? '' : ' muted'}`,
    widget.data.text || t('emptyNote'));
  text.addEventListener('dblclick', () => actions.edit(widget));
  const edit = button(`${t('editNote')} ↗`, t('editNote'), 'text-button');
  edit.dataset.control = 'edit-note';
  edit.addEventListener('click', () => actions.edit(widget));
  body.append(text, edit);
}

function renderCounter(widget, body, actions) {
  const controls = element('div', 'counter-controls');
  const value = element('output', 'counter-value', String(widget.data.value));
  value.setAttribute('aria-label', t('counterValue'));
  value.setAttribute('aria-live', 'polite');
  for (const direction of [-1, 1]) {
    const control = button(direction < 0 ? '−' : '+', t(direction < 0 ? 'decrease' : 'increase'), 'counter-button');
    control.dataset.control = direction < 0 ? 'minus' : 'plus';
    control.addEventListener('click', () => {
      if (!step.reportValidity()) return;
      const result = widget.data.value + direction * widget.data.step;
      if (!Number.isFinite(result) || Math.abs(result) > Number.MAX_SAFE_INTEGER) {
        actions.notify('counterLimit');
        return;
      }
      // Убираем обычный шум двоичной арифметики, например 0.1 + 0.2.
      widget.data.value = Number.isInteger(result) ? result : Number(result.toPrecision(15));
      actions.change();
    });
    controls.append(control);
    if (direction < 0) controls.append(value);
  }
  const step = numberInput(widget.data.step, t('counterStep'));
  step.dataset.control = 'step';
  step.min = '0';
  step.max = String(Number.MAX_SAFE_INTEGER);
  step.addEventListener('input', () => {
    step.setCustomValidity('');
    const next = step.valueAsNumber;
    if (!Number.isFinite(next) || next <= 0 || next > Number.MAX_SAFE_INTEGER) {
      step.setCustomValidity(t('invalidStep'));
      return;
    }
    widget.data.step = next;
    actions.persist();
  });
  step.addEventListener('change', () => step.reportValidity());
  body.append(controls, field(t('stepLabel'), step));
}

function renderTasks(widget, body, actions) {
  const items = widget.data.items;
  const list = element('ul', 'task-list');
  for (const item of items) {
    const row = element('li', `task${item.done ? ' completed' : ''}`);
    const label = element('label', 'task-label');
    const checkbox = element('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.done;
    checkbox.dataset.control = `task-${item.id}`;
    checkbox.addEventListener('change', () => {
      item.done = checkbox.checked;
      actions.change();
    });
    label.append(checkbox, element('span', '', item.text));
    const remove = button('×', t('deleteTask', { text: item.text }));
    remove.dataset.control = `remove-${item.id}`;
    remove.addEventListener('click', () => {
      widget.data.items = items.filter(task => task.id !== item.id);
      actions.change('task-input');
    });
    row.append(label, remove);
    list.append(row);
  }
  if (!items.length) list.append(element('li', 'muted task-placeholder', t('emptyTasks')));
  const form = element('form', 'task-form');
  const input = element('input');
  input.placeholder = t('taskPlaceholder');
  input.required = true;
  input.maxLength = 200;
  input.setAttribute('aria-label', t('newTask'));
  input.dataset.control = 'task-input';
  input.addEventListener('input', () => input.setCustomValidity(''));
  input.addEventListener('invalid', () => {
    if (input.validity.valueMissing) input.setCustomValidity(t('taskRequired'));
  });
  const add = element('button', 'button secondary', '+');
  add.type = 'submit';
  add.setAttribute('aria-label', t('addTask'));
  form.append(input, add);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!input.value.trim()) {
      input.setCustomValidity(t('taskRequired'));
      input.reportValidity();
      return;
    }
    items.push({ id: crypto.randomUUID(), text: input.value.trim(), done: false });
    actions.change('task-input');
  });
  body.append(list, form, element('p', 'widget-footnote', t('tasksProgress', { done: items.filter(item => item.done).length, total: items.length })));
}

function renderChart(widget, body, actions, status) {
  if (!widget.data.ready) {
    const loading = element('div', 'chart-status');
    if (status === 'error') {
      loading.setAttribute('role', 'alert');
      loading.append(element('p', '', t('chartError')));
      const retry = button(t('retry'), t('retryChart'), 'button secondary');
      retry.dataset.control = 'retry';
      retry.addEventListener('click', () => actions.retry(widget));
      loading.append(retry);
    } else {
      loading.setAttribute('role', 'status');
      const spinner = element('span', 'spinner');
      spinner.setAttribute('aria-hidden', 'true');
      loading.append(spinner, element('p', '', t('chartLoading')));
    }
    body.append(loading);
    return;
  }
  const values = widget.data.values;
  const chart = element('div', 'chart');
  chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', t('chartValues', { values: values.join(', ') }));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  for (const [index, value] of values.entries()) {
    const column = element('div', 'chart-column');
    column.setAttribute('aria-hidden', 'true');
    const plot = element('div', 'bar-plot');
    plot.style.setProperty('--baseline', `${-min / range * 100}%`);
    const bar = element('div', `bar${value < 0 ? ' negative' : ''}`);
    bar.style.height = `${Math.abs(value) / range * 100}%`;
    bar.style.bottom = `${(Math.min(value, 0) - min) / range * 100}%`;
    bar.title = `${index + 1}: ${value}`;
    plot.append(bar);
    column.append(element('span', 'bar-value', String(value)), plot, element('span', 'bar-label', String(index + 1)));
    chart.append(column);
  }
  const form = element('form', 'chart-form');
  const input = element('textarea');
  input.rows = 2;
  input.required = true;
  input.value = values.join(', ');
  input.dataset.control = 'chart-values';
  input.addEventListener('input', () => input.setCustomValidity(''));
  input.addEventListener('invalid', () => {
    if (input.validity.valueMissing) input.setCustomValidity(t('invalidChart'));
  });
  const submit = element('button', 'button secondary', t('updateChart'));
  submit.type = 'submit';
  submit.dataset.control = 'chart-submit';
  form.append(field(t('data'), input, t('chartHint')), submit);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const next = parseChartValues(input.value);
    if (!next) {
      input.setCustomValidity(t('invalidChart'));
      input.reportValidity();
      return;
    }
    widget.data.values = next;
    actions.change();
    actions.notify('chartUpdated');
  });
  body.append(chart, form);
}

export function renderWidget(widget, actions, index, total, chartStatus) {
  const card = element('article', `widget widget-${widget.type}`);
  card.dataset.id = widget.id;
  const header = element('header', 'widget-header');
  const handle = button('⠿', t('dragWidget', { title: widget.title }), 'drag-handle icon-button');
  handle.draggable = true;
  handle.tabIndex = -1;
  const type = element('span', 'widget-type-icon', TYPES[widget.type].icon);
  type.setAttribute('aria-hidden', 'true');
  const heading = element('h2', 'widget-title');
  const title = button(widget.title, t('editWidgetTitle', { title: widget.title }), 'title-button');
  title.dataset.control = 'title';
  title.addEventListener('click', () => actions.edit(widget));
  heading.append(title);
  const collapse = button(widget.collapsed ? '+' : '−', t(widget.collapsed ? 'expandWidget' : 'collapseWidget'));
  collapse.dataset.control = 'collapse';
  collapse.setAttribute('aria-expanded', String(!widget.collapsed));
  collapse.setAttribute('aria-controls', `body-${widget.id}`);
  collapse.addEventListener('click', () => {
    widget.collapsed = !widget.collapsed;
    actions.change();
  });
  const remove = button('×', t('deleteWidget', { title: widget.title }));
  remove.addEventListener('click', () => actions.remove(widget));
  header.append(handle, type, heading, collapse, remove);
  const body = element('div', 'widget-body');
  body.id = `body-${widget.id}`;
  body.hidden = widget.collapsed;
  const renderers = { note: renderNote, counter: renderCounter, tasks: renderTasks, chart: renderChart };
  renderers[widget.type](widget, body, actions, chartStatus);
  const footer = element('footer', 'widget-footer');
  footer.append(element('span', '', t(TYPES[widget.type].name)));
  const order = element('div', 'order-controls');
  for (const [direction, text, label] of [[-1, '←', 'moveEarlier'], [1, '→', 'moveLater']]) {
    const move = button(text, t(label));
    move.dataset.control = `move-${direction}`;
    move.disabled = direction < 0 ? index === 0 : index === total - 1;
    move.addEventListener('click', () => actions.move(widget.id, direction));
    order.append(move);
  }
  footer.append(order);
  card.append(header, body, footer);
  return card;
}
