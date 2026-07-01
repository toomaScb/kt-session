# AGENTS.md

## Commands
```bash
npm install && npm start   # Server runs at http://localhost:3000
```

No lint, typecheck, or test scripts exist.

## Auth
- Session-based via `express-session` middleware in `server.js`
- Default admin: `admin` / `admin123` (bcrypt hashed in `data/admin.json`)
- Session cookie: `connect.sid`

## Data Storage
- **Sessions**: Firebase Realtime Database at `https://to-scb-default-rtdb.firebaseio.com/kt-session` (not local JSON)
- Firebase credentials: `firebase/firebase-sa.json` - do not commit real creds

## Common Mistakes
- Posting to wrong Firebase path - sessions go to RTDB `kt-session` node, not Firestore
- Forgetting session secret in production (check `server.js` session config)
- Confusing local `data/sessions.json` backup with live Firebase data

## Architecture
- Single Express server (`server.js`) serves static `public/` files + API routes
- No build step - client JS is plain ES modules in `public/js/`
- Firebase admin SDK initializes once at server startup

## UI/UX Design System
Reference `DESIGN.md` for all styling:
- **Colors**: Off Black (`#111111`), Warm Cream (`#faf9f6`), Fin Orange (`#ff5600`), Oat Border (`#dedbd6`)
- **Typography**: Saans font with tight line-height (1.00) and negative letter-spacing on headings
- **Buttons**: 4px border-radius, `scale(1.1)` hover, `scale(0.85)` active
- **Cards**: 8px radius, no shadows, warm borders (`#dedbd6`)