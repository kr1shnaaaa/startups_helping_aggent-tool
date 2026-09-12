const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const dns = require('node:dns');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();
dns.setServers(['1.1.1.1', '1.0.0.1']);

const mongoUri = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_TEST_DATABASE_NAME || process.env.MONGODB_DATABASE_NAME || 'startuplink';
const integrationReady = Boolean(mongoUri && process.env.FIREBASE_PROJECT_ID);

const skipReason =
  'Set MONGODB_TEST_URI (or MONGODB_URI) and Firebase Admin env to run database-backed matching integration tests.';

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const requestWithoutAuth = (app, path) =>
  new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method: 'GET',
        },
        (response) => {
          let raw = '';
          response.on('data', (chunk) => {
            raw += chunk;
          });
          response.on('end', () => {
            server.close();
            resolve({ statusCode: response.statusCode, body: raw });
          });
        },
      );
      req.on('error', (error) => {
        server.close();
        reject(error);
      });
      req.end();
    });
  });

test('matching with-scores returns 401 without authentication', async () => {
  const app = require('../../app');
  const response = await requestWithoutAuth(app, '/api/candidates/search/with-scores?ideaId=507f1f77bcf86cd799439011');
  assert.equal(response.statusCode, 401);
});

test(
  'matching integration covers authz, filters, pagination, privacy, and upsert refresh',
  { skip: integrationReady ? false : skipReason },
  async (t) => {
    const User = require('../../models/User');
    const Idea = require('../../models/Idea');
    const Match = require('../../models/Match');
    const Invitation = require('../../models/Invitation');
    const Team = require('../../models/Team');
    const { searchMatches, getCandidateMatch } = require('../../controllers/matchingController');

    await mongoose.connect(mongoUri.trim(), {
      dbName: mongoDbName,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const fixtureIds = {
      users: [],
      ideas: [],
      matches: [],
      invitations: [],
      teams: [],
    };

    t.after(async () => {
      if (fixtureIds.matches.length) await Match.deleteMany({ _id: { $in: fixtureIds.matches } });
      if (fixtureIds.invitations.length) await Invitation.deleteMany({ _id: { $in: fixtureIds.invitations } });
      if (fixtureIds.teams.length) await Team.deleteMany({ _id: { $in: fixtureIds.teams } });
      if (fixtureIds.ideas.length) await Idea.deleteMany({ _id: { $in: fixtureIds.ideas } });
      if (fixtureIds.users.length) await User.deleteMany({ _id: { $in: fixtureIds.users } });
      await Match.deleteMany({ ideaId: { $in: fixtureIds.ideas } });
      await mongoose.disconnect();
    });

    const founder = await User.create({
      firebaseUid: `test-founder-${suffix}`,
      email: `founder-${suffix}@example.com`,
      name: 'Test Founder',
      profileType: 'founder',
      profileCompleted: true,
      bio: 'Building StartupLink',
    });
    fixtureIds.users.push(founder._id);

    const otherFounder = await User.create({
      firebaseUid: `test-other-founder-${suffix}`,
      email: `other-founder-${suffix}@example.com`,
      name: 'Other Founder',
      profileType: 'founder',
      profileCompleted: true,
      bio: 'Other idea',
    });
    fixtureIds.users.push(otherFounder._id);

    const approvedIdea = await Idea.create({
      createdBy: founder._id,
      title: 'Approved Matching Idea',
      description: 'A long enough description for an approved matching idea fixture.',
      domain: 'EdTech',
      status: 'matching',
      aiAnalysis: {
        isApproved: true,
        domain: 'EdTech',
        rolesAndSkills: [
          {
            role: 'Backend Developer',
            skills: ['Node.js', 'MongoDB'],
            experienceLevel: 'Intermediate',
            priority: 'must-have',
          },
        ],
      },
    });
    fixtureIds.ideas.push(approvedIdea._id);

    const unapprovedIdea = await Idea.create({
      createdBy: founder._id,
      title: 'Unapproved Idea',
      description: 'A long enough description for an unapproved matching idea fixture.',
      domain: 'EdTech',
      status: 'analyzed',
      aiAnalysis: {
        isApproved: false,
        rolesAndSkills: [{ role: 'Backend Developer', skills: ['Node.js'], experienceLevel: 'Beginner' }],
      },
    });
    fixtureIds.ideas.push(unapprovedIdea._id);

    const foreignIdea = await Idea.create({
      createdBy: otherFounder._id,
      title: 'Foreign Idea',
      description: 'A long enough description for a non-owned matching idea fixture.',
      domain: 'EdTech',
      status: 'matching',
      aiAnalysis: {
        isApproved: true,
        rolesAndSkills: [{ role: 'Backend Developer', skills: ['Node.js'], experienceLevel: 'Beginner' }],
      },
    });
    fixtureIds.ideas.push(foreignIdea._id);

    const strongCandidate = await User.create({
      firebaseUid: `test-candidate-strong-${suffix}`,
      email: `strong-${suffix}@example.com`,
      name: 'Strong Candidate',
      profileType: 'candidate',
      profileCompleted: true,
      skills: [
        { name: 'Node.js', level: 'Advanced' },
        { name: 'MongoDB', level: 'Intermediate' },
      ],
      targetRoles: ['Backend Developer'],
      domainInterests: ['EdTech'],
      availability: 'part-time',
      workPreference: 'hybrid',
      hoursPerWeek: 20,
    });
    fixtureIds.users.push(strongCandidate._id);

    const partialCandidate = await User.create({
      firebaseUid: `test-candidate-partial-${suffix}`,
      email: `partial-${suffix}@example.com`,
      name: 'Partial Candidate',
      profileType: 'candidate',
      profileCompleted: true,
      skills: [{ name: 'Node.js', level: 'Beginner' }],
      targetRoles: ['Frontend Developer'],
      domainInterests: ['FinTech'],
      availability: 'full-time',
      workPreference: 'remote',
      hoursPerWeek: 40,
    });
    fixtureIds.users.push(partialCandidate._id);

    const incompleteCandidate = await User.create({
      firebaseUid: `test-candidate-incomplete-${suffix}`,
      email: `incomplete-${suffix}@example.com`,
      name: 'Incomplete Candidate',
      profileType: 'candidate',
      profileCompleted: false,
      skills: [
        { name: 'Node.js', level: 'Advanced' },
        { name: 'MongoDB', level: 'Advanced' },
      ],
      targetRoles: ['Backend Developer'],
      domainInterests: ['EdTech'],
    });
    fixtureIds.users.push(incompleteCandidate._id);

    const authReq = (uid, query = {}) => ({
      user: { uid },
      query,
      params: {},
    });

    {
      const res = createMockRes();
      await searchMatches(authReq(founder.firebaseUid, { ideaId: 'not-an-id' }), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.code, 'INVALID_ID');
    }

    {
      const res = createMockRes();
      await searchMatches(authReq(founder.firebaseUid, { ideaId: foreignIdea._id.toString() }), res);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'NOT_OWNER');
    }

    {
      const res = createMockRes();
      await searchMatches(authReq(founder.firebaseUid, { ideaId: unapprovedIdea._id.toString() }), res);
      assert.equal(res.statusCode, 409);
      assert.equal(res.body.code, 'ANALYSIS_NOT_APPROVED');
    }

    {
      const res = createMockRes();
      await searchMatches(authReq(founder.firebaseUid, { ideaId: approvedIdea._id.toString() }), res);
      assert.equal(res.statusCode, 200);
      assert.ok(res.body.matches.every((match) => String(match.candidate.id) !== String(founder._id)));
    }

    {
      const res = createMockRes();
      await searchMatches(
        authReq(founder.firebaseUid, {
          ideaId: approvedIdea._id.toString(),
          skills: 'Node.js,MongoDB',
          minScore: '40',
        }),
        res,
      );
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.minScore, 40);
      assert.ok(res.body.matches.length >= 1);
      assert.ok(res.body.matches.every((match) => match.score >= 40));
      assert.ok(res.body.matches.every((match) => match.candidate.id));
      assert.ok(res.body.matches.every((match) => !Object.hasOwn(match.candidate, 'email')));
      assert.ok(res.body.matches.every((match) => !Object.hasOwn(match.candidate, 'firebaseUid')));
      assert.ok(!res.body.matches.some((match) => String(match.candidate.id) === String(incompleteCandidate._id)));
      assert.ok(res.body.matches.some((match) => String(match.candidate.id) === String(strongCandidate._id)));
      assert.equal(res.body.matches[0].invitationStatus, null);
      assert.equal(res.body.matches[0].explanation.scoringVersion, 'v1');
      assert.ok(res.body.pagination);
      assert.equal(res.body.pagination.page, 1);
    }

    {
      const invitation = await Invitation.create({
        ideaId: approvedIdea._id,
        fromFounder: founder._id,
        toCandidate: partialCandidate._id,
        role: 'Backend Developer',
        matchContext: {
          score: 50,
          matchedSkills: ['Node.js'],
          missingSkills: ['MongoDB'],
          scoringVersion: 'v1',
        },
        status: 'Pending',
      });
      fixtureIds.invitations.push(invitation._id);

      const team = await Team.create({
        ideaId: approvedIdea._id,
        founderId: founder._id,
        name: 'Approved Matching Team',
        members: [{ userId: strongCandidate._id, role: 'Backend Developer', invitationId: invitation._id }],
      });
      fixtureIds.teams.push(team._id);

      const res = createMockRes();
      await searchMatches(
        authReq(founder.firebaseUid, {
          ideaId: approvedIdea._id.toString(),
          minScore: '0',
        }),
        res,
      );
      assert.equal(res.statusCode, 200);
      const strongMatch = res.body.matches.find((match) => String(match.candidate.id) === String(strongCandidate._id));
      const partialMatch = res.body.matches.find((match) => String(match.candidate.id) === String(partialCandidate._id));
      assert.equal(strongMatch.invitationStatus, 'Team Member');
      assert.equal(strongMatch.teamId.toString(), team._id.toString());
      assert.equal(partialMatch.invitationStatus, 'Pending');
      assert.equal(partialMatch.invitationId.toString(), invitation._id.toString());
    }

    {
      const res = createMockRes();
      await searchMatches(
        authReq(founder.firebaseUid, {
          ideaId: approvedIdea._id.toString(),
          skills: 'Node.js,MongoDB',
          level: 'Advanced',
        }),
        res,
      );
      assert.equal(res.statusCode, 200);
      assert.ok(res.body.matches.every((match) => String(match.candidate.id) !== String(partialCandidate._id)));
    }

    {
      const first = createMockRes();
      await searchMatches(
        authReq(founder.firebaseUid, {
          ideaId: approvedIdea._id.toString(),
          minScore: '0',
          page: '1',
          limit: '1',
        }),
        first,
      );
      assert.equal(first.statusCode, 200);
      assert.equal(first.body.matches.length, 1);
      assert.ok(first.body.pagination.total >= 1);
      assert.ok(first.body.pagination.totalPages >= 1);

      const scores = first.body.matches.map((match) => match.score);
      assert.deepEqual(scores, [...scores].sort((a, b) => b - a));

      const stored = await Match.find({ ideaId: approvedIdea._id, userId: strongCandidate._id });
      assert.equal(stored.length, 1);
      fixtureIds.matches.push(stored[0]._id);
      const firstRefreshedAt = stored[0].refreshedAt;

      await new Promise((resolve) => setTimeout(resolve, 20));

      const second = createMockRes();
      await searchMatches(
        authReq(founder.firebaseUid, {
          ideaId: approvedIdea._id.toString(),
          minScore: '0',
        }),
        second,
      );
      assert.equal(second.statusCode, 200);

      const refreshed = await Match.find({ ideaId: approvedIdea._id, userId: strongCandidate._id });
      assert.equal(refreshed.length, 1);
      assert.ok(new Date(refreshed[0].refreshedAt) >= new Date(firstRefreshedAt));
      assert.equal(refreshed[0].scoringVersion, 'v1');
      assert.ok(refreshed[0].explanation);
      assert.ok(refreshed[0].requirementsSnapshot);
    }

    {
      const res = createMockRes();
      await getCandidateMatch(
        {
          user: { uid: strongCandidate.firebaseUid },
          params: { ideaId: approvedIdea._id.toString() },
          query: {},
        },
        res,
      );
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(String(res.body.match.ideaId), String(approvedIdea._id));
      assert.ok(res.body.match.explanation);
      assert.ok(!Object.hasOwn(res.body.match, 'email'));
      assert.ok(!Object.hasOwn(res.body.match, 'firebaseUid'));
    }

    {
      const res = createMockRes();
      await getCandidateMatch(
        {
          user: { uid: strongCandidate.firebaseUid },
          params: { ideaId: unapprovedIdea._id.toString() },
          query: {},
        },
        res,
      );
      assert.equal(res.statusCode, 409);
      assert.equal(res.body.code, 'ANALYSIS_NOT_APPROVED');
    }

    {
      // Verify getCandidateMatch dynamically creates snapshot when no Match exists yet
      await Match.deleteMany({ ideaId: approvedIdea._id, userId: partialCandidate._id });
      const res = createMockRes();
      await getCandidateMatch(
        {
          user: { uid: partialCandidate.firebaseUid },
          params: { ideaId: approvedIdea._id.toString() },
          query: {},
        },
        res,
      );
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(String(res.body.match.ideaId), String(approvedIdea._id));
      assert.ok(res.body.match.explanation);
    }
  },
);

