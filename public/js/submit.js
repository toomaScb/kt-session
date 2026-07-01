// Submit form logic

// Egypt Public Holidays 2026 (same as calendar.js)
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

function getEgyptHoliday(date) {
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var year = date.getFullYear();
  
  if (year < 2025 || year > 2027) {
    return null;
  }
  
  for (var i = 0; i < EGYPT_HOLIDAYS_FIXED.length; i++) {
    var h = EGYPT_HOLIDAYS_FIXED[i];
    if (h.month === month && h.day === day) {
      return { name: h.name, type: 'fixed' };
    }
  }
  
  for (var j = 0; j < EGYPT_HOLIDAYS_ISLAMIC.length; j++) {
    var hi = EGYPT_HOLIDAYS_ISLAMIC[j];
    if (hi.month === month && hi.day === day) {
      return { name: hi.name, type: 'islamic' };
    }
  }
  
  return null;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('kt-form');
  const alertSuccess = document.getElementById('alert-success');
  const alertError = document.getElementById('alert-error');
  const dateTimeInput = document.getElementById('dateTime');
  const dateTimeHint = document.createElement('div');
  dateTimeHint.className = 'form-hint';
  dateTimeHint.id = 'datetime-hint';
  dateTimeHint.style.display = 'none';
  dateTimeHint.style.color = 'var(--color-report-red)';
  dateTimeHint.style.marginTop = 'var(--space-xs)';
  dateTimeHint.style.fontSize = '0.75rem';
  dateTimeInput.parentNode.appendChild(dateTimeHint);

  // Real-time holiday check when user changes date
  dateTimeInput.addEventListener('change', () => {
    dateTimeHint.style.display = 'none';
    
    if (!dateTimeInput.value) return;
    
    const selectedDate = new Date(dateTimeInput.value);
    const holiday = getEgyptHoliday(selectedDate);
    
    if (holiday) {
      dateTimeHint.textContent = `⚠ ${holiday.name} - Egypt Public Holiday`;
      dateTimeHint.style.display = 'block';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Hide alerts
    alertSuccess.style.display = 'none';
    alertError.style.display = 'none';

    const audienceCheckboxes = document.querySelectorAll('input[name="audience"]:checked');
    const audience = Array.from(audienceCheckboxes).map(cb => cb.value);

    const formData = {
      title: document.getElementById('title').value.trim(),
      subject: document.getElementById('subject').value.trim(),
      presenter: document.getElementById('presenter').value.trim(),
      dateTime: document.getElementById('dateTime').value,
      audience: audience,
      duration: document.getElementById('duration').value,
      location: document.getElementById('location').value.trim(),
      topics: document.getElementById('topics').value.trim()
    };

    // Basic validation
    if (!formData.title || !formData.subject || !formData.presenter ||
        !formData.dateTime || formData.audience.length === 0 || !formData.duration ||
        !formData.location) {
      alertError.textContent = 'Please fill in all required fields.';
      alertError.style.display = 'block';
      return;
    }

    // Validate date is in the future
    const selectedDate = new Date(formData.dateTime);
    if (selectedDate <= new Date()) {
      alertError.textContent = 'Please select a future date and time.';
      alertError.style.display = 'block';
      return;
    }

    // Validate date is not an Egypt public holiday
    const holiday = getEgyptHoliday(selectedDate);
    if (holiday) {
      alertError.textContent = `Cannot schedule sessions on Egypt public holidays: ${holiday.name}. Please select another date.`;
      alertError.style.display = 'block';
      return;
    }

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit Session');
      }

      alertSuccess.style.display = 'block';
      form.reset();

      // Redirect to home page after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      alertError.textContent = err.message || 'An error occurred. Please try again.';
      alertError.style.display = 'block';
    }
  });
});
