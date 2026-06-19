/* ═══════════════════════════════════════════════
   Cabaret Confessions — Admin Portal Script
   ═══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Create ambient particles ────────────────
  const particlesEl = document.getElementById('particles');
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${Math.random() * 100}%`;
    const size = 2 + Math.random() * 3;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.setProperty('--dur', `${4 + Math.random() * 6}s`);
    p.style.setProperty('--del', `${Math.random() * 8}s`);
    particlesEl.appendChild(p);
  }

  // ── State ───────────────────────────────────
  let confessions = [];
  let customSlides = [];
  let settings = { slideDuration: 8, requireApproval: false };

  // ── DOM refs ────────────────────────────────
  const confessionsList = document.getElementById('confessions-list');
  const confessionCount = document.getElementById('confession-count');
  const customSlidesList = document.getElementById('custom-slides-list');
  const customCount = document.getElementById('custom-count');
  const slideDurationInput = document.getElementById('slide-duration');
  const requireApprovalInput = document.getElementById('require-approval');
  const approvalLabel = document.getElementById('approval-label');
  const saveSettingsBtn = document.getElementById('save-settings');
  const addCustomSlideBtn = document.getElementById('add-custom-slide');
  const customSlideTextEl = document.getElementById('custom-slide-text');

  // ── Toast notifications ─────────────────────
  function showToast(message) {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3200);
  }

  // ── Escape HTML ─────────────────────────────
  function esc(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  // ── Format time ─────────────────────────────
  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ── Fetch all data ──────────────────────────
  async function fetchAll() {
    try {
      const [cRes, sRes, setRes] = await Promise.all([
        fetch('/api/confessions'),
        fetch('/api/custom-slides'),
        fetch('/api/settings')
      ]);

      confessions = await cRes.json();
      customSlides = await sRes.json();
      settings = await setRes.json();

      renderConfessions();
      renderCustomSlides();
      renderSettings();
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }

  // ── Render Settings ─────────────────────────
  function renderSettings() {
    slideDurationInput.value = settings.slideDuration || 8;
    requireApprovalInput.checked = !!settings.requireApproval;
    updateApprovalLabel();
  }

  function updateApprovalLabel() {
    if (requireApprovalInput.checked) {
      approvalLabel.textContent = 'On — new confessions need approval';
    } else {
      approvalLabel.textContent = 'Off — confessions go live immediately';
    }
  }

  requireApprovalInput.addEventListener('change', updateApprovalLabel);

  // ── Render Confessions ──────────────────────
  function renderConfessions() {
    confessionCount.textContent = confessions.length;

    if (confessions.length === 0) {
      confessionsList.innerHTML = '<div class="empty-state">No confessions yet. The night is still young...</div>';
      return;
    }

    confessionsList.innerHTML = confessions.map((c) => `
      <div class="card ${c.approved ? '' : 'pending'}" draggable="true" data-id="${c.id}" data-type="confession">
        <div class="drag-handle" title="Drag to reorder">
          <span></span><span></span><span></span>
        </div>
        <div class="card-body">
          <div class="card-text">${esc(c.text)}</div>
          <div class="card-meta">
            <span class="card-name">${esc(c.name)}</span>
            <span class="card-time">${fmtTime(c.timestamp)}</span>
            <span class="card-status ${c.approved ? 'status-live' : 'status-pending'}">
              ${c.approved ? 'Live' : 'Pending'}
            </span>
          </div>
        </div>
        <div class="card-actions">
          ${!c.approved
            ? `<button class="btn btn-approve btn-sm" data-action="approve" data-id="${c.id}">Approve</button>`
            : `<button class="btn btn-hide btn-sm" data-action="hide" data-id="${c.id}">Hide</button>`
          }
          <button class="btn btn-danger btn-sm" data-action="delete-confession" data-id="${c.id}">Delete</button>
        </div>
      </div>
    `).join('');

    setupDragDrop(confessionsList, 'confession');
  }

  // ── Render Custom Slides ────────────────────
  function renderCustomSlides() {
    customCount.textContent = customSlides.length;

    if (customSlides.length === 0) {
      customSlidesList.innerHTML = '<div class="empty-state">No custom slides yet. Add announcements or event messages above.</div>';
      return;
    }

    customSlidesList.innerHTML = customSlides.map((s) => `
      <div class="card" draggable="true" data-id="${s.id}" data-type="custom">
        <div class="drag-handle" title="Drag to reorder">
          <span></span><span></span><span></span>
        </div>
        <div class="card-body">
          <div class="card-text">${esc(s.text)}</div>
        </div>
        <div class="card-actions">
          <button class="btn btn-danger btn-sm" data-action="delete-custom" data-id="${s.id}">Delete</button>
        </div>
      </div>
    `).join('');

    setupDragDrop(customSlidesList, 'custom');
  }

  // ── Event Delegation for Card Actions ───────
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    switch (action) {
      case 'approve':
        await approveConfession(id, true);
        break;
      case 'hide':
        await approveConfession(id, false);
        break;
      case 'delete-confession':
        await deleteConfession(id);
        break;
      case 'delete-custom':
        await deleteCustomSlide(id);
        break;
    }
  });

  // ── API Actions ─────────────────────────────
  async function approveConfession(id, approved) {
    try {
      await fetch(`/api/confessions/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved })
      });
      const c = confessions.find(x => x.id === id);
      if (c) c.approved = approved;
      renderConfessions();
      showToast(approved ? '✅ Confession approved' : '🔇 Confession hidden');
    } catch (err) {
      console.error('Approve error:', err);
      showToast('❌ Failed to update');
    }
  }

  async function deleteConfession(id) {
    if (!confirm('Delete this confession permanently?')) return;
    try {
      await fetch(`/api/confessions/${id}`, { method: 'DELETE' });
      confessions = confessions.filter(c => c.id !== id);
      renderConfessions();
      showToast('🗑️ Confession deleted');
    } catch (err) {
      console.error('Delete error:', err);
      showToast('❌ Failed to delete');
    }
  }

  async function deleteCustomSlide(id) {
    if (!confirm('Delete this custom slide?')) return;
    try {
      await fetch(`/api/custom-slides/${id}`, { method: 'DELETE' });
      customSlides = customSlides.filter(s => s.id !== id);
      renderCustomSlides();
      showToast('🗑️ Custom slide deleted');
    } catch (err) {
      console.error('Delete error:', err);
      showToast('❌ Failed to delete');
    }
  }

  // ── Save Settings ───────────────────────────
  saveSettingsBtn.addEventListener('click', async () => {
    const newSettings = {
      slideDuration: Math.max(3, Math.min(120, parseInt(slideDurationInput.value) || 8)),
      requireApproval: requireApprovalInput.checked
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      settings = await res.json();
      renderSettings();
      showToast('⚙️ Settings saved');
    } catch (err) {
      console.error('Settings error:', err);
      showToast('❌ Failed to save settings');
    }
  });

  // ── Add Custom Slide ────────────────────────
  addCustomSlideBtn.addEventListener('click', async () => {
    const text = customSlideTextEl.value.trim();
    if (!text) {
      customSlideTextEl.focus();
      return;
    }

    try {
      const res = await fetch('/api/custom-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const slide = await res.json();
      customSlides.push(slide);
      customSlideTextEl.value = '';
      renderCustomSlides();
      showToast('🎬 Custom slide added');
    } catch (err) {
      console.error('Add slide error:', err);
      showToast('❌ Failed to add slide');
    }
  });

  // Allow Ctrl+Enter to add custom slide
  customSlideTextEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      addCustomSlideBtn.click();
    }
  });

  // ── Drag and Drop ───────────────────────────
  function setupDragDrop(container, type) {
    const cards = container.querySelectorAll('.card');
    let draggedEl = null;

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedEl = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Required for Firefox
        e.dataTransfer.setData('text/plain', card.dataset.id);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        container.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over'));

        // Persist new order
        const ids = Array.from(container.querySelectorAll(`.card[data-type="${type}"]`))
          .map(c => c.dataset.id);

        const endpoint = type === 'confession'
          ? '/api/confessions/reorder'
          : '/api/custom-slides/reorder';

        fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: ids })
        }).then(() => {
          showToast('↕️ Order updated');
        }).catch(err => {
          console.error('Reorder error:', err);
        });

        draggedEl = null;
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (!draggedEl || card === draggedEl) return;

        card.classList.add('drag-over');

        const rect = card.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (e.clientY < midY) {
          container.insertBefore(draggedEl, card);
        } else {
          container.insertBefore(draggedEl, card.nextSibling);
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
      });
    });
  }

  // ── SSE: Real-time sync ─────────────────────
  const eventSource = new EventSource('/api/stream');

  eventSource.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch { return; }

    switch (data.type) {
      case 'new-confession':
        // Only add if not already in our list (avoid duplicates from our own POST)
        if (!confessions.find(c => c.id === data.confession.id)) {
          confessions.push(data.confession);
          renderConfessions();
          showToast('🆕 New confession received!');
        }
        break;

      case 'update-confession': {
        const idx = confessions.findIndex(c => c.id === data.confession.id);
        if (idx !== -1) {
          confessions[idx] = data.confession;
          renderConfessions();
        }
        break;
      }

      case 'delete-confession':
        if (confessions.find(c => c.id === data.id)) {
          confessions = confessions.filter(c => c.id !== data.id);
          renderConfessions();
        }
        break;

      case 'new-custom-slide':
        if (!customSlides.find(s => s.id === data.slide.id)) {
          customSlides.push(data.slide);
          renderCustomSlides();
        }
        break;

      case 'delete-custom-slide':
        if (customSlides.find(s => s.id === data.id)) {
          customSlides = customSlides.filter(s => s.id !== data.id);
          renderCustomSlides();
        }
        break;

      case 'settings-update':
        settings = data.settings;
        renderSettings();
        break;

      case 'connected':
      case 'heartbeat':
        break;
    }
  };

  eventSource.onerror = () => {
    console.warn('SSE connection error. Will auto-reconnect...');
  };

  // ── Initialize ──────────────────────────────
  fetchAll();

});
