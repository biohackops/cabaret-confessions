/* ═══════════════════════════════════════════════
   Cabaret Confessions — Landing Page Script
   iOS Safari Optimized
   ═══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Create floating gold particles ──────────
  const particlesContainer = document.getElementById('particles');
  const PARTICLE_COUNT = 25;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.setProperty('--dur', `${5 + Math.random() * 9}s`);
    p.style.setProperty('--del', `${Math.random() * 7}s`);
    const size = 2 + Math.random() * 4;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    particlesContainer.appendChild(p);
  }

  // ── Reveal secret button after 3 seconds ────
  setTimeout(() => {
    const secretBtn = document.getElementById('secret-btn');
    if (secretBtn) secretBtn.classList.add('revealed');
  }, 3000);

  // ── Character counter ───────────────────────
  const textarea = document.getElementById('confession-text');
  const charCount = document.getElementById('char-count');

  textarea.addEventListener('input', () => {
    charCount.textContent = textarea.value.length;
    // Visual warning near limit
    if (textarea.value.length > 450) {
      charCount.style.color = 'var(--red-crimson)';
    } else {
      charCount.style.color = '';
    }
  });

  // ── Form submission ─────────────────────────
  const form = document.getElementById('confession-form');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const successMessage = document.getElementById('success-message');
  const anotherBtn = document.getElementById('another-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = textarea.value.trim();
    const name = document.getElementById('confession-name').value.trim();

    if (!text || !name) return;

    // Loading state
    submitBtn.classList.add('loading');
    btnText.textContent = '···';

    try {
      const response = await fetch('/api/confessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, name })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Submission failed');
      }

      // Success!
      form.style.display = 'none';
      successMessage.classList.add('visible');
      createSparkles();

      // Blur any focused input (dismiss iOS keyboard)
      document.activeElement?.blur();

    } catch (err) {
      console.error('Submission error:', err);
      // Subtle error feedback
      submitBtn.style.background = 'linear-gradient(135deg, var(--red-crimson), var(--red-deep))';
      btnText.textContent = 'Try Again';
      setTimeout(() => {
        submitBtn.style.background = '';
        submitBtn.classList.remove('loading');
        btnText.textContent = 'Confess';
      }, 2000);
    }
  });

  // ── Confess Again ───────────────────────────
  anotherBtn.addEventListener('click', () => {
    form.reset();
    charCount.textContent = '0';
    charCount.style.color = '';
    form.style.display = '';
    successMessage.classList.remove('visible');
    submitBtn.classList.remove('loading');
    btnText.textContent = 'Confess';
    // Clear sparkles
    document.getElementById('success-sparkles').innerHTML = '';
  });

  // ── Sparkle burst on success ────────────────
  function createSparkles() {
    const container = document.getElementById('success-sparkles');
    const count = 20;

    for (let i = 0; i < count; i++) {
      const dot = document.createElement('div');
      dot.className = 'sparkle-dot';

      const angle = (Math.PI * 2 * i) / count;
      const distance = 60 + Math.random() * 80;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;

      dot.style.left = '50%';
      dot.style.top = '30%';
      dot.style.setProperty('--tx', `${tx}px`);
      dot.style.setProperty('--ty', `${ty}px`);
      dot.style.setProperty('--dur', `${0.6 + Math.random() * 0.6}s`);
      dot.style.setProperty('--del', `${Math.random() * 0.3}s`);

      container.appendChild(dot);
    }
  }

  // ── iOS Video Autoplay Fallback ─────────────
  // iOS Safari may block autoplay until user interacts
  const video = document.getElementById('bg-video');

  function tryPlayVideo() {
    if (video.paused) {
      video.play().catch(() => {
        // Still blocked — will try again on next interaction
      });
    }
  }

  // Attempt autoplay
  video.play().catch(() => {
    // If blocked, play on first touch
    const events = ['touchstart', 'click', 'scroll'];
    const handler = () => {
      tryPlayVideo();
      events.forEach(ev => document.removeEventListener(ev, handler));
    };
    events.forEach(ev => document.addEventListener(ev, handler, { passive: true }));
  });

  // ── iOS Keyboard / Viewport Fix ─────────────
  // Ensure the form card stays visible when iOS keyboard opens
  const nameInput = document.getElementById('confession-name');
  const mainContainer = document.getElementById('main-container');

  function scrollToFocused(el) {
    // Small delay to let iOS finish its viewport adjustment
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }

  textarea.addEventListener('focus', () => scrollToFocused(textarea));
  nameInput.addEventListener('focus', () => scrollToFocused(nameInput));

  // Submit on enter from name field
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });
});
