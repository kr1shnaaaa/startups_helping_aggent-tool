# StartupLink Backend API Contract

This document is based on the live backend implementation in the source tree. It is the contract definition for the current app and is the source of truth for frontend integration.

## 1) Authentication contract

All protected endpoints require:

- Header: `Authorization: Bearer <Firebase_ID_Token>`
- Middleware: `backend/middleware/authMiddleware.js`
- Behavior: verifies the Firebase ID token with `firebase-admin/auth`. Missing, empty, or invalid tokens return `401`.

Common unauthenticated response:

```json
{
  "message": "Authentication required"
}
```

Common invalid-token response:

```json
{
  "message": "Invalid or expired authentication token"
}
```

## 2) Response envelope conventions

The backend consistently uses either:

- `success: true` with payload data for successful operations
- `success: false` with `message` for failed operations
- error objects may also include `code` for specific cases

Typical success payload:

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "_id": "66d9...",
    "firebaseUid": "abc123",
    "name": "Jane",
    "profileType": "founder"
  }
}
```

Typical failure payload:

```json
{
  "success": false,
  "message": "Profile not found"
}
```

## 3) Core status codes

- `200 OK` — successful read/update/idempotent transition
- `201 Created` — created resource
- `400 Bad Request` — malformed request, invalid ID, bad input shape
- `401 Unauthorized` — missing or bad Firebase token
- `403 Forbidden` — authenticated user is not owner/authorized
- `404 Not Found` — resource missing
- `409 Conflict` — duplicate or stale state, such as existing profile or pending invitation
- `500 Internal Server Error` — unexpected server-side failure

## 3.1) Shared app routes

### GET /api/health

Purpose: simple backend liveness check for local or deployment health monitoring.

Success response:

```json
{
  "status": "ok",
  "message": "Backend is running"
}
```

### GET /api/auth/me

Purpose: returns the authenticated Firebase user identity for the active session.

Authentication: Firebase Bearer token required.

Success response:

```json
{
  "uid": "firebase-user-uid",
  "email": "user@example.com"
}
```

## 4) User APIs

### POST /api/users/sync

Purpose: create or refresh the MongoDB user record from Firebase login.

Request body fields:

```json
{
  "name": "Optional display name string",
  "profileImage": "Optional profile-image URL string"
}
```

Validation rules:

- Authorization token is mandatory.
- `name` and `profileImage` are optional strings; they are used as overrides if present.
- If user does not exist, backend creates a base user with:
  - `firebaseUid`
  - `email`
  - `name` = requested name OR Firebase name OR email OR UID
  - `profileImage` = requested profileImage OR Firebase photo
  - `college: { name: '' }`
  - `location: { city: '', state: '', region: '' }`
  - `skills: []`
  - `interests: []`
  - `profileCompleted: false`

Success response:

```json
{
  "success": true,
  "message": "User synchronized successfully",
  "user": {
    "_id": "ObjectId",
    "firebaseUid": "firebase-uid",
    "email": "user@example.com",
    "name": "Jane",
    "profileImage": "https://...",
    "college": { "name": "" },
    "location": { "city": "", "state": "", "region": "" },
    "skills": [],
    "interests": [],
    "profileCompleted": false,
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
}
```

Failure status codes:

- `401` missing/invalid Firebase token
- `409` duplicate user / unique key conflict
- `500` MongoDB or server failure

### POST /api/users/profile

Purpose: create founder profile. This is the real founder creation endpoint.

Exact request body:

```json
{
  "profileType": "founder",
  "companyStage": "idea",
  "expertiseAreas": ["Product", "AI"],
  "lookingFor": ["Frontend engineer", "Growth lead"],
  "yearsExperience": 4,
  "bio": "I am building an AI startup around developer workflows."
}
```

Validation rules:

- `profileType` must be exactly `"founder"`
- If the current Firebase UID already exists in Mongo, return `409 PROFILE_EXISTS`
- `companyStage` is optional and may be `"idea"`, `"early"`, `"growth"`, or `""`
- `expertiseAreas` and `lookingFor` are arrays of strings
- `yearsExperience` is optional number
- `bio` is optional string

Success response:

```json
{
  "userId": "ObjectId",
  "profileType": "founder",
  "companyStage": "idea",
  "message": "Profile created"
}
```

Failure status codes:

- `400` invalid `profileType`
- `409` profile already exists
- `500` create failure

### POST /api/users/candidate-profile

Purpose: create candidate profile.

Exact request body shaped for the actual controller:

```json
{
  "targetRoles": ["Frontend Engineer", "Product Manager"],
  "skills": ["React", "Node.js", "Product Design"],
  "availability": "full-time",
  "location": {
    "city": "Boston",
    "state": "MA",
    "region": "US"
  },
  "experience": 3,
  "qualifications": ["BSc CS", "AWS Certified"]
}
```

Important note:

- The controller checks only that `skills` and `targetRoles` are arrays.
- The schema expects `skills` to be an array of objects like `{ name, level }`, so the safe production shape is:

```json
{
  "targetRoles": ["Frontend Engineer"],
  "skills": [
    { "name": "React", "level": "Advanced" },
    { "name": "Node.js", "level": "Intermediate" }
  ],
  "availability": "full-time",
  "location": {
    "city": "Boston",
    "state": "MA",
    "region": "US"
  },
  "experience": 3,
  "qualifications": ["BSc CS"]
}
```

Validation rules:

- `skills` and `targetRoles` must be arrays
- `profileType` is not supplied here; backend sets `profileType: "candidate"`
- If the current user already exists, return `409 PROFILE_EXISTS`

Success response:

```json
{
  "userId": "ObjectId",
  "profileType": "candidate",
  "message": "Candidate profile created"
}
```

### GET /api/users/profile

Purpose: fetch the current authenticated user full profile.

Success response:

```json
{
  "success": true,
  "user": {
    "_id": "ObjectId",
    "firebaseUid": "...",
    "email": "...",
    "name": "...",
    "profileType": "founder | candidate",
    "profileCompleted": true,
    "skills": [],
    "interests": [],
    "bio": "...",
    "targetRoles": [],
    "domainInterests": [],
    "availability": "full-time",
    "hoursPerWeek": 20,
    "workPreference": "remote"
  }
}
```

Failure statuses:

- `404` if no profile exists
- `500` DB failure

### PUT /api/users/profile

Purpose: update the current user profile.

Allowed body fields:

```json
{
  "name": "string",
  "profileType": "founder | candidate",
  "college": { "name": "string", "collegeId": "string" },
  "location": { "city": "string", "state": "string", "region": "string" },
  "skills": [
    { "name": "string", "level": "Beginner | Intermediate | Advanced" }
  ],
  "interests": ["string"],
  "bio": "string",
  "expertiseAreas": ["string"],
  "lookingFor": ["string"],
  "targetRoles": ["string"],
  "domainInterests": ["string"],
  "availability": "full-time | part-time | flexible",
  "hoursPerWeek": 20,
  "workPreference": "remote | in-person | hybrid"
}
```

Validation rules:

- `profileType` must be `founder` or `candidate`
- `skills` must be an array of `{ name, level }` entries
- `level` must be one of `Beginner`, `Intermediate`, `Advanced`
- `hoursPerWeek` must be a number between `0` and `80`
- `availability` must be one of `full-time`, `part-time`, `flexible`, or empty string
- `workPreference` must be one of `remote`, `in-person`, `hybrid`, or empty string
- `profileCompleted` becomes `true` only when:
  - `user.name` exists
  - `user.profileType` exists
  - founder: `bio` exists
  - candidate: `skills.length > 0`

Success response:

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": { "_id": "..." }
}
```

### GET /api/users/profile/:userId

Purpose: return public profile for a user ID.

Response:

```json
{
  "success": true,
  "user": {
    "_id": "ObjectId",
    "name": "Jane",
    "profileImage": "https://...",
    "profileType": "candidate",
    "college": { "name": "" },
    "location": { "city": "", "state": "", "region": "" },
    "skills": [
      { "name": "React", "level": "Advanced" },
      { "name": "Node.js", "level": "Intermediate" }
    ],
    "interests": ["startups", "open source"],
    "targetRoles": ["Frontend Developer", "Full Stack Developer"],
    "domainInterests": ["EdTech", "AI"],
    "availability": "part-time",
    "workPreference": "hybrid",
    "hoursPerWeek": 15
  }
}
```

Failure statuses:

- `400` invalid `userId` format
- `404` user not found
- `500` DB failure

### GET /api/candidates/search/with-scores (Extended)

When used from the Generate Team flow, the response includes matching context:

```json
{
  "success": true,
  "matches": [
    {
      "matchId": "ObjectId",
      "candidate": {
        "id": "ObjectId",
        "name": "string",
        "profileImage": "string",
        "college": { "name": "string" },
        "location": { "city": "string", "state": "string", "region": "string" },
        "skills": [
          { "name": "string", "level": "Beginner|Intermediate|Advanced" }
        ],
        "interests": ["string"],
        "targetRoles": ["string"],
        "domainInterests": ["string"],
        "availability": "full-time|part-time|flexible",
        "workPreference": "remote|in-person|hybrid",
        "hoursPerWeek": 20,
        "createdAt": "ISO date"
      },
      "score": 92.5,
      "explanation": {
        "score": 92.5,
        "matchedSkills": ["React", "Node.js", "MongoDB"],
        "missingSkills": ["TypeScript"],
        "niceToHaveSkills": ["Figma"],
        "sharedDomains": ["EdTech"],
        "roleMatches": ["Full Stack Developer"],
        "components": {
          "skills": 32.0,
          "level": 15.0,
          "role": 15.0,
          "domain": 15.0,
          "availability": 7.5
        },
        "recommendationReason": "3 of 4 required skills matched. preferred role matches. domain interests align. availability is compatible.",
        "scoringVersion": "v1",
        "availabilityFallback": false
      },
      "matchedRoles": ["Full Stack Developer"],
      "invitationStatus": "Pending|Accepted|Declined|Withdrawn|Team Member|null",
      "invitationId": "ObjectId|null",
      "teamId": "ObjectId|null",
      "createdAt": "ISO date"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 24, "totalPages": 2 },
  "sort": "best",
  "minScore": 40
}
```

### POST /api/users/candidates/search

Purpose: search candidates by role/skill/domain/work preference.

Request body fields:

```json
{
  "skills": ["React", "Node.js"],
  "targetRoles": ["Frontend Engineer"],
  "domainInterests": ["Fintech"],
  "workPreference": "remote",
  "availability": "full-time",
  "limit": 20,
  "skip": 0
}
```

Validation rules:

- Query only considers `profileType: "candidate"` and `profileCompleted: true`
- `limit` is clamped to `1..50`
- `skip` is non-negative
- Empty values are ignored

Success response:

```json
{
  "success": true,
  "candidates": [
    {
      "_id": "ObjectId",
      "name": "Jane",
      "profileImage": "...",
      "college": { "name": "" },
      "location": { "city": "", "state": "", "region": "" },
      "skills": [{ "name": "React", "level": "Advanced" }],
      "targetRoles": ["Frontend Engineer"],
      "domainInterests": ["Fintech"],
      "availability": "full-time",
      "workPreference": "remote",
      "hoursPerWeek": 20
    }
  ],
  "total": 1,
  "limit": 20,
  "skip": 0
}
```

## 5) Idea APIs

/_
`POST /api/ideas/:ideaId/enhance` — Enhance stored idea text.
`POST /api/ideas/:ideaId/analyze` — Generate and store idea analysis.
`GET /api/ideas/:ideaId/analysis` — Read stored analysis.
`PUT /api/ideas/:ideaId/analysis` — Edit or approve stored analysis.
`POST /api/ideas/invitations/generate-message` — Generate invitation message content for a matched candidate.
`GET /api/ideas/discover` — Browse ideas for candidates.
`POST /api/ideas/` — Create idea.
`GET /api/ideas/` — List my ideas.
`GET /api/ideas/:ideaId` — Get idea.
`PUT /api/ideas/:ideaId` — Update idea.
`DELETE /api/ideas/:ideaId` — Delete idea.
_/

### POST /api/ideas/invitations/generate-message

Purpose: creates a personalized invitation draft for a founder to send to a matched candidate without creating the Invitation record itself. This is the AI composer endpoint used before the actual `POST /api/invitations` call.

Authentication: Firebase Bearer token required.

Request body:

```json
{
  "ideaId": "ObjectId",
  "candidateId": "ObjectId",
  "role": "Frontend Developer",
  "action": "personalize",
  "draft": "Optional existing draft to enhance or rewrite"
}
```

Validation rules:

- `ideaId` and `candidateId` must be valid Mongo ObjectIds.
- `role` must be a non-empty string.
- `action` must be one of `personalize`, `enhance`, or `summarize`.
- For `action: "enhance"`, a non-empty `draft` string is required.
- The authenticated founder must own the idea.
- The idea must have `aiAnalysis.isApproved === true`.
- The candidate must already have a stored match snapshot for that idea and the requested role must be in `match.explanation.roleMatches`.

Success response:

```json
{
  "success": true,
  "message": "A polished invitation message generated by the AI composer"
}
```

Error statuses:

- `400` invalid IDs, invalid role, invalid action, or missing draft for enhancement
- `401` missing/invalid Firebase token or user profile not found
- `403` user does not own the idea
- `404` idea or candidate not found
- `409` idea not approved or no match snapshot exists
- `502` provider generation failure
- `500` unexpected server error

### GET /api/ideas/discover

Purpose: Allows candidates to browse all startup ideas that have achieved `approved` status from the AI analysis pipeline.

### POST /api/ideas/

Purpose: Enables a founder to create a new startup idea document. The backend automatically assigns the authenticated user as the creator.

### GET /api/ideas/

Purpose: Fetches the authenticated user's ideas for the central resume view.

Authentication: Firebase Bearer token required. The query is scoped to `createdBy` for the authenticated MongoDB user.

Query parameters:

- `status` (optional) — exact persisted idea status
- `limit` (optional, default `20`, clamped to `1..50`)
- `skip` (optional, default `0`, non-negative)

Success response includes the persisted workflow fields needed to resume an idea without regenerating AI content:

```json
{
  "success": true,
  "ideas": [
    {
      "_id": "ObjectId",
      "title": "Raw idea title",
      "description": "Raw idea description",
      "original": {
        "title": "Raw idea title",
        "description": "Raw idea description",
        "capturedAt": "ISO date"
      },
      "enhanced": {
        "title": "Refined title",
        "description": "Refined description",
        "problem": "Problem statement",
        "solution": "Solution explanation",
        "targetAudience": "Target audience",
        "valueProposition": "Value proposition",
        "coreWorkflow": "Core workflow",
        "updatedAt": "ISO date"
      },
      "aiAnalysis": {
        "isApproved": false,
        "scoring": {
          "version": "v1",
          "overallScore": 72,
          "verdict": "PROMISING"
        }
      },
      "status": "draft",
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  ],
  "total": 1
}
```

The list response is safe to use for status badges, score summaries, resume CTAs, and opening `/api/ideas/:ideaId`.

### GET /api/ideas/:ideaId

Purpose: Retrieves the complete persisted idea record used by the phase pages and central idea detail/resume page.

Authentication: Firebase Bearer token required.

Path parameter:

- `ideaId` — valid MongoDB ObjectId

Response includes the same idea record, including `original`, `enhanced`, `aiAnalysis`, `status`, and timestamps. This endpoint does not call the AI provider or create a new idea.

Authorization note: The current controller requires authentication but does not apply an owner check on this read endpoint. Frontend founder workflow pages should only open the authenticated founder's own idea IDs.

### PUT /api/ideas/:ideaId

Purpose: Performs an owner-authorized partial update of one idea record. It is used to save raw edits and enhanced review edits without replacing later workflow phases.

Authentication: Firebase Bearer token required.

Authorization: Only the idea owner may update the record.

Supported body fields:

```json
{
  "title": "Updated raw title",
  "description": "Updated raw description with at least 20 characters",
  "category": "Marketplace",
  "domain": "EdTech",
  "problemStatement": "Optional raw problem statement",
  "targetUsers": "Optional raw target users",
  "requiredSkills": ["React", "Node.js"],
  "enhanced": {
    "title": "Updated refined title",
    "description": "Updated refined description",
    "problem": "Updated problem",
    "solution": "Updated solution",
    "targetAudience": "Updated audience",
    "valueProposition": "Updated value proposition",
    "coreWorkflow": "Updated workflow"
  }
}
```

Rules:

- The update is partial; omitted `original`, `enhanced`, and `aiAnalysis` data is preserved.
- `title` must be at least 3 characters when supplied.
- `description` must be at least 20 characters when supplied.
- `enhanced` must be an object; only supported enhanced fields are merged.
- Saving `enhanced` merges with the existing enhanced object and sets `enhanced.updatedAt`.
- If the current status is `draft` or `enhancing`, saving `enhanced` advances status to `enhanced`.
- Existing analysis and approval metadata are not deleted by raw or enhanced edits.

Success response: `200 OK` with `{ "success": true, "message": "Idea updated successfully", "idea": { ... } }`.

Error statuses:

- `400` invalid ID, invalid enhanced object, or invalid title/description length
- `401` missing/invalid Firebase token
- `403` authenticated user does not own the idea
- `404` user or idea not found
- `500` update failure

### DELETE /api/ideas/:ideaId

Purpose: Allows the owner to delete an idea provided it has not yet received an approved AI analysis.

Validation rules:

- `title` is required and must be at least 3 characters
- `description` is required and must be at least 20 characters
- `requiredSkills` may be an array or omitted
- The backend creates one record with `status: "draft"`.
- `original.title`, `original.description`, and `original.capturedAt` are saved at creation.
- `enhanced` and `aiAnalysis` remain unset until later workflow actions.

Success response:

```json
{
  "success": true,
  "message": "Idea created successfully",
  "idea": {
    "_id": "ObjectId",
    "createdBy": "ObjectId",
    "title": "AI founder matching app",
    "description": "...",
    "status": "draft"
  }
}
```

Status codes:

- `201` created
- `400` invalid title/description
- `404` user not found
- `500` server failure

### GET /api/ideas/discover

Protected candidate-facing idea discovery endpoint.

Query params: `domain`, `category`, `limit`, `skip`

Only returns ideas with:

- `status` in `['analyzed', 'matching', 'team-forming']`
- `aiAnalysis.isApproved === true`

Success response:

```json
{
  "success": true,
  "ideas": [
    {
      "_id": "ObjectId",
      "title": "...",
      "description": "...",
      "category": "...",
      "domain": "...",
      "status": "matching",
      "aiAnalysis": {
        "rolesAndSkills": [],
        "teamSize": 3
      },
      "createdAt": "ISO date"
    }
  ],
  "total": 1
}
```

### DELETE /api/ideas/:ideaId

Validation rules:

- Only the idea owner can delete
- `400` if idea has an approved analysis
- `403` if not owner

## 5.1) Three-phase idea persistence contract

All phases use the same `ideaId`; moving between phases never creates a second `Idea` document.

| Phase          | Persisted fields                                                     | Status values                              | Resume behavior                                                                                     |
| -------------- | -------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Raw Idea       | `title`, `description`, `original`                                   | `draft`                                    | Load the saved raw fields through `GET /api/ideas/:ideaId`                                          |
| Enhanced Idea  | `enhanced` plus `enhanced.updatedAt`                                 | `enhancing` while AI runs, then `enhanced` | Load existing `enhanced`; do not regenerate unless the client explicitly calls the enhance endpoint |
| Final Analysis | `aiAnalysis`, including deterministic `scoring` and `rolesAndSkills` | `analyzing` while AI runs, then `analyzed` | Load existing `aiAnalysis`; `GET /api/ideas/:ideaId/analysis` never regenerates or recomputes       |
| Approved Idea  | `aiAnalysis.isApproved`, `aiAnalysis.approvedAt`                     | `matching`                                 | Preserve `original`, `enhanced`, and `aiAnalysis`; matching becomes available                       |

Backward navigation is safe because raw updates only update raw fields, enhanced updates merge only enhanced fields, and analysis approval updates only analysis/approval fields. Existing later-phase data must not be replaced with `undefined` or `null`.

## 6.1) Enhanced Idea and Deterministic Analysis APIs

### Method

`POST`

### Route

`/api/ideas/:ideaId/enhance`

### Purpose

Uses the configured Vercel AI SDK provider to transform the stored founder idea into a clearer, structured concept. It improves clarity, problem framing, solution explanation, audience, value proposition, and core workflow. It does **not** score, validate the market, or claim absolute novelty.

### Authentication

Firebase Bearer token required.

### Authorization

Only the owner of `ideaId` may enhance the idea.

### Request Body

Optional overrides; omitted fields use the stored raw idea:

```json
{
  "title": "Optional raw title, 3-200 characters",
  "description": "Optional raw description, 20-4000 characters"
}
```

### Query Parameters

None.

### Validation

- `ideaId` must be a valid Mongo ObjectId.
- Optional `title` must be a string from 3 to 200 characters.
- Optional `description` must be a string from 20 to 4000 characters.
- Founder text is delimited and treated as data, not model instructions.

### Success Response

`200 OK`

```json
{
  "success": true,
  "enhancedIdea": {
    "title": "Refined concept title",
    "description": "Refined description",
    "problem": "Problem statement",
    "solution": "Solution explanation",
    "targetAudience": "Primary audience",
    "valueProposition": "Why it is useful",
    "coreWorkflow": "Primary workflow",
    "updatedAt": "ISO-8601 date"
  }
}
```

### Error Responses

- `400` invalid object ID or input length
- `401` missing/invalid Firebase token
- `403` authenticated user does not own the idea
- `404` user or idea not found
- `502` AI provider/schema operation failed; no provider details are returned
- `500` server failure

### Side Effects

- Saves original title/description into `idea.original` if an older idea has no snapshot.
- Replaces `idea.enhanced` with structured enhancement output.
- Sets status to `enhancing` while processing, then `enhanced` on success.

### Database Changes

Updates `original`, `enhanced`, and `status` in the existing `Idea` document. The raw `title` and `description` remain preserved.

---

### Method

`POST`

### Route

`/api/ideas/:ideaId/analyze`

### Purpose

Analyzes the founder's final text—using `idea.enhanced.title` and `idea.enhanced.description` when present, otherwise the raw idea. AI returns structured evidence and team requirements only. The backend computes all final numeric scores and verdicts deterministically.

### Authentication

Firebase Bearer token required.

### Authorization

Only the owner of `ideaId` may analyze the idea.

### Request Body

None.

### Query Parameters

None.

### Validation

- `ideaId` must be a valid Mongo ObjectId.
- The stored idea text is bounded before it is passed to the AI provider.
- AI output must match the server-side Zod schema for evidence, roles, and requirements.
- AI-only differentiation is not proof of real-world novelty or uniqueness.

### Success Response

`200 OK`

```json
{
  "success": true,
  "message": "Idea analyzed successfully",
  "analysis": {
    "evidence": {
      "problem": {
        "clearlyDefined": true,
        "frequency": "high",
        "severity": "medium",
        "explanation": "..."
      },
      "audience": {
        "clearlyDefined": true,
        "primaryAudience": "...",
        "secondaryAudience": "...",
        "accessibility": "high"
      },
      "market": {
        "reach": "medium",
        "monetizable": true,
        "explanation": "..."
      },
      "feasibility": {
        "technicalComplexity": "medium",
        "resourceRequirement": "low",
        "mvpFeasibility": "high",
        "explanation": "..."
      },
      "differentiation": {
        "similarSolutionsKnown": true,
        "hasUniqueValue": true,
        "differentiationStrength": "medium",
        "explanation": "..."
      },
      "monetization": {
        "possible": true,
        "models": ["..."],
        "explanation": "..."
      },
      "execution": { "ideaClarity": "high", "scopeClarity": "medium" },
      "limits": { "assumptions": [], "risks": [], "limitations": [] }
    },
    "scoring": {
      "version": "v1",
      "overallScore": 72,
      "breakdown": {
        "problemStrength": 85,
        "marketPotential": 72,
        "feasibility": 75,
        "differentiation": 55,
        "executionReadiness": 80
      },
      "verdict": "PROMISING"
    },
    "rolesAndSkills": [
      {
        "role": "Frontend Developer",
        "skills": ["React"],
        "priority": "must-have",
        "count": 1,
        "experienceLevel": "Intermediate"
      }
    ],
    "isApproved": false
  }
}
```

### Error Responses

- `400` invalid object ID
- `401` missing/invalid Firebase token
- `403` authenticated user does not own the idea
- `404` user or idea not found
- `502` provider call or schema validation failed
- `500` server failure

### Side Effects

- Sets idea status to `analyzing` while generating evidence.
- Stores structured evidence, normalized skills, deterministic scoring, and team requirements.
- Sets status to `analyzed` on success; restores `enhanced` or `draft` on AI failure.

### Database Changes

Updates `Idea.aiAnalysis` and `Idea.status`. GET analysis never recomputes this saved result.

---

### Method

`GET`

### Route

`/api/ideas/:ideaId/analysis`

### Purpose

Returns the stored analysis only; it never calls AI or recomputes scores.

### Authentication

Firebase Bearer token required.

### Authorization

The owner may read any stored analysis. Other authenticated users may read only an approved analysis.

### Request Body

None.

### Query Parameters

None.

### Success Response

`200 OK` with `{ "success": true, "analysis": { ... } }`, or `analysis: null` when no analysis is stored.

### Error Responses

- `400` invalid object ID
- `401` missing/invalid Firebase token
- `403` non-owner reads unapproved analysis
- `404` idea not found
- `500` server failure

### Side Effects

None.

### Database Changes

None.

---

### Method

`PUT`

### Route

`/api/ideas/:ideaId/analysis`

### Purpose

Lets the idea owner update supported team-requirement fields and/or approve a previously stored analysis.

### Authentication

Firebase Bearer token required.

### Authorization

Only the owner of `ideaId` may update or approve analysis.

### Request Body

```json
{
  "rolesAndSkills": [
    {
      "role": "Frontend Developer",
      "skills": ["React"],
      "priority": "must-have",
      "count": 1,
      "experienceLevel": "Intermediate"
    }
  ],
  "techStack": ["React", "Node.js"],
  "domain": "SaaS",
  "teamSize": 2,
  "keyRequirements": ["..."],
  "nextSteps": ["..."],
  "approve": true
}
```

### Query Parameters

None.

### Validation

- `ideaId` must be a valid Mongo ObjectId.
- `rolesAndSkills`, when supplied, must be a non-empty array with a role field per entry.
- `teamSize`, when supplied, must be at least 1.
- An existing analysis is required before approval.
- Skill aliases are normalized against the canonical taxonomy when safely recognized.

### Success Response

`200 OK` with `{ "success": true, "message": "Analysis approved", "analysis": { ... } }`.

### Error Responses

- `400` invalid input or no existing analysis to approve
- `401` missing/invalid Firebase token
- `403` non-owner
- `404` user or idea not found
- `500` server failure

### Side Effects

When `approve: true`, sets `aiAnalysis.isApproved = true`, saves `approvedAt`, and transitions the idea to `matching`.

### Database Changes

Updates allowed `aiAnalysis` fields; approval modifies `aiAnalysis.isApproved`, `aiAnalysis.approvedAt`, and `Idea.status`.

## Idea Scoring Model

### Version

`v1`

### Principle

AI produces structured evidence only. The backend computes every score and verdict using deterministic rules. Given the same evidence, the result is identical.

### Dimensions and Weights

| Dimension           | Weight | Deterministic evidence inputs                                       |
| ------------------- | -----: | ------------------------------------------------------------------- |
| Problem Strength    |    25% | `clearlyDefined`, problem frequency, severity                       |
| Market Potential    |    25% | market reach, monetizable flag, audience definition/accessibility   |
| Feasibility         |    25% | MVP feasibility, technical complexity, resource requirement         |
| Differentiation     |    15% | unique value flag, differentiation strength, similar solutions flag |
| Execution Readiness |    10% | idea clarity and scope clarity                                      |

### Rule Summary

- Each dimension is deterministically mapped to a score from `0` to `100`.
- Evidence enums map as follows where applicable: high/large = higher points; medium = intermediate points; low/small = lower points.
- For feasibility, lower technical complexity and resource requirement receive higher MVP-feasibility points.
- The weighted score is computed from exact dimension scores and rounded once for stored `overallScore`.
- No model-generated `overallScore`, `aiScore`, or verdict is accepted.

### Verdict Thresholds

| Overall score | Verdict            |
| ------------: | ------------------ |
|        80–100 | `STRONG_POTENTIAL` |
|         65–79 | `PROMISING`        |
|         45–64 | `NEEDS_REFINEMENT` |
|          0–44 | `HIGH_RISK`        |

## 7) Matching APIs

/_
`GET /api/candidates/search/with-scores` — Ranked candidate search.
`GET /api/candidates/matches/:ideaId` — Get candidate match for idea.
_/

### GET /api/candidates/search/with-scores

Purpose: Allows a founder to search for candidates who match the skills and requirements defined in their approved startup idea, returned with compatibility scores.

Authentication: Firebase Bearer token required.

Authorization: Only the idea owner can access. Idea must have `aiAnalysis.isApproved: true`.

Query Parameters:

- `ideaId` (required) — MongoDB ObjectId of the approved idea
- `skills` (optional) — Comma-separated skill names for additional filtering (pre-filter before scoring)
- `level` (optional) — Minimum skill level filter (Beginner, Intermediate, Advanced)
- `domain` (optional) — Domain interest filter
- `workMode` (optional) — Work preference filter (remote, in-person, hybrid)
- `availability` (optional) — Availability filter (full-time, part-time, flexible)
- `sort` (optional, default: 'best') — Sort order
- `page` (optional, default: 1) — Page number (clamped 1..1000000)
- `limit` (optional, default: 20, max: 50) — Results per page
- `minScore` (optional, default: 40, range: 0..100) — Minimum match score threshold

Validation Rules:

- `ideaId` must be a valid MongoDB ObjectId
- Founder must own the idea (403 if not)
- Idea must have approved AI analysis (409 if not)

Success Response (200):

```json
{
  "success": true,
  "matches": [
    {
      "matchId": "ObjectId",
      "candidate": {
        "id": "ObjectId",
        "name": "string",
        "profileImage": "string",
        "college": { "name": "string" },
        "location": { "city": "string", "state": "string", "region": "string" },
        "skills": [
          { "name": "string", "level": "Beginner|Intermediate|Advanced" }
        ],
        "interests": ["string"],
        "targetRoles": ["string"],
        "domainInterests": ["string"],
        "availability": "full-time|part-time|flexible",
        "workPreference": "remote|in-person|hybrid",
        "hoursPerWeek": 20,
        "createdAt": "ISO date"
      },
      "score": 92.5,
      "explanation": {
        "score": 92.5,
        "matchedSkills": ["React", "Node.js", "MongoDB"],
        "missingSkills": ["TypeScript"],
        "niceToHaveSkills": ["Figma"],
        "sharedDomains": ["EdTech"],
        "roleMatches": ["Full Stack Developer"],
        "components": {
          "skills": 32.0,
          "level": 15.0,
          "role": 15.0,
          "domain": 15.0,
          "availability": 7.5
        },
        "recommendationReason": "3 of 4 required skills matched. preferred role matches. domain interests align. availability is compatible.",
        "scoringVersion": "v1",
        "availabilityFallback": false
      },
      "matchedRoles": ["Full Stack Developer"],
      "invitationStatus": "Pending|Accepted|Declined|Withdrawn|Team Member|null",
      "invitationId": "ObjectId|null",
      "teamId": "ObjectId|null",
      "createdAt": "ISO date"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 24, "totalPages": 2 },
  "sort": "best",
  "minScore": 40
}
```

Error Responses:

- `400` — Invalid ideaId format
- `401` — Missing or invalid Firebase token
- `403` — User is not the idea owner
- `409` — Idea analysis not approved
- `500` — Server failure

Database Reads:

- `User` (founder lookup)
- `Idea` (idea lookup, ownership check, approval check, requirements extraction)
- `User` (candidate query with profileType=candidate, profileCompleted=true, excludes founder)
- `Match` (upsert match snapshots)
- `Invitation` (batched lookup for invitation status)
- `Team` (batched lookup for team membership)

Database Writes:

- `Match` (upsert match snapshot with score, explanation, requirementsSnapshot)

Scoring Behavior:

- Only candidates with `profileType: "candidate"` and `profileCompleted: true` are considered
- Founder is explicitly excluded via `_id: { $ne: founder._id }`
- Scores computed from approved `aiAnalysis.rolesAndSkills` (falling back to top-level `requiredSkills`/`requiredRoles`)
- Skill normalization uses taxonomy aliases (e.g., ReactJS → React, NodeJS → Node.js)
- Deterministic scoring: identical inputs always produce identical scores
- Ranking: score descending, then createdAt descending, then candidate id (stable)

### GET /api/candidates/matches/:ideaId

Purpose: Returns the compatibility match score and explanation for the currently authenticated candidate against a specific approved startup idea.

Authentication: Firebase Bearer token required.

Authorization: Any authenticated candidate can check their match. Idea must have `aiAnalysis.isApproved: true`.

Path Parameters:

- `ideaId` — MongoDB ObjectId of the approved idea

Validation Rules:

- `ideaId` must be a valid MongoDB ObjectId
- Idea must have approved AI analysis (409 if not)

Success Response (200):

```json
{
  "success": true,
  "match": {
    "ideaId": "ObjectId",
    "userId": "ObjectId",
    "matchedSkills": ["React", "Node.js"],
    "matchScore": 92.5,
    "explanation": {
      "score": 92.5,
      "matchedSkills": ["React", "Node.js"],
      "missingSkills": ["TypeScript"],
      "niceToHaveSkills": ["Figma"],
      "sharedDomains": ["EdTech"],
      "roleMatches": ["Full Stack Developer"],
      "components": { "skills": 32.0, "level": 15.0, "role": 15.0, "domain": 15.0, "availability": 7.5 },
      "recommendationReason": "3 of 4 required skills matched. preferred role matches. domain interests align. availability is compatible.",
      "scoringVersion": "v1",
      "availabilityFallback": false
    },
    "matchedRoles": ["Full Stack Developer"],
    "scoringVersion": "v1",
    "calculatedAt": "ISO date",
    "refreshedAt": "ISO date",
    "requirementsSnapshot": { ... }
  }
}
```

Error Responses:

- `400` — Invalid ideaId format
- `401` — Missing or invalid Firebase token
- `404` — Idea not found
- `409` — Idea analysis not approved
- `500` — Server failure

Side Effects: Creates/updates `Match` document if none exists.

Database Reads:

- `User` (candidate lookup)
- `Idea` (idea lookup, approval check, requirements extraction)
- `Match` (existing match lookup)

Database Writes:

- `Match` (upsert match snapshot)

### Matching Score Formula

The scoring model uses deterministic weighted components (v1):

| Component    | Weight | Description                                                                                       |
| ------------ | ------ | ------------------------------------------------------------------------------------------------- |
| Skills       | 40%    | Percentage of required must-have skills the candidate possesses                                   |
| Level        | 15%    | Skill level compatibility (Advanced=1.0, Intermediate=0.5, Beginner=0 for required Intermediate+) |
| Role         | 15%    | Candidate targetRoles match against required must-have roles (flexible matching)                  |
| Domain       | 15%    | Candidate domainInterests overlap with idea domain/domainInterests                                |
| Availability | 15%    | Availability, workPreference, and hoursPerWeek compatibility                                      |

Final score = Σ(component_score × weight) rounded to 2 decimal places.

All skill matching uses the canonical taxonomy from `config/taxonomies.js` (e.g., ReactJS/React.js → React, NodeJS/Node.js → Node.js).

## 8) Invitation APIs

/_
`POST /api/invitations/` — Send invitation.
`GET /api/invitations/` — List invitations.
`GET /api/invitations/:invitationId` — Get invitation.
`PUT /api/invitations/:invitationId/accept` — Accept.
`PUT /api/invitations/:invitationId/decline` — Decline.
`PUT /api/invitations/:invitationId/withdraw` — Withdraw.
_/

### POST /api/invitations/

Purpose: Enables a founder to send an invitation to a candidate to join their startup team for a specific idea.

Authentication: Firebase Bearer token required via the router-level auth middleware on `backend/routes/invitationRoutes.js`.

Request body:

```json
{
  "ideaId": "ObjectId",
  "candidateId": "ObjectId",
  "role": "Frontend Developer",
  "message": "Hi Jane, I'd love to invite you to join the team as the Frontend Developer."
}
```

Validation rules:

- `ideaId` and `candidateId` must be valid Mongo ObjectIds.
- `role` must be a non-empty string with at least 2 characters.
- `message` is optional as a trimmed string, but the controller accepts it as a user-authored invitation body.
- The authenticated founder must own the idea.
- The idea's AI analysis must already be approved.
- The candidate must already have a match snapshot for the idea.
- Duplicate pending/accepted invitations are rejected with `409`.
- Withdrawn invitations cannot be reopened.

Success response (201 Created):

```json
{
  "success": true,
  "invitation": {
    "_id": "ObjectId",
    "ideaId": "ObjectId",
    "toCandidate": "ObjectId",
    "fromFounder": "ObjectId",
    "role": "Frontend Developer",
    "message": "Hi Jane, I'd love to invite you to join the team as the Frontend Developer.",
    "status": "Pending",
    "matchContext": {
      "score": 92.5,
      "matchedSkills": ["React", "Node.js"],
      "missingSkills": ["TypeScript"],
      "scoringVersion": "v1"
    }
  }
}
```

Error statuses:

- `400` invalid IDs or missing role
- `401` missing/invalid Firebase token or profile not found
- `403` authenticated user is not the idea owner
- `404` idea not found
- `409` analysis not approved, match missing, duplicate invitation, or closed invitation
- `500` invitation creation failure

The authenticated invitation-composer AI endpoint is `POST /api/ideas/invitations/generate-message`.
It accepts `{ ideaId, candidateId, role, action, draft }`, where `action` is `personalize`,
`enhance`, or `summarize`, and returns editable plain message text without creating an invitation.

### GET /api/invitations/

Purpose: Lists all invitations sent by or received by the currently authenticated user (can be filtered by direction and status).

### GET /api/invitations/:invitationId

Purpose: Retrieves details of a specific invitation record.

### PUT /api/invitations/:invitationId/accept

Purpose: Allows a candidate to accept an invitation, transitioning its status to `Accepted`.

Important behavioral note:

- This endpoint only changes the invitation state to `Accepted`.
- It does not automatically create a team or assign team membership.
- The backend remains strict: only a `Pending` invitation can be accepted.
- If the invitation is `Withdrawn`, `Declined`, or already `Accepted`, the request returns a stale/duplicate-state response and no team is created.

### PUT /api/invitations/:invitationId/decline

Purpose: Allows a candidate to decline an invitation, transitioning its status to `Declined`.

Important behavioral note:

- This transition is terminal for that invitation and does not create a team or team membership.
- The invitation remains in history and can still be retrieved via `/api/invitations` with the `Declined` filter.

### PUT /api/invitations/:invitationId/withdraw

Purpose: Allows a founder to withdraw an invitation before it is acted upon, transitioning its status to `Withdrawn`.

Important behavioral note:

- A `Withdrawn` invitation is historical only and must never become a team membership.
- The candidate cannot accept or decline a withdrawn invitation.

## 9) Team APIs

/_
`POST /api/teams/` — Create team.
`GET /api/teams/` — List teams.
`POST /api/teams/:teamId/members` — Add an accepted candidate to an existing team.
`GET /api/teams/:teamId` — Get team.
_/

### POST /api/teams/

Purpose: Explicitly creates an empty team for an idea owned by the authenticated founder.

Exact request body:

```json
{
  "ideaId": "ObjectId",
  "name": "Campus Launchpad"
}
```

Behavior and validation:

- The authenticated user's profile type must be `founder`, and they must own the idea (`idea.createdBy` must equal `team.founderId`).
- `name` must contain 2-120 characters after trimming. The frontend defaults it to the idea's existing enhanced title or title.
- Team creation does not require an accepted invitation and never adds candidates.
- The team is created with `members: []`; founder identity and ownership are represented by `founderId`, not a member entry.
- Invitation acceptance does not create a team or team membership.
- A team is one-per-idea, enforced by the unique `ideaId` index on the `Team` model.

Success response (`201`):

```json
{
  "success": true,
  "team": {
    "_id": "ObjectId",
    "name": "Campus Launchpad",
    "ideaId": "ObjectId",
    "founderId": { "_id": "ObjectId", "name": "Riya Shah" },
    "members": [],
    "status": "Active",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
}
```

Failure statuses: `400` invalid IDs/name, `401` missing user profile, `403 FOUNDER_REQUIRED` or idea is not owned by the founder, `404` idea not found, `409 TEAM_EXISTS` a team already exists for the idea.

### POST /api/teams/:teamId/members

Purpose: Adds one candidate to an existing team using an accepted invitation.

Exact request body:

```json
{
  "candidateId": "ObjectId"
}
```

The authenticated user must have `profileType: "founder"` and be the team's `founderId`. The candidate must exist, must have `profileType: "candidate"`, must not be the founder or already a member, and must have an `Accepted` invitation from that founder for the same idea. An invitation with no `teamId` or this team's `teamId` is eligible; an invitation assigned elsewhere is not. On success the candidate is stored in `members` with `userId`, invitation `role`, `invitationId`, and `joinedAt`, and the invitation is linked to this team.

Success response (`200`): `{ "success": true, "message": "Candidate added to team", "team": { ... } }`. The returned team populates `founderId` and `members[].userId` with candidate profile fields (`name`, `profileImage`, college, location, and candidate skills/preferences).

Failure statuses: `400` malformed IDs, `401` missing user profile, `403 FORBIDDEN` user is not the team founder, `404` team/candidate not found, `409` candidate is founder/already a member or no matching accepted invitation exists.

### GET /api/teams/

Purpose: Lists all teams that the currently authenticated user is a founder or member of.

Example successful response shape:

```json
{
  "success": true,
  "teams": [
    {
      "_id": "ObjectId",
      "name": "Campus Launchpad",
      "ideaId": "ObjectId",
      "founderId": { "_id": "ObjectId", "name": "Riya Shah" },
      "members": [
        {
          "userId": { "_id": "ObjectId", "name": "Ava" },
          "role": "Frontend Engineer",
          "invitationId": "ObjectId",
          "joinedAt": "ISO date"
        }
      ],
      "status": "Active",
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  ]
}
```

### GET /api/teams/:teamId

Purpose: Retrieves details of a specific team, including all members and the founder.

Frontend note:

- `GET /api/teams` does not populate `ideaId` with the idea title by default.
- If the UI needs the idea title, it should fetch the idea by its ID from `/api/ideas/:ideaId` using the actual backend data.
- Do not invent a team from invitation data when a real Team record exists.

## 10) Frontend integration notes

The backend is the source of truth for routing and schema. The following must match the backend exactly:

- User profile creation: `POST /api/users/profile`
- Candidate profile creation: `POST /api/users/candidate-profile`
- Sync after authenticate: `POST /api/users/sync`
- Matching: `GET /api/candidates/search/with-scores`
- Invitation endpoints live under `/api/invitations`
- Team endpoints live under `/api/teams`

Any frontend route using `/api/profiles`, `/api/candidates`, `/api/users/candidates/search`, or a different profile payload shape is not aligned with the live implementation.
