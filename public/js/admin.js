// Admin dashboard logic

let requests = [];
let searchQuery = '';
let sortAllField = 'dateTime';
let sortAllAsc = true;

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth status
  const statusResponse = await fetch('/api/auth/status');
  const status = await statusResponse.json();

  if (!status.isAdmin) {
    window.location.href = '/login';
    return;
  }

  // Load requests
  await loadRequests();

  document.getElementById('form-edit-request').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveEditedRequest();
  });

  // Logout button
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  });

  document.getElementById('btn-export').addEventListener('click', exportToExcel);

  // Search functionality
  document.getElementById('search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderTables();
  });
});

async function loadRequests() {
  try {
    const response = await fetch('/api/admin/requests');
    requests = await response.json();
    renderTables();
  } catch (err) {
    showAlert('alert-error', 'Failed to load requests.');
  }
}

function renderTables() {
  const filteredRequests = filterRequests(requests);
  const pendingRequests = filteredRequests.filter(r => r.status === 'pending');
  const allRequests = filteredRequests;

  renderPendingTable(pendingRequests);
  renderAllTable(allRequests);
}

function filterRequests(reqs) {
  if (!searchQuery) return reqs;

  return reqs.filter(r => {
    const titleMatch = r.title.toLowerCase().includes(searchQuery);
    const subjectMatch = r.subject && r.subject.toLowerCase().includes(searchQuery);
    const presenterMatch = r.presenter.toLowerCase().includes(searchQuery);
    const audienceMatch = Array.isArray(r.audience) &&
      r.audience.some(a => a.toLowerCase().includes(searchQuery));
    const locationMatch = r.location.toLowerCase().includes(searchQuery);
    const statusMatch = (r.status || '').toLowerCase().includes(searchQuery);
    return titleMatch || subjectMatch || presenterMatch || audienceMatch || locationMatch || statusMatch;
  });
}

function renderPendingTable(pendingRequests) {
  const container = document.getElementById('pending-requests');

  if (pendingRequests.length === 0) {
    container.innerHTML = '<p class="text-secondary">No pending requests.</p>';
    return;
  }

  container.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Presenter</th>
          <th>Date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${pendingRequests.map(r => `
          <tr>
            <td>${escapeHtml(r.title)}</td>
            <td>${escapeHtml(r.presenter)}</td>
            <td>${formatDate(r.dateTime)}</td>
            <td class="table-actions">
              <button class="btn-icon" onclick="viewRequest('${r.id}')" title="View"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
              <button class="btn-icon" onclick="openEditRequest('${r.id}')" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="btn-icon btn-success" onclick="approveRequest('${r.id}')" title="Approve"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
              <button class="btn-icon btn-danger" onclick="rejectRequest('${r.id}')" title="Reject"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderAllTable(allRequests) {
  const container = document.getElementById('all-requests');

  if (allRequests.length === 0) {
    container.innerHTML = '<p class="text-secondary">No requests yet.</p>';
    return;
  }

  // Sort by selected field and direction
  allRequests.sort((a, b) => {
    const aVal = sortAllField === 'dateTime' ? a.dateTime : a.createdAt;
    const bVal = sortAllField === 'dateTime' ? b.dateTime : b.createdAt;
    const diff = new Date(aVal) - new Date(bVal);
    return sortAllAsc ? diff : -diff;
  });

  const getSortIcon = (field) => {
    if (sortAllField !== field) return 'ↅ';
    return sortAllAsc ? '↑' : '↓';
  };

  container.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Presenter</th>
          <th class="sortable" onclick="toggleSort('dateTime')">Session Date ${getSortIcon('dateTime')}</th>
          <th class="sortable" onclick="toggleSort('createdAt')">Submitted ${getSortIcon('createdAt')}</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${allRequests.map(r => `
          <tr>
            <td>${escapeHtml(r.title)}${new Date(r.dateTime) < new Date() ? '<span class="delivered-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}</td>
            <td>${escapeHtml(r.presenter)}</td>
            <td>${formatDate(r.dateTime)}</td>
            <td>${formatDate(r.createdAt)}</td>
            <td><span class="status-badge status-${r.status || 'approved'}">${r.status || 'approved'}</span></td>
            <td class="table-actions">
              <button class="btn-icon" onclick="viewFeedback('${r.id}')" title="Feedback"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></button>
              <button class="btn-icon" onclick="viewRequest('${r.id}')" title="View"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
              <button class="btn-icon" onclick="openEditRequest('${r.id}')" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              ${r.status === 'pending' ? `
                <button class="btn-icon btn-success" onclick="approveRequest('${r.id}')" title="Approve"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
                <button class="btn-icon btn-danger" onclick="rejectRequest('${r.id}')" title="Reject"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              ` : ''}
              <button class="btn-icon btn-danger" onclick="deleteRequest('${r.id}')" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function viewRequest(id) {
  const request = requests.find(r => r.id === id);
  if (!request) return;

  const modalContent = document.getElementById('modal-view-content');
  const topicsHtml = request.topics && request.topics.length > 0
    ? request.topics.map(topic => `<span class="topic-tag">${escapeHtml(topic)}</span>`).join('')
    : '<span class="text-secondary">No topics specified</span>';
  const audienceHtml = Array.isArray(request.audience)
    ? request.audience.map(a => `<span class="topic-tag">${escapeHtml(a)}</span>`).join('')
    : `<span class="topic-tag">${escapeHtml(request.audience)}</span>`;

  document.getElementById('modal-view-title').textContent = request.title;
  document.getElementById('modal-view-subtitle').textContent = request.subject || '';

  modalContent.innerHTML = `
    <div class="detail-row">
      <label>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        Presenter
      </label>
      <p>${escapeHtml(request.presenter)}</p>
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
      <p>${formatDate(request.dateTime)}</p>
    </div>
    <div class="detail-row">
      <label>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        Location
      </label>
      <p>${escapeHtml(request.location)}</p>
    </div>
    <div class="detail-row">
      <label>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="1210 1612 1515 1212 1922"/>
        </svg>
        Duration
      </label>
      <p>${request.duration} minutes</p>
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
    <div class="detail-row">
      <label>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Status
      </label>
      <p><span class="status-badge status-${request.status || 'approved'}">${request.status || 'approved'}</span></p>
    </div>
    <div class="detail-row">
      <label>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="1210 1612 1515 1212 1922"/>
        </svg>
        Submitted
      </label>
      <p class="text-small text-secondary">${formatDate(request.createdAt)}</p>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" onclick="closeModal('modal-view'); openEditRequest('${request.id}')">Edit</button>
      ${request.status === 'pending' ? `
        <button type="button" class="btn btn-success" onclick="closeModal('modal-view'); approveRequest('${request.id}')">Approve</button>
        <button type="button" class="btn btn-danger" onclick="closeModal('modal-view'); rejectRequest('${request.id}')">Reject</button>
      ` : ''}
    </div>
  `;

  document.getElementById('modal-view').classList.add('active');
}

async function approveRequest(id) {
  try {
    const response = await fetch(`/api/admin/requests/${id}/approve`, { method: 'PATCH' });
    if (!response.ok) throw new Error('Failed to approve');

    showAlert('alert-success', 'Request approved and published!');
    await loadRequests();
  } catch (err) {
    showAlert('alert-error', 'Failed to approve request.');
  }
}

async function rejectRequest(id) {
  try {
    const response = await fetch(`/api/admin/requests/${id}/reject`, { method: 'PATCH' });
    if (!response.ok) throw new Error('Failed to reject');

    showAlert('alert-success', 'Request rejected.');
    await loadRequests();
  } catch (err) {
    showAlert('alert-error', 'Failed to reject request.');
  }
}

async function viewFeedback(id) {
  const request = requests.find(r => r.id === id);
  if (!request) return;

  try {
    const response = await fetch(`/api/admin/requests/${id}/feedback`);
    if (!response.ok) throw new Error('Failed to load feedback');
    const feedbackList = await response.json();

    document.getElementById('modal-view-feedback-session-title').textContent = request.title;

    const modalBody = document.getElementById('modal-view-feedback-content');

    if (!feedbackList || feedbackList.length === 0) {
      modalBody.innerHTML = '<p class="text-secondary">No feedback submitted yet.</p>';
    } else {
      const averageRating = (feedbackList.reduce((sum, f) => sum + f.rating, 0) / feedbackList.length).toFixed(1);
      modalBody.innerHTML = `
        <div class="detail-row">
          <label>Average Rating</label>
          <p><span class="delivered-badge">${averageRating} / 5.0</span> (${feedbackList.length} review${feedbackList.length !== 1 ? 's' : ''})</p>
        </div>
        <div class="feedback-list">
          ${feedbackList.map(f => `
            <div class="feedback-item">
              <div class="feedback-header">
                <strong>${escapeHtml(f.name || 'Anonymous')}</strong>
                <span class="star-display">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</span>
              </div>
              ${f.comment ? `<p class="feedback-comment">${escapeHtml(f.comment)}</p>` : ''}
              <p class="text-small text-secondary">${formatDate(f.submittedAt)}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    document.getElementById('modal-view-feedback').classList.add('active');
  } catch (err) {
    showAlert('alert-error', 'Failed to load feedback.');
  }
}

async function deleteRequest(id) {
  if (!confirm('Are you sure you want to delete this request?')) return;

  try {
    const response = await fetch(`/api/admin/requests/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete');

    showAlert('alert-success', 'Request deleted.');
    await loadRequests();
  } catch (err) {
    showAlert('alert-error', 'Failed to delete request.');
  }
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function toggleSort(field) {
  if (sortAllField === field) {
    sortAllAsc = !sortAllAsc;
  } else {
    sortAllField = field;
    sortAllAsc = true;
  }
  renderTables();
}

function dateTimeToLocalInput(dateTimeStr) {
  if (!dateTimeStr) return '';
  const d = new Date(dateTimeStr);
  if (Number.isNaN(d.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(dateTimeStr))) {
      return String(dateTimeStr).slice(0, 16);
    }
    return '';
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openEditRequest(id) {
  const request = requests.find((r) => r.id === id);
  if (!request) return;

  document.getElementById('edit-id').value = request.id;
  document.getElementById('edit-title').value = request.title || '';
  document.getElementById('edit-subject').value = request.subject || '';
  document.getElementById('edit-presenter').value = request.presenter || '';
  document.getElementById('edit-dateTime').value = dateTimeToLocalInput(request.dateTime);
  document.getElementById('edit-duration').value =
    request.duration != null ? String(request.duration) : '';
  document.getElementById('edit-location').value = request.location || '';
  const topicsVal = Array.isArray(request.topics)
    ? request.topics.join(', ')
    : request.topics || '';
  document.getElementById('edit-topics').value = topicsVal;

  const audienceSet = new Set(
    Array.isArray(request.audience)
      ? request.audience
      : request.audience
        ? [request.audience]
        : []
  );
  document.querySelectorAll('input[name="edit-audience"]').forEach((cb) => {
    cb.checked = audienceSet.has(cb.value);
  });

  document.getElementById('modal-edit').classList.add('active');
}

async function saveEditedRequest() {
  const id = document.getElementById('edit-id').value;
  if (!id) return;

  const audience = Array.from(document.querySelectorAll('input[name="edit-audience"]:checked')).map(
    (cb) => cb.value
  );
  const payload = {
    title: document.getElementById('edit-title').value.trim(),
    subject: document.getElementById('edit-subject').value.trim(),
    presenter: document.getElementById('edit-presenter').value.trim(),
    dateTime: document.getElementById('edit-dateTime').value,
    audience,
    duration: document.getElementById('edit-duration').value,
    location: document.getElementById('edit-location').value.trim(),
    topics: document.getElementById('edit-topics').value.trim()
  };

  if (
    !payload.title ||
    !payload.subject ||
    !payload.presenter ||
    !payload.dateTime ||
    payload.audience.length === 0 ||
    !payload.duration ||
    !payload.location
  ) {
    showAlert('alert-error', 'Please fill in all required fields.');
    return;
  }

  try {
    const response = await fetch(`/api/admin/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Failed to save');
    }

    showAlert('alert-success', 'Session updated.');
    closeModal('modal-edit');
    await loadRequests();
  } catch (err) {
    showAlert('alert-error', err.message || 'Failed to update session.');
  }
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
    }
  });
});

function showAlert(id, message) {
  // Hide all alerts first
  document.querySelectorAll('.alert').forEach(el => el.style.display = 'none');

  const alert = document.getElementById(id);
  alert.textContent = message;
  alert.style.display = 'block';

  // Auto hide after 5 seconds
  setTimeout(() => {
    alert.style.display = 'none';
  }, 5000);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function exportToExcel() {
  if (requests.length === 0) {
    showAlert('alert-error', 'No sessions to export.');
    return;
  }

  const data = requests.map(r => ({
    'Title': r.title || '',
    'Subject': r.subject || '',
    'Presenter': r.presenter || '',
    'Date & Time': r.dateTime ? new Date(r.dateTime).toLocaleString() : '',
    'Location': r.location || '',
    'Duration (min)': r.duration || '',
    'Audience': Array.isArray(r.audience) ? r.audience.join(', ') : r.audience || '',
    'Topics': Array.isArray(r.topics) ? r.topics.join(', ') : r.topics || '',
    'Status': r.status || 'approved',
    'Delivered': new Date(r.dateTime) < new Date() ? 'Yes' : 'No',
    'Created': r.createdAt ? new Date(r.createdAt).toLocaleString() : ''
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sessions');
  XLSX.writeFile(wb, `kt-sessions-${new Date().toISOString().split('T')[0]}.xlsx`);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
