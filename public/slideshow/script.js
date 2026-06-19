/* ═══════════════════════════════════════════════
   Cabaret Confessions — Slideshow Script
   Real-time SSE + Auto-advancing slides
   ═══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  const slideContainer = document.getElementById('slide-container');
  const waitingState = document.getElementById('waiting-state');

  let slides = [];
  let settings = { slideDuration: 8, transition: 'fade' };
  let currentIndex = -1;
  let advanceTimer = null;

  // ── Create ambient particles ────────────────
  const particlesEl = document.getElementById('particles');
  const PARTICLE_COUNT = 60;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${Math.random() * 100}%`;
    const size = 2 + Math.random() * 5;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.setProperty('--dur', `${3 + Math.random() * 7}s`);
    p.style.setProperty('--del', `${Math.random() * 10}s`);
    particlesEl.appendChild(p);
  }

  // ── Escape HTML helper ──────────────────────
  function esc(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  // ── Fetch initial slide data ────────────────
  async function fetchSlides() {
    try {
      const res = await fetch('/api/slides');
      const data = await res.json();
      slides = data.slides || [];
      settings = data.settings || settings;

      if (slides.length > 0 && currentIndex === -1) {
        currentIndex = 0;
        showSlide(currentIndex);
        startAdvanceTimer();
      }
    } catch (err) {
      console.error('Failed to fetch slides:', err);
      // Retry after 5s
      setTimeout(fetchSlides, 5000);
    }
  }

  // ── Build slide DOM element ─────────────────
  function buildSlideElement(slide) {
    const el = document.createElement('div');
    el.className = 'slide';
    el.dataset.id = slide.id;

    if (slide.type === 'custom') {
      el.innerHTML = `<div class="custom-text">${esc(slide.text)}</div>`;
    } else {
      // Adjust font size (vw) based on text length
      let fontSize = '4.5vw';
      if (slide.text.length > 300) fontSize = '3vw';
      else if (slide.text.length > 200) fontSize = '3.5vw';
      else if (slide.text.length > 100) fontSize = '4vw';

      el.innerHTML = `
        <div class="confession-text" style="font-size: ${fontSize}">
          <span class="confession-quote">"</span>
          ${esc(slide.text)}
        </div>
        <div class="slide-divider"></div>
        <div class="confession-name">— ${esc(slide.name)}</div>
      `;
    }

    return el;
  }

  // ── Show a specific slide ───────────────────
  function showSlide(index) {
    if (slides.length === 0) {
      waitingState.style.display = '';
      return;
    }

    waitingState.style.display = 'none';

    // Exit current slides
    const existing = slideContainer.querySelectorAll('.slide');
    existing.forEach(s => {
      s.classList.remove('active');
      s.classList.add('exiting');
      setTimeout(() => s.remove(), 1300);
    });

    // Create and show new slide
    const slide = slides[index % slides.length];
    const el = buildSlideElement(slide);
    slideContainer.appendChild(el);

    // Force reflow before adding active class
    void el.offsetWidth;
    requestAnimationFrame(() => {
      el.classList.add('active');
    });
  }

  // ── Auto-advance to next slide ──────────────
  function nextSlide() {
    if (slides.length === 0) return;
    currentIndex = (currentIndex + 1) % slides.length;
    showSlide(currentIndex);
  }

  function startAdvanceTimer() {
    stopAdvanceTimer();
    const duration = Math.max(3, settings.slideDuration || 8) * 1000;
    advanceTimer = setInterval(nextSlide, duration);
  }

  function stopAdvanceTimer() {
    if (advanceTimer) {
      clearInterval(advanceTimer);
      advanceTimer = null;
    }
  }

  // ── SSE: Real-time updates ──────────────────
  let eventSource = null;
  let reconnectTimeout = null;

  function connectSSE() {
    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource('/api/stream');

    eventSource.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch { return; }

      handleSSEEvent(data);
    };

    eventSource.onerror = () => {
      console.warn('SSE connection lost. Reconnecting in 3s...');
      eventSource.close();
      clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(connectSSE, 3000);
    };
  }

  function handleSSEEvent(data) {
    switch (data.type) {

      case 'new-confession': {
        if (data.confession.approved) {
          slides.push({ ...data.confession, type: 'confession' });
          if (slides.length === 1) {
            currentIndex = 0;
            showSlide(0);
            startAdvanceTimer();
          }
        }
        break;
      }

      case 'update-confession': {
        const idx = slides.findIndex(s => s.id === data.confession.id);
        if (data.confession.approved) {
          if (idx === -1) {
            slides.push({ ...data.confession, type: 'confession' });
          } else {
            slides[idx] = { ...data.confession, type: 'confession' };
          }
          if (slides.length === 1) {
            currentIndex = 0;
            showSlide(0);
            startAdvanceTimer();
          }
        } else {
          // Unapproved — remove from slideshow
          if (idx !== -1) {
            const wasShowing = (currentIndex % slides.length) === idx;
            slides.splice(idx, 1);
            if (slides.length === 0) {
              currentIndex = -1;
              waitingState.style.display = '';
              stopAdvanceTimer();
              slideContainer.querySelectorAll('.slide').forEach(s => s.remove());
            } else if (wasShowing) {
              currentIndex = currentIndex % slides.length;
              showSlide(currentIndex);
            }
          }
        }
        break;
      }

      case 'delete-confession':
      case 'delete-custom-slide': {
        const deleteId = data.id;
        const delIdx = slides.findIndex(s => s.id === deleteId);
        if (delIdx !== -1) {
          const wasShowing = (currentIndex % slides.length) === delIdx;
          slides.splice(delIdx, 1);
          if (slides.length === 0) {
            currentIndex = -1;
            waitingState.style.display = '';
            stopAdvanceTimer();
            slideContainer.querySelectorAll('.slide').forEach(s => s.remove());
          } else if (wasShowing) {
            currentIndex = Math.min(currentIndex, slides.length - 1);
            showSlide(currentIndex);
          }
        }
        break;
      }

      case 'reorder':
      case 'reorder-custom-slides': {
        // Full refresh to get correct order
        fetchSlides().then(() => {
          if (slides.length > 0) {
            currentIndex = currentIndex % slides.length;
            showSlide(currentIndex);
          }
        });
        break;
      }

      case 'settings-update': {
        settings = data.settings;
        startAdvanceTimer(); // Restart with new duration
        break;
      }

      case 'new-custom-slide': {
        slides.push({ ...data.slide, type: 'custom' });
        if (slides.length === 1) {
          currentIndex = 0;
          showSlide(0);
          startAdvanceTimer();
        }
        break;
      }

      case 'connected':
      case 'heartbeat':
        break;

      default:
        console.log('Unknown SSE event:', data.type);
    }
  }

  // ── Fullscreen on double-click ──────────────
  document.addEventListener('dblclick', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  });

  // ── Initialize ──────────────────────────────
  fetchSlides();
  connectSSE();

});
