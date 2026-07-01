// Calendar view logic

var calendarSessions = [];
var currentDate = new Date();
var selectedDate = null;

// Egypt Public Holidays 2026
// Fixed-date holidays
var EGYPT_HOLIDAYS_FIXED = [
  { month: 1, day: 7, name: "Coptic Christmas Day" },
  { month: 1, day: 25, name: "National Police Day" },
  { month: 4, day: 13, name: "Sham El Nessim" },
  { month: 4, day: 25, name: "Sinai Liberation Day" },
  { month: 5, day: 1, name: "Labour Day" },
  { month: 6, day: 30, name: "June 30 Revolution" },
  { month: 7, day: 23, name: "Revolution Day" },
  { month: 10, day: 6, name: "Armed Forces Day" }
];

// Islamic calendar holidays (forecasted dates for 2026, subject to moon sighting)
var EGYPT_HOLIDAYS_ISLAMIC = [
  { month: 3, day: 20, name: "Eid Al-Fitr (Day 1)" },
  { month: 3, day: 21, name: "Eid Al-Fitr (Day 2)" },
  { month: 3, day: 22, name: "Eid Al-Fitr (Day 3)" },
  { month: 5, day: 27, name: "Eid Al-Adha (Day 1)" },
  { month: 5, day: 28, name: "Eid Al-Adha (Day 2)" },
  { month: 5, day: 29, name: "Eid Al-Adha (Day 3)" },
  { month: 5, day: 30, name: "Eid Al-Adha (Day 4)" },
  { month: 6, day: 16, name: "Islamic New Year" },
  { month: 8, day: 26, name: "Prophet's Birthday" }
];

/**
 * Check if a date is an Egypt public holiday
 * @param {Date} date - The date to check
 * @returns {Object|null} Holiday info or null
 */
function getEgyptHoliday(date) {
  var month = date.getMonth() + 1; // 1-12
  var day = date.getDate();
  var year = date.getFullYear();
  
  // Only check for 2026 (and nearby years for flexibility)
  if (year < 2025 || year > 2027) {
    return null;
  }
  
  // Check fixed holidays
  for (var i = 0; i < EGYPT_HOLIDAYS_FIXED.length; i++) {
    var h = EGYPT_HOLIDAYS_FIXED[i];
    if (h.month === month && h.day === day) {
      return { name: h.name, type: 'fixed' };
    }
  }
  
  // Check Islamic holidays
  for (var j = 0; j < EGYPT_HOLIDAYS_ISLAMIC.length; j++) {
    var hi = EGYPT_HOLIDAYS_ISLAMIC[j];
    if (hi.month === month && hi.day === day) {
      return { name: hi.name, type: 'islamic' };
    }
  }
  
  return null;
}

/** YYYY-MM-DD in the user's local calendar (not UTC). */
function localDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

document.addEventListener('DOMContentLoaded', function() {
  loadSessions();
  setupNavigation();
});

function setupNavigation() {
  document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && overlay.id !== 'day-panel-overlay') {
        overlay.classList.remove('active');
      }
    });
  });
}

async function loadSessions() {
  try {
    const response = await fetch('/api/sessions');
    calendarSessions = await response.json();
    renderCalendar();
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const monthTitle = document.getElementById('current-month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  monthTitle.textContent = new Date(year, month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let html = '';

  // Previous month days
  const prevMonth = new Date(year, month, 0);
  const prevMonthDays = prevMonth.getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    html += createCalendarDay(day, new Date(year, month - 1, day), true, today);
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month, day);
    html += createCalendarDay(day, date, false, today);
  }

  // Next month days
  const remainingDays = 42 - (startDay + totalDays);
  for (let day = 1; day <= remainingDays; day++) {
    html += createCalendarDay(day, new Date(year, month + 1, day), true, today);
  }

  grid.innerHTML = html;

  // Add click handlers
  grid.querySelectorAll('.calendar-day').forEach(dayEl => {
    dayEl.addEventListener('click', () => {
      const dateStr = dayEl.dataset.date;
      if (dateStr) {
        const parts = dateStr.split('-').map(Number);
        if (parts.length === 3) {
          selectDate(new Date(parts[0], parts[1] - 1, parts[2]));
        }
      }
    });
  });
}

function createCalendarDay(day, date, isOtherMonth, today) {
  const dateStr = localDateKey(date);
  const isToday = date.getTime() === today.getTime();
  const isSelected = selectedDate && date.getTime() === selectedDate.getTime();

  // Find sessions on this date
  const daySessions = calendarSessions.filter(session => {
    const sessionDate = localDateKey(new Date(session.dateTime));
    return sessionDate === dateStr;
  });

  const hasSessions = daySessions.length > 0;
  const holiday = !isOtherMonth ? getEgyptHoliday(date) : null;
  const isHoliday = holiday !== null;

  const classes = ['calendar-day'];
  if (isOtherMonth) classes.push('other-month');
  if (isToday) classes.push('today');
  if (hasSessions) classes.push('has-sessions');
  if (isHoliday) classes.push('is-holiday');
  if (isSelected) classes.push('selected');

  let sessionsIndicator = '';
  
  // Show holiday indicator
  if (isHoliday) {
    sessionsIndicator = `<div class="holiday-indicator" title="${escapeHtml(holiday.name)}">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 12h8M12 8v8"/>
      </svg>
      <span class="holiday-name">${escapeHtml(holiday.name)}</span>
    </div>`;
  } else if (hasSessions) {
    if (daySessions.length <= 3) {
      sessionsIndicator = `<div class="day-sessions-indicator">
        ${daySessions.map(() => '<div class="session-dot"></div>').join('')}
      </div>`;
    } else {
      sessionsIndicator = `<div class="day-sessions-indicator">
        ${daySessions.slice(0, 3).map(() => '<div class="session-dot"></div>').join('')}
        <div class="session-dot secondary"></div>
      </div>
      <div class="day-sessions-preview"><strong>${daySessions.length}</strong> session${daySessions.length > 1 ? 's' : ''}</div>`;
    }
  } else if (!isOtherMonth) {
    sessionsIndicator = '<div class="day-sessions-preview">No sessions</div>';
  }

  return `
    <div class="${classes.join(' ')}" data-date="${dateStr}">
      <div class="day-number">${day}</div>
      ${sessionsIndicator}
    </div>
  `;
}

function selectDate(date) {
  selectedDate = date;
  renderCalendar();
  openDayPanel(date);
}

function openDayPanel(date) {
  const panel = document.getElementById('day-sessions-panel');
  const overlay = document.getElementById('day-panel-overlay');
  const title = document.getElementById('day-sessions-title');
  const dateEl = document.getElementById('day-sessions-date');
  const content = document.getElementById('day-sessions-content');

  const holiday = getEgyptHoliday(date);
  
  title.textContent = holiday ? 'Egypt Public Holiday' : 'Sessions';
  dateEl.textContent = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // If it's a holiday, show special message
  if (holiday) {
    content.innerHTML = `
      <div class="holiday-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
        </svg>
        <h4>${escapeHtml(holiday.name)}</h4>
        <p>Egypt Public Holiday - No sessions can be scheduled on this day.</p>
      </div>
    `;
    
    panel.classList.add('active');
    overlay.classList.add('active');
    return;
  }

  const dateStr = localDateKey(date);
  const daySessions = calendarSessions.filter(session => {
    const sessionDate = localDateKey(new Date(session.dateTime));
    return sessionDate === dateStr;
  });

  if (daySessions.length === 0) {
    content.innerHTML = `
      <div class="day-empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <h4>No sessions scheduled</h4>
        <p>Check back later or browse other dates.</p>
      </div>
    `;
  } else {
    content.innerHTML = daySessions.map(session => {
      const time = new Date(session.dateTime).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
      return `
        <div class="day-session-card" onclick="viewSession('${session.id}')">
          <div class="day-session-card-title">${escapeHtml(session.title)}</div>
          <div class="day-session-card-meta">
            <span>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="1210 1612 1515 1212 1922"/>
              </svg>
              ${time}
            </span>
            <span>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              ${escapeHtml(session.presenter)}
            </span>
            <span>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              ${escapeHtml(session.location)}
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  panel.classList.add('active');
  overlay.classList.add('active');
}

function closeDayPanel() {
  document.getElementById('day-sessions-panel').classList.remove('active');
  document.getElementById('day-panel-overlay').classList.remove('active');
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
