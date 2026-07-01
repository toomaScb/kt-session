const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://to-scb-default-rtdb.firebaseio.com';
const SESSIONS_PATH = 'kt-session';

function resolveServiceAccountPath() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    return path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }
  return path.join(__dirname, '..', 'firebase', 'firebase-sa.json');
}

/**
 * Initialize Firebase Admin (Realtime Database). Call once at startup; exits process on failure.
 */
function initFirebase() {
  const keyPath = resolveServiceAccountPath();

  if (!fs.existsSync(keyPath)) {
    console.error(
      '[Firebase] Service account JSON not found.\n' +
        `  Expected file: ${keyPath}\n` +
        '  Set FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS, or add firebase/firebase-sa.json.'
    );
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  } catch (err) {
    console.error('[Firebase] Failed to read or parse service account JSON:', err.message);
    process.exit(1);
  }

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    console.error('[Firebase] Service account JSON is missing client_email or private_key.');
    process.exit(1);
  }

  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: DATABASE_URL
      });
    }
  } catch (err) {
    console.error('[Firebase] initializeApp failed:', err.message);
    process.exit(1);
  }
}

function getSessionsRef() {
  return admin.database().ref(SESSIONS_PATH);
}

/**
 * Load approved sessions for the public portal (and calendar).
 * Records without `status` are treated as approved for backward compatibility.
 */
async function listSessions() {
  const snap = await getSessionsRef().once('value');
  const val = snap.val();
  if (!val || typeof val !== 'object') {
    return [];
  }
  const list = Object.values(val).filter(Boolean);
  const approved = list.filter(
    (s) => !s.status || s.status === 'approved'
  );
  approved.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  return approved;
}

/**
 * All session records under kt-session (pending, approved, rejected) for admin review.
 */
async function listAllSessions() {
  const snap = await getSessionsRef().once('value');
  const val = snap.val();
  if (!val || typeof val !== 'object') {
    return [];
  }
  return Object.values(val).filter(Boolean);
}

module.exports = {
  initFirebase,
  getSessionsRef,
  listSessions,
  listAllSessions
};
