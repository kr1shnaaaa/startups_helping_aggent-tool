const test = require('node:test');
const assert = require('node:assert/strict');

const Invitation = require('../../models/Invitation');
const Idea = require('../../models/Idea');
const User = require('../../models/User');
const Match = require('../../models/Match');
const { sendInvitation, listInvitations, withdrawInvitation } = require('../../controllers/invitationController');
const migrateInvitationIndexes = require('../../scripts/migrateInvitationIndexes');

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

test('invitation lifecycle allows a new pending invite after a historical withdrawn record', async () => {
  const founder = { _id: '507f1f77bcf86cd799439011', firebaseUid: 'founder-firebase' };
  const candidate = { _id: '507f1f77bcf86cd799439012', profileType: 'candidate', profileCompleted: true };
  const idea = { _id: '507f1f77bcf86cd799439013', createdBy: '507f1f77bcf86cd799439011', aiAnalysis: { isApproved: true } };
  const match = { _id: '507f1f77bcf86cd799439014', ideaId: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439012', matchScore: 87, explanation: { matchedSkills: ['Node.js'], roleMatches: ['Backend Developer'] }, scoringVersion: 'v1' };

  const originalFindOne = User.findOne;
  const originalIdeaFindById = Idea.findById;
  const originalMatchFindOne = Match.findOne;
  const originalInvitationFind = Invitation.find;
  const originalInvitationCreate = Invitation.create;

  try {
    User.findOne = (filter) => {
      if (filter.firebaseUid) return founder;
      if (filter._id === candidate._id) return { ...candidate, lean: async () => candidate };
      return null;
    };
    Idea.findById = () => ({ lean: async () => idea });
    Match.findOne = () => ({ lean: async () => match });
    Invitation.find = () => ({ sort: () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439015', ideaId: '507f1f77bcf86cd799439013', toCandidate: '507f1f77bcf86cd799439012', status: 'Withdrawn', role: 'Backend Developer' }] }) });
    Invitation.create = async (payload) => ({
      ...payload,
      _id: '507f1f77bcf86cd799439016',
      status: 'Pending',
    });

    const req = {
      user: { uid: 'founder-firebase' },
      body: { ideaId: '507f1f77bcf86cd799439013', candidateId: '507f1f77bcf86cd799439012', role: 'Backend Developer', message: 'Hi there' },
    };
    const res = createMockRes();

    await sendInvitation(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.invitation.status, 'Pending');
    assert.equal(res.body.invitation._id, '507f1f77bcf86cd799439016');
    assert.equal(res.body.invitation.role, 'Backend Developer');
    assert.notEqual(res.body.invitation._id, '507f1f77bcf86cd799439015');
  } finally {
    User.findOne = originalFindOne;
    Idea.findById = originalIdeaFindById;
    Match.findOne = originalMatchFindOne;
    Invitation.find = originalInvitationFind;
    Invitation.create = originalInvitationCreate;
  }
});

const sendWithHistory = async (history, options = {}) => {
  const founderId = options.founderId || '507f1f77bcf86cd799439011';
  const candidateId = options.candidateId || '507f1f77bcf86cd799439012';
  const ideaId = options.ideaId || '507f1f77bcf86cd799439013';
  const matchId = options.matchId || '507f1f77bcf86cd799439014';
  const founder = { _id: founderId, firebaseUid: 'founder-firebase' };
  const candidate = { _id: candidateId, profileType: 'candidate', profileCompleted: true };
  const idea = {
    _id: ideaId,
    createdBy: options.ideaOwner || founderId,
    aiAnalysis: { isApproved: options.approved !== false },
  };
  const match = {
    _id: matchId,
    ideaId,
    userId: candidateId,
    matchScore: 87,
    explanation: { matchedSkills: ['Node.js'], missingSkills: ['GraphQL'], roleMatches: ['Full Stack Developer'] },
    scoringVersion: 'v1',
  };
  const originals = {
    userFindOne: User.findOne,
    ideaFindById: Idea.findById,
    matchFindOne: Match.findOne,
    invitationFind: Invitation.find,
    invitationCreate: Invitation.create,
  };
  const created = [];
  const response = createMockRes();

  try {
    User.findOne = (filter) => {
      if (filter.firebaseUid) return options.unauthenticated ? null : founder;
      if (String(filter._id) === candidateId) return { ...candidate, lean: async () => candidate };
      return null;
    };
    Idea.findById = () => ({ lean: async () => idea });
    Match.findOne = () => ({ lean: async () => match });
    Invitation.find = () => ({ sort: () => ({ lean: async () => history }) });
    Invitation.create = async (payload) => {
      created.push(payload);
      return { ...payload, _id: '507f1f77bcf86cd799439099', status: 'Pending' };
    };

    await sendInvitation(
      {
        user: { uid: 'founder-firebase' },
        body: { ideaId, candidateId, role: 'Full Stack Developer', message: 'A fresh invitation' },
      },
      response,
    );
  } finally {
    User.findOne = originals.userFindOne;
    Idea.findById = originals.ideaFindById;
    Match.findOne = originals.matchFindOne;
    Invitation.find = originals.invitationFind;
    Invitation.create = originals.invitationCreate;
  }

  return { response, created };
};

test('first invitation creates a Pending record with the current match snapshot', async () => {
  const { response, created } = await sendWithHistory([]);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.invitation.status, 'Pending');
  assert.deepEqual(created[0].matchContext, {
    score: 87,
    matchedSkills: ['Node.js'],
    missingSkills: ['GraphQL'],
    scoringVersion: 'v1',
  });
});

test('exact withdrawn database record permits a new Pending invitation and preserves history', async () => {
  const oldInvitation = {
    _id: '6aba8b0ac1520e97f4da4542',
    ideaId: '6aa627e67da526a8d07c77c9',
    fromFounder: '6a9bb29fab47b6b9040c9377',
    toCandidate: '6a9aed3181437f68db1d6e8f',
    role: 'Full Stack Developer',
    status: 'Withdrawn',
    withdrawnAt: '2026-09-28T16:05:48.982Z',
  };
  const { response, created } = await sendWithHistory([oldInvitation], {
    founderId: oldInvitation.fromFounder,
    candidateId: oldInvitation.toCandidate,
    ideaId: oldInvitation.ideaId,
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.invitation.status, 'Pending');
  assert.notEqual(response.body.invitation._id, oldInvitation._id);
  assert.equal(created[0].role, 'Full Stack Developer');
  assert.equal(oldInvitation.status, 'Withdrawn');
  assert.equal(oldInvitation.withdrawnAt, '2026-09-28T16:05:48.982Z');
});

test('existing Accepted invitation blocks a new invitation', async () => {
  const { response, created } = await sendWithHistory([{ status: 'Accepted' }]);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'INVITATION_EXISTS');
  assert.equal(created.length, 0);
});

test('Pending plus Withdrawn history still blocks a duplicate', async () => {
  const { response, created } = await sendWithHistory([
    { _id: 'old-withdrawn', status: 'Withdrawn' },
    { _id: 'active-pending', status: 'Pending' },
  ]);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'INVITATION_EXISTS');
  assert.equal(created.length, 0);
});

test('multiple Withdrawn records do not prevent another invitation', async () => {
  const historical = [
    { _id: 'old-withdrawn-1', status: 'Withdrawn' },
    { _id: 'old-withdrawn-2', status: 'Withdrawn' },
  ];
  const { response, created } = await sendWithHistory(historical);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.invitation.status, 'Pending');
  assert.equal(created.length, 1);
  assert.deepEqual(historical.map(({ status }) => status), ['Withdrawn', 'Withdrawn']);
});

test('Declined invitation retains its block policy with a distinct error code', async () => {
  const { response, created } = await sendWithHistory([{ status: 'Declined' }]);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'INVITATION_DECLINED');
  assert.equal(created.length, 0);
});

test('invitation creation still enforces idea ownership', async () => {
  const { response, created } = await sendWithHistory([], { ideaOwner: '507f1f77bcf86cd799439099' });

  assert.equal(response.statusCode, 403);
  assert.equal(created.length, 0);
});

test('invitation creation still requires an authenticated founder', async () => {
  const { response, created } = await sendWithHistory([], { unauthenticated: true });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'USER_NOT_FOUND');
  assert.equal(created.length, 0);
});

test('duplicate pending invitations are still rejected to avoid active duplicates', async () => {
  const founder = { _id: '507f1f77bcf86cd799439011', firebaseUid: 'founder-firebase' };
  const candidate = { _id: '507f1f77bcf86cd799439012', profileType: 'candidate', profileCompleted: true };
  const idea = { _id: '507f1f77bcf86cd799439013', createdBy: '507f1f77bcf86cd799439011', aiAnalysis: { isApproved: true } };
  const match = { _id: '507f1f77bcf86cd799439014', ideaId: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439012', matchScore: 80, explanation: { matchedSkills: ['Node.js'], roleMatches: ['Backend Developer'] }, scoringVersion: 'v1' };

  const originalFindOne = User.findOne;
  const originalIdeaFindById = Idea.findById;
  const originalMatchFindOne = Match.findOne;
  const originalInvitationFind = Invitation.find;

  try {
    User.findOne = (filter) => {
      if (filter.firebaseUid) return founder;
      if (filter._id === candidate._id) return { ...candidate, lean: async () => candidate };
      return null;
    };
    Idea.findById = () => ({ lean: async () => idea });
    Match.findOne = () => ({ lean: async () => match });
    Invitation.find = () => ({ sort: () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439015', ideaId: '507f1f77bcf86cd799439013', toCandidate: '507f1f77bcf86cd799439012', status: 'Pending' }] }) });

    const req = {
      user: { uid: 'founder-firebase' },
      body: { ideaId: '507f1f77bcf86cd799439013', candidateId: '507f1f77bcf86cd799439012', role: 'Backend Developer', message: 'Hi again' },
    };
    const res = createMockRes();

    await sendInvitation(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'INVITATION_EXISTS');
  } finally {
    User.findOne = originalFindOne;
    Idea.findById = originalIdeaFindById;
    Match.findOne = originalMatchFindOne;
    Invitation.find = originalInvitationFind;
  }
});

test('approved ideas stay approved even when an invitation is withdrawn', async () => {
  const founder = { _id: '507f1f77bcf86cd799439011', firebaseUid: 'founder-firebase' };
  const candidate = { _id: '507f1f77bcf86cd799439012', profileType: 'candidate', profileCompleted: true };
  const idea = { _id: '507f1f77bcf86cd799439013', createdBy: '507f1f77bcf86cd799439011', aiAnalysis: { isApproved: true }, status: 'matching' };
  const invitation = { _id: '507f1f77bcf86cd799439014', status: 'Pending', fromFounder: '507f1f77bcf86cd799439011', toCandidate: '507f1f77bcf86cd799439012' };

  const originalUserFindOne = User.findOne;
  const originalInvitationFindOne = Invitation.findOne;
  const originalInvitationFindOneAndUpdate = Invitation.findOneAndUpdate;

  try {
    User.findOne = (filter) => {
      if (filter.firebaseUid) return founder;
      return null;
    };
    Invitation.findOne = () => ({ ...invitation, lean: async () => invitation });
    Invitation.findOneAndUpdate = (query, update, options) => ({
      ...invitation,
      ...update.$set,
      _id: invitation._id,
      lean: async () => ({...invitation, ...update.$set, _id: invitation._id}),
    });

    const req = {
      user: { uid: 'founder-firebase' },
      params: { invitationId: '507f1f77bcf86cd799439014' },
    };
    const res = createMockRes();

    await withdrawInvitation(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.invitation.status, 'Withdrawn');
    assert.equal(idea.aiAnalysis.isApproved, true);
    assert.equal(idea.status, 'matching');
  } finally {
    User.findOne = originalUserFindOne;
    Invitation.findOne = originalInvitationFindOne;
    Invitation.findOneAndUpdate = originalInvitationFindOneAndUpdate;
  }
});

test('candidate received-invitations query returns the new Pending invitation', async () => {
  const candidate = { _id: '507f1f77bcf86cd799439012' };
  const newInvitation = { _id: '507f1f77bcf86cd799439099', toCandidate: candidate._id, status: 'Pending' };
  const originalUserFindOne = User.findOne;
  const originalInvitationFind = Invitation.find;
  const res = createMockRes();

  try {
    User.findOne = () => candidate;
    Invitation.find = (query) => ({
      populate: () => ({
        sort: () => ({
          lean: async () => {
            assert.equal(query.toCandidate, candidate._id);
            assert.equal(query.status, 'Pending');
            return [newInvitation];
          },
        }),
      }),
    });

    await listInvitations(
      { user: { uid: 'candidate-firebase' }, query: { direction: 'received', status: 'Pending' } },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.invitations, [newInvitation]);
  } finally {
    User.findOne = originalUserFindOne;
    Invitation.find = originalInvitationFind;
  }
});

test('startup index migration replaces legacy uniqueness without deleting records', async () => {
  const dropped = [];
  let indexesCreated = false;
  const collection = {
    aggregate: () => ({ next: async () => null }),
    indexes: async () => [
      { name: '_id_', key: { _id: 1 }, unique: true },
      { name: 'ideaId_1_toCandidate_1_createdAt_1', key: { ideaId: 1, toCandidate: 1, createdAt: -1 } },
      { name: 'ideaId_1_toCandidate_1', key: { ideaId: 1, toCandidate: 1 }, unique: true },
      { name: 'ideaId_1_status_1_toCandidate_1', key: { ideaId: 1, status: 1, toCandidate: 1 }, unique: true },
    ],
    dropIndex: async (name) => dropped.push(name),
  };

  await migrateInvitationIndexes({ collection, createIndexes: async () => { indexesCreated = true; } });

  assert.deepEqual(dropped, ['ideaId_1_toCandidate_1', 'ideaId_1_status_1_toCandidate_1']);
  assert.equal(indexesCreated, true);
});

test('startup index migration refuses to proceed with multiple active invitations', async () => {
  let indexesRead = false;
  let indexesCreated = false;
  const collection = {
    aggregate: () => ({ next: async () => ({ _id: { ideaId: 'idea', toCandidate: 'candidate' } }) }),
    indexes: async () => { indexesRead = true; return []; },
  };

  await assert.rejects(
    migrateInvitationIndexes({ collection, createIndexes: async () => { indexesCreated = true; } }),
    /multiple active invitations/,
  );
  assert.equal(indexesRead, false);
  assert.equal(indexesCreated, false);
});

test('startup index migration creates indexes when the invitations collection is new', async () => {
  let indexesCreated = false;
  const namespaceError = Object.assign(new Error('namespace not found'), { code: 26 });
  const collection = {
    aggregate: () => ({ next: async () => { throw namespaceError; } }),
    indexes: async () => { throw namespaceError; },
  };

  await migrateInvitationIndexes({ collection, createIndexes: async () => { indexesCreated = true; } });

  assert.equal(indexesCreated, true);
});

test('invitation schema uniquely indexes only active idea/candidate pairs', () => {
  const indexes = Invitation.schema.indexes();
  const activePairUnique = indexes.find(([fields, options]) => {
    if (!fields || typeof fields !== 'object') return false;
    return fields.ideaId === 1 && fields.toCandidate === 1 && options?.unique === true;
  });

  assert.deepEqual(activePairUnique?.[1].partialFilterExpression, {
    status: { $in: ['Pending', 'Accepted'] },
  });
  assert.equal(
    indexes.some(([fields, options]) => fields.ideaId === 1 && fields.toCandidate === 1 && fields.status === 1 && options.unique),
    false,
  );
});

test('unapproved ideas still return the approval error for matching/invitation creation', async () => {
  const founder = { _id: '507f1f77bcf86cd799439011', firebaseUid: 'founder-firebase' };
  const candidate = { _id: '507f1f77bcf86cd799439012', profileType: 'candidate', profileCompleted: true };
  const idea = { _id: '507f1f77bcf86cd799439013', createdBy: '507f1f77bcf86cd799439011', aiAnalysis: { isApproved: false } };

  const originalFindOne = User.findOne;
  const originalIdeaFindById = Idea.findById;
  const originalMatchFindOne = Match.findOne;

  try {
    User.findOne = (filter) => {
      if (filter.firebaseUid) return founder;
      if (filter._id === candidate._id) return { ...candidate, lean: async () => candidate };
      return null;
    };
    Idea.findById = () => ({ lean: async () => idea });
    Match.findOne = () => ({ lean: async () => ({ _id: '507f1f77bcf86cd799439014', ideaId: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439012' }) });

    const req = {
      user: { uid: 'founder-firebase' },
      body: { ideaId: '507f1f77bcf86cd799439013', candidateId: '507f1f77bcf86cd799439012', role: 'Backend Developer', message: 'Hi there' },
    };
    const res = createMockRes();

    await sendInvitation(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'ANALYSIS_NOT_APPROVED');
  } finally {
    User.findOne = originalFindOne;
    Idea.findById = originalIdeaFindById;
    Match.findOne = originalMatchFindOne;
  }
});
