// Main portal logic - loads and displays sessions

document.addEventListener('DOMContentLoaded', () => {
  // Only run on pages with session grid (skip calendar page)
  const grid = document.getElementById('sessions-grid');
  if (!grid) return;

  loadSessions();

  // Search functionality
  document.getElementById('search-input').addEventListener('input', (e) => {
    filterSessions(e.target.value);
  });

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  // Star rating handling
  document.querySelectorAll('#star-rating .star').forEach(star => {
    star.addEventListener('click', () => {
      const value = star.dataset.value;
      document.getElementById('feedback-rating').value = value;
      document.querySelectorAll('#star-rating .star').forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.value) <= value);
      });
    });
  });
});

let allSessions = [];

function openFeedbackModal(sessionId) {
  const session = allSessions.find(s => s.id === sessionId);
  if (!session) return;

  document.getElementById('feedback-session-id').value = sessionId;
  document.getElementById('modal-feedback-session-title').textContent = session.title;
  document.getElementById('feedback-name').value = '';
  document.getElementById('feedback-rating').value = '';
  document.getElementById('feedback-comment').value = '';
  document.querySelectorAll('#star-rating .star').forEach(s => s.classList.remove('active'));

  document.getElementById('modal-feedback').classList.add('active');
}

async function submitFeedback(event) {
  event.preventDefault();

  const sessionId = document.getElementById('feedback-session-id').value;
  const name = document.getElementById('feedback-name').value.trim();
  const rating = document.getElementById('feedback-rating').value;
  const comment = document.getElementById('feedback-comment').value.trim();

  if (!rating) {
    alert('Please select a star rating');
    return;
  }

  const btn = document.getElementById('feedback-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const response = await fetch(`/api/sessions/${sessionId}/feedback`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rating: parseInt(rating), comment })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to submit feedback');
    }

    closeModal('modal-feedback');
    alert('Thank you for your feedback!');
  } catch (err) {
    alert(err.message || 'Failed to submit feedback. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Feedback';
  }
}

async function loadSessions() {
  const grid = document.getElementById('sessions-grid');
  const emptyState = document.getElementById('empty-state');

  try {
    const response = await fetch('/api/sessions');
    allSessions = await response.json();

    if (allSessions.length === 0) {
      grid.style.display = 'none';
      emptyState.style.display = 'block';
      document.getElementById('search-input').style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    document.getElementById('search-input').style.display = 'block';
    grid.style.display = 'grid';

    // Sort by date (upcoming first)
    allSessions.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

    renderSessions(allSessions);
  } catch (err) {
    console.error('Failed to load sessions:', err);
    grid.innerHTML = '<p class="text-center text-secondary">Failed to load sessions</p>';
  }
}

function filterSessions(query) {
  const grid = document.getElementById('sessions-grid');
  const emptyState = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-state-title');
  const emptyMessage = document.getElementById('empty-state-message');
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    renderSessions(allSessions);
    emptyState.style.display = 'none';
    grid.style.display = 'grid';
    return;
  }

  const filtered = allSessions.filter(session => {
    const titleMatch = session.title.toLowerCase().includes(lowerQuery);
    const subjectMatch = session.subject && session.subject.toLowerCase().includes(lowerQuery);
    const presenterMatch = session.presenter.toLowerCase().includes(lowerQuery);
    const locationMatch = session.location.toLowerCase().includes(lowerQuery);
    const audienceMatch = Array.isArray(session.audience) &&
      session.audience.some(a => a.toLowerCase().includes(lowerQuery));
    const topicsMatch = Array.isArray(session.topics) &&
      session.topics.some(t => t.toLowerCase().includes(lowerQuery));
    return titleMatch || subjectMatch || presenterMatch || locationMatch || audienceMatch || topicsMatch;
  });

  if (filtered.length === 0) {
    grid.style.display = 'none';
    emptyTitle.textContent = 'No matching sessions';
    emptyMessage.textContent = 'Try a different search term.';
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    grid.style.display = 'grid';
    renderSessions(filtered);
  }
}

function renderSessions(sessions) {
  const grid = document.getElementById('sessions-grid');
  const now = Date.now();
  let comingId = null;
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

  for (const s of sessions) {
    const diff = new Date(s.dateTime).getTime() - now;
    if (diff > 0 && diff <= ONE_WEEK) {
      comingId = s.id;
      break;
    }
  }

  grid.innerHTML = sessions.map(s => createSessionCard(s, s.id === comingId, new Date(s.dateTime).getTime() < now)).join('');

  if (comingId) startCountdownTimers();
}

function formatCountdown(ms) {
  if (ms <= 0) return 'Starting now';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function startCountdownTimers() {
  const tick = () => {
    const now = Date.now();
    document.querySelectorAll('.countdown-timer').forEach(el => {
      const target = new Date(el.dataset.target).getTime();
      const remaining = target - now;
      const text = el.querySelector('.countdown-text');
      if (text) text.textContent = formatCountdown(remaining);
      if (remaining <= 0) {
        text.textContent = 'Starting now';
      }
    });
  };
  tick();
  setInterval(tick, 30000);
}

function createSessionCard(session, isComing = false, isDelivered = false) {
  const date = new Date(session.dateTime);
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const badgeHtml = isComing ? '<span class="coming-badge">Coming</span>' : (isDelivered ? '<span class="delivered-badge">Delivered</span>' : '');
  const feedbackBtnHtml = isDelivered ? `<button type="button" class="btn-feedback" onclick="event.stopPropagation(); openFeedbackModal('${session.id}')">Give Feedback</button>` : '';
  const countdownHtml = isComing ? `<div class="countdown-timer" data-target="${session.dateTime}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span class="countdown-text">Calculating...</span></div>` : '';

  return `
    <div class="session-card${isComing ? ' is-coming' : ''}${isDelivered ? ' is-delivered' : ''}" onclick="viewSession('${session.id}')">
      <div class="session-card-image">
        ${badgeHtml}
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
        </svg>
      </div>
      <div class="session-card-body">
        <h3 class="session-card-title">${escapeHtml(session.title)}</h3>
        ${session.subject ? `<p class="session-card-subject">${escapeHtml(session.subject)}</p>` : ''}
        <div class="session-card-meta">
          <div class="session-card-meta-item">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>${formattedDate} at ${formattedTime}</span>
          </div>
          <div class="session-card-meta-item">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>${escapeHtml(session.presenter)}</span>
          </div>
          <div class="session-card-meta-item">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>${escapeHtml(session.location)}</span>
          </div>
          <div class="session-card-meta-item">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="1210 1612 1515 1212 1922"/>
            </svg>
            <span>${session.duration} minutes</span>
          </div>
          <div class="session-card-meta-item">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
            <span>${Array.isArray(session.audience) ? session.audience.join(', ') : escapeHtml(session.audience)}</span>
          </div>
        </div>
        ${countdownHtml}
        ${feedbackBtnHtml}
        <p class="session-card-cta">Click to view details &rarr;</p>
      </div>
    </div>
  `;
}

function viewSession(id) {
  const session = allSessions.find(s => s.id === id);
  if (!session) return;

  const date = new Date(session.dateTime);
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const audienceHtml = Array.isArray(session.audience)
    ? session.audience.map(a => `<span class="topic-tag">${escapeHtml(a)}</span>`).join('')
    : `<span class="topic-tag">${escapeHtml(session.audience)}</span>`;

  const topicsHtml = session.topics && session.topics.length > 0
    ? session.topics.map(topic => `<span class="topic-tag">${escapeHtml(topic)}</span>`).join('')
    : '<span class="text-secondary">No topics specified</span>';

  document.getElementById('modal-session-title').textContent = session.title;
  document.getElementById('modal-session-subtitle').textContent = session.subject || '';
  document.getElementById('modal-session-content').innerHTML = `
    <div class="detail-row">
      <label>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        Presenter
      </label>
      <p>${escapeHtml(session.presenter)}</p>
    </div>
    <div class="detail-row">
      <label>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Date & Time
      </label>
      <p>${formattedDate} at ${formattedTime}</p>
    </div>
    <div class="detail-row">
      <label>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        Location
      </label>
      <p>${escapeHtml(session.location)}</p>
    </div>
    <div class="detail-row">
      <label>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="1210 1612 1515 1212 1922"/>
        </svg>
        Duration
      </label>
      <p>${session.duration} minutes</p>
    </div>
    <div class="detail-row">
      <label>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/>
          <path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
        Target Audience
      </label>
      <div class="topics-display">${audienceHtml}</div>
    </div>
    <div class="detail-row">
      <label>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
        </svg>
        Topics / Contents
      </label>
      <div class="topics-display">${topicsHtml}</div>
    </div>
  `;

  const dl = document.getElementById('modal-download-png');
  if (dl) {
    dl.dataset.sessionId = session.id;
    dl.dataset.sessionTitle = session.title;
  }

  document.getElementById('modal-session').classList.add('active');
}


async function downloadSessionModalPng() {
  if (typeof htmlToImage === 'undefined') {
    alert('Image export is not available.');
    return;
  }
  const btn = document.getElementById('modal-download-png');
  const modal = document.querySelector('#modal-session .modal');
  const body = document.getElementById('modal-session-content');
  if (!modal || !body) return;

  let bg = getComputedStyle(modal).backgroundColor;
  if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
    bg = document.documentElement.getAttribute('data-theme') === 'dark' ? '#1c1b19' : '#ffffff';
  }
  const prevLabel = btn ? btn.textContent : '';

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving…';
  }

  const bodyPrev = { maxHeight: body.style.maxHeight, overflowY: body.style.overflowY };
  const modalPrev = { maxHeight: modal.style.maxHeight, overflow: modal.style.overflow };

  body.style.maxHeight = 'none';
  body.style.overflowY = 'visible';
  modal.style.maxHeight = 'none';
  modal.style.overflow = 'visible';

  try {
    const dataUrl = await htmlToImage.toPng(modal, {
      pixelRatio: 2,
      backgroundColor: bg,
      skipFonts: true,
      filter(domNode) {
        if (!(domNode instanceof HTMLElement)) return true;
        if (domNode.classList.contains('modal-close')) return false;
        if (domNode.id === 'modal-download-png') return false;
        return true;
      },
    });
    const title = (btn && btn.dataset.sessionTitle) || 'session';
    const id = (btn && btn.dataset.sessionId) || 'export';
    const filename = sessionPngFilename(title, id);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    console.error(err);
    alert('Could not save image. Try again or use a different browser.');
  } finally {
    body.style.maxHeight = bodyPrev.maxHeight;
    body.style.overflowY = bodyPrev.overflowY;
    modal.style.maxHeight = modalPrev.maxHeight;
    modal.style.overflow = modalPrev.overflow;
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevLabel || 'Download as PNG';
    }
  }
}

function sessionPngFilename(title, id) {
  let base = String(title).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  if (!base) base = 'session-' + String(id).replace(/[^a-z0-9-]+/gi, '');
  return base + '.png';
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
