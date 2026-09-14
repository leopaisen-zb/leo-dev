(() => {
  'use strict';

  const statuses = [
    ['todo', 'To do'],
    ['doing', 'In progress'],
    ['done', 'Done'],
  ];
  const labels = Object.fromEntries(statuses);
  const emptyCopy = {
    todo: 'A gentle place to begin.',
    doing: 'Pick up a task when you’re ready.',
    done: 'Finished tasks can rest here.',
  };
  const board = { tasks: [], activity: [] };
  const elements = {
    add: document.querySelector('#add-task-button'),
    search: document.querySelector('#task-search'),
    priority: document.querySelector('#priority-filter'),
    status: document.querySelector('#app-status'),
    error: document.querySelector('#app-error'),
    taskDialog: document.querySelector('#task-dialog'),
    deleteDialog: document.querySelector('#delete-dialog'),
    importDialog: document.querySelector('#import-dialog'),
    form: document.querySelector('#task-form'),
    formError: document.querySelector('#task-form-error'),
    deleteError: document.querySelector('#delete-form-error'),
    id: document.querySelector('#task-id'),
    title: document.querySelector('[data-field="title"]'),
    notes: document.querySelector('[data-field="notes"]'),
    taskStatus: document.querySelector('[data-field="status"]'),
    taskPriority: document.querySelector('[data-field="priority"]'),
    save: document.querySelector('#save-task-button'),
    confirmDelete: document.querySelector('#confirm-delete-button'),
    import: document.querySelector('#import-button'),
    export: document.querySelector('#export-button'),
    importForm: document.querySelector('#import-form'),
    importJson: document.querySelector('#import-json'),
    importError: document.querySelector('#import-form-error'),
    confirmImport: document.querySelector('#confirm-import-button'),
    lists: Object.fromEntries(statuses.map(([value]) => [value, document.querySelector(`[data-task-list="${value}"]`)])),
    empties: Object.fromEntries(statuses.map(([value]) => [value, document.querySelector(`[data-empty="${value}"]`)])),
    counts: Object.fromEntries(statuses.map(([value]) => [value, document.querySelector(`[data-count="${value}"]`)])),
    activity: document.querySelector('#activity-list'),
  };
  let pending = false;
  let dialogReturnFocus = null;
  let deleteTask = null;
  let deleteReturnFocus = null;
  let importReturnFocus = null;

  function setStatus(message) { elements.status.textContent = message; }
  function clearError() { elements.error.hidden = true; elements.error.textContent = ''; }
  function showError(message) { elements.error.textContent = message; elements.error.hidden = false; }
  function setFormError(message) { elements.formError.textContent = message; elements.formError.hidden = !message; }
  function setDeleteError(message) { elements.deleteError.textContent = message; elements.deleteError.hidden = !message; }
  function setImportError(message) { elements.importError.textContent = message; elements.importError.hidden = !message; }
  function apiError(response, payload) { return payload && typeof payload.error === 'string' ? payload.error : `Request failed (${response.status}).`; }

  async function request(path, options = {}) {
    const response = await fetch(path, options);
    let payload = null;
    if (response.status !== 204) {
      try { payload = await response.json(); } catch { /* A useful fallback is supplied below. */ }
    }
    if (!response.ok) throw new Error(apiError(response, payload));
    return payload;
  }

  function matches(task) {
    const query = elements.search.value.trim().toLocaleLowerCase();
    const priority = elements.priority.value;
    return (!priority || task.priority === priority)
      && (!query || task.title.toLocaleLowerCase().includes(query) || task.notes.toLocaleLowerCase().includes(query));
  }

  function button(text, action, taskId) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'quiet-button';
    control.dataset.action = action;
    control.dataset.taskId = taskId;
    control.textContent = text;
    return control;
  }

  function statusControl(task) {
    const select = document.createElement('select');
    select.className = 'card-status';
    select.dataset.action = 'change-status';
    select.dataset.taskId = task.id;
    select.setAttribute('aria-label', `Change status for ${task.title}`);
    for (const [value, label] of statuses) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      option.selected = task.status === value;
      select.append(option);
    }
    return select;
  }

  function card(task) {
    const item = document.createElement('article');
    item.className = 'task-card';
    const heading = document.createElement('h3');
    heading.textContent = task.title;
    const priority = document.createElement('span');
    priority.className = `priority-chip ${task.priority}`;
    priority.textContent = `${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`;
    item.append(heading, priority);
    if (task.notes) {
      const notes = document.createElement('p');
      notes.className = 'task-notes';
      notes.textContent = task.notes;
      item.append(notes);
    }
    item.append(statusControl(task));
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    actions.append(button('Edit', 'edit-task', task.id), button('Delete', 'delete-task', task.id));
    item.append(actions);
    return item;
  }

  function renderActivity() {
    elements.activity.replaceChildren();
    const recent = board.activity.slice(-8).reverse();
    if (!recent.length) {
      const empty = document.createElement('li');
      empty.className = 'empty-activity';
      empty.textContent = 'Your task updates will appear here.';
      elements.activity.append(empty);
      return;
    }
    for (const entry of recent) {
      const item = document.createElement('li');
      item.className = 'activity-item';
      const action = entry.action === 'create' ? 'Added' : entry.action === 'delete' ? 'Deleted' : entry.action === 'import' ? `Imported ${entry.count ?? ''} task${entry.count === 1 ? '' : 's'}` : 'Updated';
      const time = new Date(entry.timestamp);
      item.textContent = `${action}${entry.action === 'import' ? '' : ` ${entry.title || 'a task'}`}${Number.isNaN(time.valueOf()) ? '' : ` · ${time.toLocaleString()}`}`;
      elements.activity.append(item);
    }
  }

  function render() {
    for (const [value] of statuses) {
      const visible = board.tasks.filter((task) => task.status === value && matches(task));
      elements.lists[value].replaceChildren(...visible.map(card));
      elements.counts[value].textContent = String(visible.length);
      elements.empties[value].hidden = visible.length !== 0;
      elements.empties[value].textContent = !visible.length && (elements.search.value.trim() || elements.priority.value)
        ? 'No tasks match these filters.' : emptyCopy[value];
    }
    renderActivity();
  }

  function restoreFocus(target) {
    requestAnimationFrame(() => {
      const control = target && (target.selector ? document.querySelector(target.selector) : target);
      const fallback = elements.add;
      const focusTarget = control && control.isConnected && !control.disabled ? control : fallback;
      if (focusTarget && focusTarget.isConnected) focusTarget.focus();
    });
  }

  function trapDialogFocus(event) {
    const dialog = event.currentTarget;
    if (!dialog.open || event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])')]
      .filter((control) => !control.hidden && control.getClientRects().length);
    if (!focusable.length) return;
    const index = focusable.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) {
      event.preventDefault();
      focusable.at(-1).focus();
    } else if (!event.shiftKey && (index === -1 || index === focusable.length - 1)) {
      event.preventDefault();
      focusable[0].focus();
    }
  }

  function closeTaskDialog() {
    if (elements.taskDialog.open) elements.taskDialog.close();
  }

  function closeImportDialog() {
    if (elements.importDialog.open) elements.importDialog.close();
  }

  function openImportDialog(trigger) {
    importReturnFocus = trigger;
    setImportError('');
    elements.importDialog.showModal();
    elements.importJson.focus();
  }

  function openEditor(task, trigger) {
    dialogReturnFocus = trigger;
    setFormError('');
    elements.id.value = task ? task.id : '';
    elements.title.value = task ? task.title : '';
    elements.notes.value = task ? task.notes : '';
    elements.taskStatus.value = task ? task.status : 'todo';
    elements.taskPriority.value = task ? task.priority : 'normal';
    document.querySelector('#task-dialog-title').textContent = task ? 'Edit task' : 'Add a task';
    elements.save.textContent = task ? 'Save changes' : 'Save task';
    elements.taskDialog.showModal();
    elements.title.focus();
  }

  async function load() {
    setStatus('Loading your board…');
    clearError();
    try {
      const snapshot = await request('/api/board');
      board.tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
      board.activity = Array.isArray(snapshot.activity) ? snapshot.activity : [];
      render();
      setStatus(board.tasks.length ? 'Board loaded.' : 'Your board is ready for its first task.');
    } catch (cause) {
      board.tasks = [];
      board.activity = [];
      render();
      setStatus('Could not load your board.');
      showError(`${cause.message} Check that the local server is running, then reload.`);
    }
  }

  async function saveTask(event) {
    event.preventDefault();
    if (pending) return;
    const payload = { title: elements.title.value, notes: elements.notes.value, status: elements.taskStatus.value, priority: elements.taskPriority.value };
    if (!payload.title.trim()) {
      setFormError('Give this task a title.');
      elements.title.focus();
      return;
    }
    pending = true;
    elements.save.disabled = true;
    setFormError('');
    clearError();
    const taskId = elements.id.value;
    try {
      const task = await request(taskId ? `/api/tasks/${encodeURIComponent(taskId)}` : '/api/tasks', {
        method: taskId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const index = board.tasks.findIndex((item) => item.id === task.id);
      if (index === -1) board.tasks.push(task); else board.tasks[index] = task;
      render();
      const success = taskId ? 'Task saved.' : 'Task added.';
      setStatus(success);
      const focus = taskId
        ? { selector: `[data-action="edit-task"][data-task-id="${CSS.escape(task.id)}"]` }
        : dialogReturnFocus;
      dialogReturnFocus = focus;
      closeTaskDialog();
      await refreshActivityAfterCommit(success);
    } catch (cause) {
      setFormError(cause.message);
    } finally {
      pending = false;
      elements.save.disabled = false;
    }
  }

  async function refreshActivity() {
    const snapshot = await request('/api/board');
    board.activity = Array.isArray(snapshot.activity) ? snapshot.activity : [];
  }

  async function refreshActivityAfterCommit(success) {
    try {
      await refreshActivity();
      renderActivity();
    } catch (cause) {
      showError(`${success} Recent activity could not refresh. ${cause.message} Reload to try again.`);
    }
  }

  async function changeStatus(control) {
    if (pending) return;
    const id = control.dataset.taskId;
    pending = true;
    clearError();
    control.disabled = true;
    try {
      const task = await request(`/api/tasks/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: control.value }),
      });
      const index = board.tasks.findIndex((item) => item.id === id);
      if (index !== -1) board.tasks[index] = task;
      render();
      setStatus(`Moved “${task.title}” to ${labels[task.status]}.`);
      restoreFocus({ selector: `[data-action="change-status"][data-task-id="${CSS.escape(id)}"]` });
      await refreshActivityAfterCommit(`Moved “${task.title}” to ${labels[task.status]}.`);
    } catch (cause) {
      showError(cause.message);
      render();
      restoreFocus({ selector: `[data-action="change-status"][data-task-id="${CSS.escape(id)}"]` });
    } finally {
      pending = false;
    }
  }

  function askDelete(task, trigger) {
    deleteTask = task;
    deleteReturnFocus = trigger;
    setDeleteError('');
    elements.deleteDialog.showModal();
    elements.confirmDelete.focus();
  }

  async function removeTask(event) {
    event.preventDefault();
    if (!deleteTask || pending) return;
    const task = deleteTask;
    pending = true;
    elements.confirmDelete.disabled = true;
    clearError();
    try {
      await request(`/api/tasks/${encodeURIComponent(task.id)}`, { method: 'DELETE' });
      board.tasks = board.tasks.filter((item) => item.id !== task.id);
      render();
      setStatus(`Deleted “${task.title}”.`);
      deleteReturnFocus = { selector: '#add-task-button' };
      elements.deleteDialog.close();
      await refreshActivityAfterCommit(`Deleted “${task.title}”.`);
    } catch (cause) {
      setDeleteError(cause.message);
    } finally {
      pending = false;
      elements.confirmDelete.disabled = false;
    }
  }

  async function exportBoard() {
    if (pending) return;
    clearError();
    elements.export.disabled = true;
    try {
      const snapshot = await request('/api/export');
      const blob = new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mochi-board.json';
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus('Board export downloaded.');
    } catch (cause) {
      showError(cause.message);
    } finally {
      elements.export.disabled = false;
    }
  }

  async function importBoard(event) {
    event.preventDefault();
    if (pending) return;
    let snapshot;
    try {
      snapshot = JSON.parse(elements.importJson.value);
    } catch {
      setImportError('Paste valid JSON from a Mochi Board export.');
      elements.importJson.focus();
      return;
    }
    pending = true;
    elements.confirmImport.disabled = true;
    setImportError('');
    clearError();
    try {
      const current = await request('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(snapshot),
      });
      board.tasks = Array.isArray(current.tasks) ? current.tasks : [];
      board.activity = Array.isArray(current.activity) ? current.activity : [];
      render();
      setStatus(`Imported ${board.tasks.length} task${board.tasks.length === 1 ? '' : 's'}.`);
      elements.importJson.value = '';
      closeImportDialog();
    } catch (cause) {
      setImportError(cause.message);
    } finally {
      pending = false;
      elements.confirmImport.disabled = false;
    }
  }

  elements.add.addEventListener('click', () => openEditor(null, elements.add));
  elements.search.addEventListener('input', render);
  elements.priority.addEventListener('change', render);
  elements.form.addEventListener('submit', saveTask);
  elements.importForm.addEventListener('submit', importBoard);
  elements.deleteDialog.querySelector('form').addEventListener('submit', (event) => {
    if (event.submitter === elements.confirmDelete) removeTask(event);
  });
  document.addEventListener('click', (event) => {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    if (control.dataset.action === 'close-task-dialog') closeTaskDialog();
    if (control.dataset.action === 'close-import-dialog') closeImportDialog();
    if (control.dataset.action === 'import') openImportDialog(control);
    if (control.dataset.action === 'export') exportBoard();
    if (control.dataset.action === 'edit-task') openEditor(board.tasks.find((task) => task.id === control.dataset.taskId), control);
    if (control.dataset.action === 'delete-task') askDelete(board.tasks.find((task) => task.id === control.dataset.taskId), control);
  });
  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-action="change-status"]')) changeStatus(event.target);
  });
  elements.taskDialog.addEventListener('close', () => { restoreFocus(dialogReturnFocus); dialogReturnFocus = null; });
  elements.deleteDialog.addEventListener('close', () => {
    if (deleteTask) restoreFocus(deleteReturnFocus);
    deleteTask = null;
    deleteReturnFocus = null;
  });
  elements.importDialog.addEventListener('close', () => {
    restoreFocus(importReturnFocus);
    importReturnFocus = null;
  });
  elements.taskDialog.addEventListener('keydown', trapDialogFocus);
  elements.deleteDialog.addEventListener('keydown', trapDialogFocus);
  elements.importDialog.addEventListener('keydown', trapDialogFocus);
  load();
})();
