const test = require('node:test');
const assert = require('node:assert/strict');

const Team = require('../../models/Team');
const Invitation = require('../../models/Invitation');
const Idea = require('../../models/Idea');
const User = require('../../models/User');
const teamRoutes = require('../../routes/teamRoutes');
const { createTeam, addTeamMember } = require('../../controllers/teamController');

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

const createPopulateQuery = (value) => ({
  populate() {
    return this;
  },
  lean: async () => value,
});

const hasTeamFixture = Boolean(
  process.env.MONGODB_TEST_URI &&
    process.env.MONGODB_TEST_DATABASE_NAME &&
    process.env.FIREBASE_PROJECT_ID,
);

test('team model exposes the V1 one-team-per-idea contract', () => {
  const ideaIndex = Team.schema.indexes().find(([fields, options]) => fields.ideaId === 1 && options.unique);
  const statusEnum = Team.schema.path('status').enumValues;
  const memberExists = Team.schema.path('members') && Team.schema.path('members').instance === 'Array';

  assert.ok(ideaIndex, 'expected a unique ideaId index');
  assert.deepEqual(statusEnum, ['Active', 'Archived']);
  assert.equal(memberExists, true);
});

test('team router exposes the protected team endpoints', () => {
  const routePaths = teamRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path)
    .sort();

  assert.ok(routePaths.includes('/'), 'expected POST /');
  assert.ok(routePaths.includes('/:teamId'), 'expected GET /:teamId');
  assert.ok(routePaths.includes('/'), 'expected GET /');
  assert.ok(routePaths.includes('/:teamId/members'), 'expected POST /:teamId/members');
});

test('team creation creates an empty team without requiring or assigning accepted invitations', async () => {
  const founder = { _id: '507f1f77bcf86cd799439011', profileType: 'founder' };
  const idea = { _id: '507f1f77bcf86cd799439012', createdBy: founder._id };
  const createdTeam = {
    _id: '507f1f77bcf86cd799439013',
    ideaId: idea._id,
    founderId: founder._id,
    name: 'Campus Launchpad',
    members: [],
    status: 'Active',
  };
  const originals = {
    userFindOne: User.findOne,
    ideaFindById: Idea.findById,
    teamExists: Team.exists,
    teamCreate: Team.create,
    teamFindById: Team.findById,
  };
  let createdDocument;

  try {
    User.findOne = async () => founder;
    Idea.findById = () => ({ lean: async () => idea });
    Team.exists = async () => null;
    Team.create = async (document) => {
      createdDocument = document;
      return createdTeam;
    };
    Team.findById = () => createPopulateQuery(createdTeam);

    const res = createMockRes();
    await createTeam(
      {
        user: { uid: 'founder-firebase' },
        body: { ideaId: idea._id, name: 'Campus Launchpad' },
      },
      res,
    );

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.team._id, createdTeam._id);
    assert.equal(createdDocument.founderId, founder._id);
    assert.deepEqual(createdDocument.members, []);
  } finally {
    User.findOne = originals.userFindOne;
    Idea.findById = originals.ideaFindById;
    Team.exists = originals.teamExists;
    Team.create = originals.teamCreate;
    Team.findById = originals.teamFindById;
  }
});

test('adding a candidate requires an accepted invite from this founder for this idea and links it to the team', async () => {
  const founderId = '507f1f77bcf86cd799439011';
  const candidateId = '507f1f77bcf86cd799439012';
  const ideaId = '507f1f77bcf86cd799439013';
  const teamId = '507f1f77bcf86cd799439014';
  const invitationId = '507f1f77bcf86cd799439015';
  const founder = { _id: founderId, profileType: 'founder' };
  const team = { _id: teamId, ideaId, founderId, members: [] };
  const candidate = { _id: candidateId, profileType: 'candidate' };
  const acceptedInvitation = {
    _id: invitationId,
    ideaId,
    fromFounder: founderId,
    toCandidate: candidateId,
    role: 'Backend Developer',
    status: 'Accepted',
  };
  const populatedTeam = {
    ...team,
    members: [{ userId: candidate, role: acceptedInvitation.role, invitationId, joinedAt: new Date() }],
  };
  const originals = {
    userFindOne: User.findOne,
    userFindById: User.findById,
    teamFindById: Team.findById,
    teamFindOneAndUpdate: Team.findOneAndUpdate,
    invitationFindOne: Invitation.findOne,
    invitationUpdateOne: Invitation.updateOne,
  };
  let invitationQuery;
  let teamFilter;
  let invitationLink;

  try {
    User.findOne = async () => founder;
    User.findById = () => ({ lean: async () => candidate });
    Team.findById = () => ({ lean: async () => team });
    Team.findOneAndUpdate = (filter) => {
      teamFilter = filter;
      return createPopulateQuery(populatedTeam);
    };
    Invitation.findOne = (query) => {
      invitationQuery = query;
      return { sort: () => ({ lean: async () => acceptedInvitation }) };
    };
    Invitation.updateOne = async (filter, update) => {
      invitationLink = { filter, update };
      return { matchedCount: 1 };
    };

    const res = createMockRes();
    await addTeamMember(
      {
        user: { uid: 'founder-firebase' },
        params: { teamId },
        body: { candidateId },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.team.members[0].userId._id, candidateId);
    assert.equal(String(invitationQuery.ideaId), ideaId);
    assert.equal(String(invitationQuery.fromFounder), founderId);
    assert.equal(String(invitationQuery.toCandidate), candidateId);
    assert.equal(invitationQuery.status, 'Accepted');
    assert.equal(String(teamFilter._id), teamId);
    assert.equal(String(teamFilter.founderId), founderId);
    assert.equal(invitationLink.filter._id, invitationId);
    assert.equal(String(invitationLink.update.$set.teamId), teamId);
  } finally {
    User.findOne = originals.userFindOne;
    User.findById = originals.userFindById;
    Team.findById = originals.teamFindById;
    Team.findOneAndUpdate = originals.teamFindOneAndUpdate;
    Invitation.findOne = originals.invitationFindOne;
    Invitation.updateOne = originals.invitationUpdateOne;
  }
});

test('live team integration requires explicit MongoDB and Firebase fixtures', { skip: !hasTeamFixture }, async () => {
  assert.fail('Configure the team fixture harness before enabling live team formation assertions.');
});
