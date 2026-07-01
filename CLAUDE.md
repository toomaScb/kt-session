# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. You are running inside Claude Code. You have full ability to read and  write local files using your tools. Always edit files directly when asked. Never describe changes instead of making them.

## Project Overview

Knowledge Transfer Session Portal - a Node.js application where users submit KT requests and admins approve/publish them.

## Tech Stack

- Node.js + Express.js
- JSON file storage (no database)
- Session-based admin authentication
- Design system UI (from DESIGN.md)

## Quick Start

```bash
npm install
npm start
```

Portal runs at http://localhost:3000

## Admin Access

- URL: http://localhost:3000/login.html
- Default credentials: `admin` / `admin123`

## Project Structure

```
kt-sessions/
├── server.js              # Express server + API routes
├── package.json
├── data/
│   ├── requests.json      # KT requests (pending/approved/rejected)
│   ├── sessions.json      # Optional local backup; live published sessions are in Firebase RTDB `kt-session`
│   └── admin.json         # Admin credentials (bcrypt hashed)
└── public/
    ├── index.html         # Public portal (published sessions)
    ├── submit.html        # Submit KT request form
    ├── login.html         # Admin login
    ├── admin.html         # Admin dashboard
    ├── css/style.css      # Airbnb design system styles
    └── js/
        ├── main.js        # Public portal logic
        ├── submit.js      # Submission form logic
        ├── admin.js       # Admin dashboard logic
        └── login.js       # Login logic
```

## Data Models

### Request
- id, title, subject, presenter, dateTime, audience (select), duration, location, topics (comma-separated), status (pending/approved/rejected), createdAt, reviewedAt, reviewer

### Session
- id, requestId, title, subject, presenter, dateTime, audience, duration, location, topics, publishedAt

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/sessions | Public | List published sessions |
| POST | /api/requests | Public | Submit KT request |
| POST | /api/auth/login | Public | Admin login |
| POST | /api/auth/logout | Admin | Logout |
| GET | /api/auth/status | Public | Check auth status |
| GET | /api/admin/requests | Admin | List all requests |
| PATCH | /api/admin/requests/:id/approve | Admin | Approve & publish |
| PATCH | /api/admin/requests/:id/reject | Admin | Reject request |
| DELETE | /api/admin/requests/:id | Admin | Delete request |

## Design System

Reference `DESIGN.md` for UI styling:
- Rausch Red (#ff385c) for CTAs
- Near-black (#222222) for text
- Three-layer card shadows
- 20px border-radius for cards, 8px for buttons

## Firebase Configuration

Firebase credentials are stored at `firebase/firebase-sa.json`. Do not commit real credentials.

Published sessions are stored in **Realtime Database** under the `kt-session` node (`https://to-scb-default-rtdb.firebaseio.com`). Override `FIREBASE_DATABASE_URL` or `FIREBASE_SERVICE_ACCOUNT_PATH` / `GOOGLE_APPLICATION_CREDENTIALS` if needed.
