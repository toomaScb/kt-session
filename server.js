const express = require("express");
const session = require("express-session");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

let bcrypt;
try {
  bcrypt = require("bcrypt");
} catch (err) {
  bcrypt = require("bcryptjs");
}
const { initFirebase, listSessions, listAllSessions, getSessionsRef } = require("./lib/firebase");
const axios = require("axios");
const cron = require("node-cron");

// Webhook notification for new KT session submissions (Microsoft Teams)
const WEBHOOK_URL =
  process.env.KT_WEBHOOK_URL ||
  "https://scbankcomeg.webhook.office.com/webhookb2/4541b953-b5d1-4410-a0b1-1dbbd9a66d77@cca5c6e6-675e-4262-b706-f62628a1ad23/IncomingWebhook/3cfc19bca0e14f8290857d12615524b0/0f841928-cff4-4024-9793-1198d2618b87/V2NTCO_9mzn5RkaSaZgm9b2PFM6oLazReyx5VamzYu5L41";

async function sendWebhookNotification(request) {
  if (!WEBHOOK_URL) return;

  const formattedDate = new Date(request.dateTime).toLocaleString("en-EG", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const payload = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          body: [
            {
              type: "TextBlock",
              size: "Large",
              weight: "Bolder",
              text: "📚 New KT Session Submission",
            },
            {
              type: "FactSet",
              facts: [
                { title: "Title", value: request.title },
                { title: "Subject", value: request.subject },
                { title: "Presenter", value: request.presenter },
                { title: "Date & Time", value: formattedDate },
                { title: "Duration", value: `${request.duration} minutes` },
                { title: "Location", value: request.location },
                { title: "Audience", value: request.audience.join(", ") },
                { title: "Topics", value: request.topics.length > 0 ? request.topics.join(", ") : "N/A" },
              ],
            },
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: "Review in Admin",
              url: `https://transformation-kt.theworkpc.com/admin`,
            },
          ],
        },
      },
    ],
  };

  try {
    await axios.post(WEBHOOK_URL, payload, {
      headers: { "Content-Type": "application/json" },
    });
    console.log("Webhook notification sent for request:", request.id);
  } catch (err) {
    console.error("Webhook notification failed:", err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Hide legacy admin URLs from casual use — canonical paths are /admin and /login
app.get("/admin.html", (req, res) => res.redirect(301, "/admin"));
app.get("/login.html", (req, res) => res.redirect(301, "/login"));

app.use(express.static(publicDir));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

app.use(
  session({
    secret: "kt-sessions-secret-key-2024",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  }),
);

// Data file paths
const DATA_DIR = path.join(__dirname, "data");
const ADMIN_FILE = path.join(DATA_DIR, "admin.json");

initFirebase();

// Helper functions to read/write JSON files
function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
}

// Initialize admin if not exists
async function initAdmin() {
  let admin = readJSON(ADMIN_FILE);
  // if (!admin.username) {
  //   const hash = await bcrypt.hash('admin123', 10);
  //   admin = { username: 'admin', passwordHash: hash };
  //   writeJSON(ADMIN_FILE, admin);
  // }
}
initAdmin();

const EDITABLE_REQUEST_FIELDS = ["title", "subject", "presenter", "dateTime", "audience", "duration", "location", "topics"];

function normalizeAudienceFromBody(body) {
  let { audience } = body;
  if (Array.isArray(audience)) {
    audience = audience.filter(Boolean);
  } else if (typeof audience === "string" && audience.trim()) {
    audience = [audience.trim()];
  } else {
    audience = [];
  }
  return audience;
}

function normalizeTopicsFromBody(topics) {
  if (topics == null || topics === "") return [];
  if (Array.isArray(topics)) {
    return topics.map((t) => String(t).trim()).filter((t) => t);
  }
  return String(topics)
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t);
}

function validateRequestContentFields(data) {
  const { title, subject, presenter, dateTime, audience, duration, location } = data;
  if (!title || !subject || !presenter || !dateTime || !audience || audience.length === 0 || duration == null || duration === "" || !location) {
    return { error: "All fields are required" };
  }
  const durationNum = typeof duration === "number" ? duration : parseInt(duration, 10);
  if (Number.isNaN(durationNum) || durationNum < 1) {
    return { error: "Invalid duration" };
  }
  return { durationNum };
}

// ==================== PUBLIC ROUTES ====================

// Get all published sessions (Firebase Realtime Database: kt-session)
app.get("/api/sessions", async (req, res) => {
  try {
    const sessions = await listSessions();
    res.json(sessions);
  } catch (err) {
    console.error("GET /api/sessions:", err);
    res.status(500).json({ error: "Failed to load sessions" });
  }
});

// Submit a new KT request (stored in Firebase kt-session with status pending)
app.post("/api/requests", async (req, res) => {
  const { title, subject, presenter, dateTime, duration, location, topics } = req.body;
  const audience = normalizeAudienceFromBody(req.body);

  const validation = validateRequestContentFields({
    title,
    subject,
    presenter,
    dateTime,
    audience,
    duration,
    location,
  });
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const id = uuidv4();
  const newRequest = {
    id,
    title: String(title).trim(),
    subject: String(subject).trim(),
    presenter: String(presenter).trim(),
    dateTime,
    audience,
    duration: validation.durationNum,
    location: String(location).trim(),
    topics: normalizeTopicsFromBody(topics),
    status: "pending",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewer: null,
    publishedAt: null,
  };

  try {
    await getSessionsRef().child(id).set(newRequest);
    // Send webhook notification for new submission
    sendWebhookNotification(newRequest).catch((err) => console.error("Webhook error:", err));
    res.status(201).json({ message: "Request submitted successfully", id });
  } catch (err) {
    console.error("POST /api/requests (Firebase):", err);
    res.status(500).json({ error: "Failed to save request" });
  }
});

// ==================== AUTH ROUTES ====================

// Admin login
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const admin = readJSON(ADMIN_FILE);

  if (username !== admin.username) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  req.session.isAdmin = true;
  res.json({ message: "Login successful" });
});

// Admin logout
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy();
  res.json({ message: "Logged out successfully" });
});

// Check auth status
app.get("/api/auth/status", (req, res) => {
  res.json({ isAdmin: req.session && req.session.isAdmin === true });
});

// ==================== ADMIN ROUTES ====================

// Get all requests (admin only) — Firebase kt-session (all statuses)
app.get("/api/admin/requests", requireAuth, async (req, res) => {
  try {
    const requests = await listAllSessions();
    requests.sort((a, b) => {
      const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return cb - ca;
    });
    res.json(requests);
  } catch (err) {
    console.error("GET /api/admin/requests:", err);
    res.status(500).json({ error: "Failed to load requests" });
  }
});

// Update request/session content (admin only) — preserves status and review metadata
app.patch("/api/admin/requests/:id", requireAuth, async (req, res) => {
  const requestId = req.params.id;
  const ref = getSessionsRef().child(requestId);
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const keys = Object.keys(body).filter((k) => EDITABLE_REQUEST_FIELDS.includes(k));
  if (keys.length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  try {
    const snap = await ref.once("value");
    const existing = snap.val();
    if (!existing) {
      return res.status(404).json({ error: "Request not found" });
    }

    const next = { ...existing };
    if (body.title !== undefined) next.title = String(body.title).trim();
    if (body.subject !== undefined) next.subject = String(body.subject).trim();
    if (body.presenter !== undefined) next.presenter = String(body.presenter).trim();
    if (body.dateTime !== undefined) next.dateTime = body.dateTime;
    if (body.audience !== undefined) {
      next.audience = normalizeAudienceFromBody({ audience: body.audience });
    }
    if (body.duration !== undefined) {
      const durationNum = typeof body.duration === "number" ? body.duration : parseInt(body.duration, 10);
      next.duration = durationNum;
    }
    if (body.location !== undefined) next.location = String(body.location).trim();
    if (body.topics !== undefined) next.topics = normalizeTopicsFromBody(body.topics);

    const validation = validateRequestContentFields({
      title: next.title,
      subject: next.subject,
      presenter: next.presenter,
      dateTime: next.dateTime,
      audience: next.audience,
      duration: next.duration,
      location: next.location,
    });
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }
    next.duration = validation.durationNum;

    next.id = existing.id;
    next.status = existing.status;
    next.createdAt = existing.createdAt;
    next.reviewedAt = existing.reviewedAt || null;
    next.reviewer = existing.reviewer || null;
    next.publishedAt = existing.publishedAt || null;

    await ref.set(next);
    res.json({ message: "Request updated", session: next });
  } catch (err) {
    console.error("PATCH /api/admin/requests/:id (Firebase):", err);
    res.status(500).json({ error: "Failed to update request" });
  }
});

// Approve a request (admin only) — set status approved on same kt-session/{id} record
app.patch("/api/admin/requests/:id/approve", requireAuth, async (req, res) => {
  const requestId = req.params.id;
  const ref = getSessionsRef().child(requestId);

  try {
    const snap = await ref.once("value");
    const request = snap.val();
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ error: "Request is not pending" });
    }

    const reviewedAt = new Date().toISOString();
    const publishedSession = {
      ...request,
      status: "approved",
      reviewedAt,
      reviewer: "admin",
      publishedAt: reviewedAt,
    };

    await ref.set(publishedSession);
    res.json({ message: "Request approved", session: publishedSession });
  } catch (err) {
    console.error("PATCH approve (Firebase):", err);
    res.status(500).json({ error: "Failed to publish session" });
  }
});

// Reject a request (admin only)
app.patch("/api/admin/requests/:id/reject", requireAuth, async (req, res) => {
  const requestId = req.params.id;
  const ref = getSessionsRef().child(requestId);

  try {
    const snap = await ref.once("value");
    const request = snap.val();
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ error: "Request is not pending" });
    }

    const reviewedAt = new Date().toISOString();
    await ref.update({
      status: "rejected",
      reviewedAt,
      reviewer: "admin",
    });
    res.json({ message: "Request rejected" });
  } catch (err) {
    console.error("PATCH reject (Firebase):", err);
    res.status(500).json({ error: "Failed to reject request" });
  }
});

// Get feedback for a session (admin only)
app.get("/api/admin/requests/:id/feedback", requireAuth, async (req, res) => {
  const sessionId = req.params.id;
  const ref = getSessionsRef().child(sessionId);

  try {
    const snap = await ref.once("value");
    const session = snap.val();
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const feedback = session.feedback && Array.isArray(session.feedback) ? session.feedback : [];
    res.json(feedback);
  } catch (err) {
    console.error("GET /api/admin/requests/:id/feedback:", err);
    res.status(500).json({ error: "Failed to load feedback" });
  }
});

// Delete a request (admin only)
app.delete("/api/admin/requests/:id", requireAuth, async (req, res) => {
  const requestId = req.params.id;
  const ref = getSessionsRef().child(requestId);

  try {
    const snap = await ref.once("value");
    if (snap.val() == null) {
      return res.status(404).json({ error: "Request not found" });
    }

    await ref.remove();
    res.json({ message: "Request deleted" });
  } catch (err) {
    console.error("DELETE request (Firebase):", err);
    res.status(500).json({ error: "Failed to delete request" });
  }
});

// ==================== SESSION FEEDBACK ====================

// Add feedback to a session (public endpoint)
app.patch("/api/sessions/:id/feedback", async (req, res) => {
  const sessionId = req.params.id;
  var { name, rating, comment } = req.body;

  if (!name || !name.trim()) {
    name = "anonymous";
  }
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5" });
  }

  comment = req.body.comment ? String(req.body.comment).trim() : "";

  const ref = getSessionsRef().child(sessionId);

  try {
    const snap = await ref.once("value");
    const session = snap.val();
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const feedbackEntry = {
      id: uuidv4(),
      name: String(name).trim(),
      rating: Number(rating),
      comment: String(comment).trim(),
      submittedAt: new Date().toISOString(),
    };

    const feedback = session.feedback && Array.isArray(session.feedback) ? session.feedback : [];
    feedback.push(feedbackEntry);

    await ref.update({ feedback });
    res.json({ message: "Feedback added", feedback: feedbackEntry });
  } catch (err) {
    console.error("PATCH /api/sessions/:id/feedback:", err);
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

// ==================== REMINDER SYSTEM (2 Days Before) ====================

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 1 * 24 * 60 * 60 * 1000;

async function sendReminderNotification(session) {
  if (!WEBHOOK_URL) return;

  const formattedDate = new Date(session.dateTime).toLocaleString("en-EG", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const daysUntil = Math.round((new Date(session.dateTime) - new Date()) / ONE_DAY_MS);

  const payload = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          body: [
            {
              type: "TextBlock",
              size: "Large",
              weight: "Bolder",
              text: `📅 KT Session in ${daysUntil} Day${daysUntil !== 1 ? "s" : ""}`,
            },
            {
              type: "FactSet",
              facts: [
                { title: "Title", value: session.title },
                { title: "Subject", value: session.subject },
                { title: "Presenter", value: session.presenter },
                { title: "Date & Time", value: formattedDate },
                { title: "Duration", value: `${session.duration} minutes` },
                { title: "Location", value: session.location },
                { title: "Audience", value: (session.audience || []).join(", ") },
                { title: "Topics", value: session.topics && session.topics.length > 0 ? session.topics.join(", ") : "N/A" },
              ],
            },
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: "View Session",
              url: "https://transformation-kt.theworkpc.com/",
            },
          ],
        },
      },
    ],
  };

  try {
    await axios.post(WEBHOOK_URL, payload, {
      headers: { "Content-Type": "application/json" },
    });
    console.log("Reminder webhook sent for session:", session.id);
  } catch (err) {
    console.error("Reminder webhook failed:", err.message);
  }
}

async function sendSessionReminders() {
  try {
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + TWO_DAYS_MS + ONE_DAY_MS);

    // Query only future sessions (dateTime >= now) to limit Firebase reads
    const snap = await getSessionsRef().orderByChild("dateTime").startAt(now.toISOString()).endAt(twoDaysFromNow.toISOString()).once("value");

    const sessionsObj = snap.val() || {};
    const sessions = Object.values(sessionsObj);

    for (const session of sessions) {
      // Only approved sessions that haven't been reminded yet
      if (session.status !== "approved") continue;
      if (session.reminderSentAt) continue;

      const sessionDate = new Date(session.dateTime);
      const diff = sessionDate - now;

      // Check if session is roughly 2 days away (±1 day tolerance)
      if (diff >= TWO_DAYS_MS - ONE_DAY_MS && diff <= TWO_DAYS_MS + ONE_DAY_MS) {
        await sendReminderNotification(session);

        // Mark as reminded in Firebase
        await getSessionsRef().child(session.id).update({
          reminderSentAt: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("sendSessionReminders error:", err.message);
  }
}

// Schedule daily reminder check at 12:00 PM Cairo time
cron.schedule(
  "0 12 * * *",
  async () => {
    console.log("Running daily session reminder check...");
    await sendSessionReminders();
  },
  { timezone: "Africa/Cairo" },
);

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`KT Sessions Portal running at http://localhost:${PORT}`);
});
