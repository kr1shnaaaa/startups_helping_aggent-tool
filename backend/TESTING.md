# Phase 1 Backend Testing Checklist

## Setup

- [ ] Copy `.env.example` to `.env` and configure MongoDB, Firebase, and AI credentials.
- [ ] Run `npm install` from `backend/`.
- [ ] Start the API with `npm start`.
- [ ] Confirm `GET http://localhost:5000/api/health` returns `{ "status": "ok" }`.
- [ ] Optional: run `node scripts/seedData.js` to create representative records.
- [ ] Optional: run `npm run seed:candidates` to create Phase 4A demo candidate records.

## Phase 4A demo candidate seed data

Phase 4A demo candidate data is seeded into the existing `users` collection as real `User` documents with `profileType: "candidate"` and `profileCompleted: true`.

- Seed command: `npm run seed:candidates`
- Seed file: `backend/scripts/seedCandidates.js`
- Candidate count: 20
- Demo identifier: deterministic `firebaseUid` values from `demo-cand-01` through `demo-cand-20`
- Duplicate behavior: reruns update the same demo users with `findOneAndUpdate(..., { upsert: true })`
- Taxonomy source: `backend/config/taxonomies.js` and the actual `User` schema enums
- Firebase Auth: no Firebase accounts, passwords, credentials, or signup calls are created; demo Firebase UIDs are MongoDB identifiers only
- Matching eligibility: candidates satisfy existing search requirements: `profileType: "candidate"`, `profileCompleted: true`, populated `skills`, `targetRoles`, `domainInterests`, `availability`, and `workPreference`

The seed data intentionally includes strong, medium, partial, role-mismatch, domain-mismatch, availability-mismatch, and work-mode-mismatch profiles for Phase 4 matching tests.

## Authentication and profiles

- [ ] `POST /api/users/sync` creates or updates the authenticated Firebase user.
- [ ] `GET /api/users/profile` returns the authenticated profile.
- [ ] `PUT /api/users/profile` persists founder or candidate profile fields.
- [ ] `POST /api/users/profile` creates a founder profile for a new Firebase user.
- [ ] `POST /api/users/candidate-profile` creates a candidate profile for a new Firebase user.
- [ ] Requests without a Bearer token return `401`.

## Ideas

- [ ] `POST /api/ideas` creates an idea owned by the authenticated user.
- [ ] `GET /api/ideas` lists only the authenticated founder's ideas.
- [ ] `GET /api/ideas/:ideaId` returns a valid idea.
- [ ] `PUT /api/ideas/:ideaId` updates only an owned idea.
- [ ] `DELETE /api/ideas/:ideaId` deletes an unapproved idea.
- [ ] Invalid IDs return `400`; non-owners receive `403`.
- [ ] Missing title or a description shorter than 20 characters returns `400`.

## AI analysis

- [ ] `POST /api/ideas/:ideaId/analyze` returns structured roles, skills, tech stack, and team size.
- [ ] `GET /api/ideas/:ideaId/analysis` returns the owner's analysis.
- [ ] `PUT /api/ideas/:ideaId/analysis` saves founder edits or approval.
- [ ] AI failures restore the idea to `draft` and return a controlled error.

## Discovery

- [ ] `POST /api/users/candidates/search` returns only completed candidate profiles.
- [ ] `GET /api/ideas/discover` returns only approved, discoverable ideas.

## Persistence

- [ ] Restarting the backend does not remove records.
- [ ] Seed records are linked to the expected founder and idea.
- [ ] MongoDB indexes are created from the model definitions.
