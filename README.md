# StartupLink Local Setup

This repository contains a Node.js backend and a React + Vite frontend that work together for the StartupLink app.

## Architecture

- Backend: Express + MongoDB + Mongoose + Firebase Admin auth
- Frontend: React + Vite + Firebase client auth + React Router
- Package manager: npm
- Backend port: 5000
- Frontend port: 5173
- Database: MongoDB with environment-based connection strings
- Authentication: Firebase web client + Firebase Admin backend
- AI integration: Google/OpenAI/Anthropic via the Vercel AI SDK

## Requirements

- Node.js 18 or newer (LTS recommended)
- npm available in PATH
- Access to a MongoDB instance
- Firebase project credentials for both frontend and backend

## Quick start

1. Clone the repository.
2. From the project root, run:

```bash
npm run setup
```

3. Fill in the required values in [backend/.env](backend/.env) if they were created from the template. Do not overwrite an existing file.
4. Start both apps together:

```bash
npm run dev
```

## What the setup script does

The root setup command:

- validates the local Node.js/npm environment
- installs backend dependencies from the existing project lock file when available
- installs frontend dependencies using the repo's existing lock file when available
- creates [backend/.env](backend/.env) from [backend/.env.example](backend/.env.example) only if it does not already exist
- prints the environment values you still need to fill in
- keeps all project configuration intact and is safe to rerun

## Environment notes

The backend configuration is defined by [backend/.env.example](backend/.env.example). The keys you typically need to set include:

- PORT
- MONGODB_URI
- MONGODB_DATABASE_NAME
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
- AI_PROVIDER
- AI_MODEL
- GOOGLE_GENERATIVE_AI_API_KEY

The frontend currently uses a Firebase web configuration embedded in [frontend/src/config/firebase-config.js](frontend/src/config/firebase-config.js). There is no frontend .env.example in this repo at the moment.

## Manual validation

You can validate the repository after setup with:

```bash
npm run validate
```

This checks that the expected backend and frontend package scripts are still present.

## Local app URLs

Once both services are running:

- Backend health check: http://localhost:5000/api/health
- Frontend: http://localhost:5173
