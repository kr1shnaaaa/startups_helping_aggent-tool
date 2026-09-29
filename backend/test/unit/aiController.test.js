const test = require('node:test');
const assert = require('node:assert/strict');

const User = require('../../models/User');
const Idea = require('../../models/Idea');
const ai = require('../../config/vercelAI');
const Match = require('../../models/Match');
const {
  enhanceIdea,
  analyzeIdea,
  updateAnalysis,
  generateInvitationMessage,
} = require('../../controllers/aiController');
const { updateIdea } = require('../../controllers/ideaController');

const owner = { _id: 'owner-id', firebaseUid: 'owner-uid' };
const otherUser = { _id: 'other-id', firebaseUid: 'other-uid' };

const enhancedOutput = {
  enhancedTitle: 'Refined Campus Marketplace',
  refinedDescription: 'A clear marketplace that connects campus sellers with students who need affordable goods.',
  problem: 'Students struggle to find affordable second-hand goods locally.',
  solution: 'A verified campus marketplace.',
  targetAudience: 'College students',
  valueProposition: 'Trusted local student exchange.',
  coreWorkflow: 'Students list, discover, and arrange exchanges.',
};

const analysisOutput = {
  evidence: {
    problem: { clearlyDefined: true, frequency: 'high', severity: 'medium', explanation: 'Clear recurring need.' },
    audience: { clearlyDefined: true, primaryAudience: 'Students', secondaryAudience: 'Campus groups', accessibility: 'high' },
    market: { reach: 'medium', monetizable: true, explanation: 'Campus network effect.' },
    feasibility: { technicalComplexity: 'medium', resourceRequirement: 'low', mvpFeasibility: 'high', explanation: 'Standard marketplace MVP.' },
    differentiation: { similarSolutionsKnown: true, hasUniqueValue: true, differentiationStrength: 'medium', explanation: 'Campus verification.' },
    monetization: { possible: true, models: ['transaction fee'], explanation: 'Marketplace fee.' },
    execution: { ideaClarity: 'high', scopeClarity: 'medium' },
    limits: { assumptions: ['Students use app'], risks: ['Low liquidity'], limitations: ['No market research'] },
  },
  rolesAndSkills: [{ role: 'Frontend Developer', skills: ['ReactJS'], priority: 'must-have', count: 1, experienceLevel: 'Intermediate' }],
  techStack: ['React.js', 'NodeJS'],
  domain: 'Marketplace',
  teamSize: 2,
  keyRequirements: ['Campus verification'],
  nextSteps: ['Validate with student interviews'],
};

function response() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function createIdea(overrides = {}) {
  return {
    _id: 'idea-id',
    createdBy: owner._id,
    title: 'Raw Campus Marketplace',
    description: 'A campus marketplace where students can buy and sell useful second-hand goods locally.',
    status: 'draft',
    category: 'Marketplace',
    domain: 'Marketplace',
    requiredSkills: ['React'],
    original: undefined,
    enhanced: undefined,
    aiAnalysis: undefined,
    save: async function save() { return this; },
    ...overrides,
  };
}

function mockDatabase(idea, user = owner) {
  const originalFindOne = User.findOne;
  const originalFindById = Idea.findById;
  User.findOne = async () => user;
  Idea.findById = async () => idea;
  return () => {
    User.findOne = originalFindOne;
    Idea.findById = originalFindById;
  };
}

test('enhance endpoint persists enhanced version and preserves original idea', async () => {
  const idea = createIdea();
  const restore = mockDatabase(idea);
  const originalGenerate = ai.generateEnhancement;
  ai.generateEnhancement = async () => enhancedOutput;

  try {
    const res = response();
    await enhanceIdea({ user: { uid: owner.firebaseUid }, params: { ideaId: idea._id }, body: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(idea.original.title, 'Raw Campus Marketplace');
    assert.equal(idea.original.description.startsWith('A campus marketplace'), true);
    assert.equal(idea.enhanced.title, enhancedOutput.enhancedTitle);
    assert.equal(idea.status, 'enhanced');
  } finally {
    ai.generateEnhancement = originalGenerate;
    restore();
  }
});

test('enhance endpoint rejects non-owner', async () => {
  const idea = createIdea({ createdBy: otherUser._id });
  const restore = mockDatabase(idea);
  try {
    const res = response();
    await enhanceIdea({ user: { uid: owner.firebaseUid }, params: { ideaId: idea._id }, body: {} }, res);
    assert.equal(res.statusCode, 403);
  } finally {
    restore();
  }
});

test('idea update persists enhanced concept edits for the founder flow', async () => {
  const idea = createIdea({ status: 'enhanced' });
  const restore = mockDatabase(idea);
  const originalFindByIdAndUpdate = Idea.findByIdAndUpdate;
  const enhancedEdit = {
    title: 'Updated enhanced title',
    description: 'Updated enhanced description with enough detail for analysis.',
    problem: 'The original problem statement is clearer after founder review.',
    solution: 'The founder fixes the concept during review before analysis.',
    targetAudience: 'Startup founders',
    valueProposition: 'Faster refinement before team formation.',
    coreWorkflow: 'Review, refine, analyze, approve.',
  };

  Idea.findByIdAndUpdate = async (_id, updates) => {
    Object.assign(idea, updates);
    return idea;
  };

  try {
    const res = response();
    await updateIdea({
      user: { uid: owner.firebaseUid },
      params: { ideaId: idea._id },
      body: { enhanced: enhancedEdit },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(idea.enhanced.title, enhancedEdit.title);
    assert.equal(idea.enhanced.description, enhancedEdit.description);
    assert.equal(idea.enhanced.targetAudience, enhancedEdit.targetAudience);
  } finally {
    Idea.findByIdAndUpdate = originalFindByIdAndUpdate;
    restore();
  }
});

test('analyze endpoint persists evidence, normalized skills, deterministic scoring, and analyzes enhanced text', async () => {
  const idea = createIdea({ enhanced: { title: 'Final Enhanced Title', description: enhancedOutput.refinedDescription } });
  const restore = mockDatabase(idea);
  const originalGenerate = ai.generateAnalysis;
  let receivedInput;
  ai.generateAnalysis = async (input) => {
    receivedInput = input;
    return analysisOutput;
  };

  try {
    const res = response();
    await analyzeIdea({ user: { uid: owner.firebaseUid }, params: { ideaId: idea._id } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(receivedInput.title, 'Final Enhanced Title');
    assert.equal(idea.status, 'analyzed');
    assert.equal(idea.aiAnalysis.scoring.version, 'v1');
    assert.equal(idea.aiAnalysis.rolesAndSkills[0].skills[0], 'React');
    assert.equal(idea.aiAnalysis.techStack[0], 'React');
  } finally {
    ai.generateAnalysis = originalGenerate;
    restore();
  }
});

test('approve analysis transitions an owned analyzed idea to matching', async () => {
  const idea = createIdea({
    status: 'analyzed',
    aiAnalysis: { rolesAndSkills: [], techStack: [], isApproved: false, isEdited: false },
  });
  const restore = mockDatabase(idea);
  try {
    const res = response();
    await updateAnalysis({ user: { uid: owner.firebaseUid }, params: { ideaId: idea._id }, body: { approve: true } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(idea.status, 'matching');
    assert.equal(idea.aiAnalysis.isApproved, true);
    assert.ok(idea.aiAnalysis.approvedAt instanceof Date);
  } finally {
    restore();
  }
});

test('updating raw idea preserves enhanced and aiAnalysis data', async () => {
  const idea = createIdea({
    title: 'Original Raw Title',
    description: 'Original raw description that is at least 20 characters long.',
    status: 'enhanced',
    enhanced: {
      title: 'Preserved Enhanced Title',
      description: 'Preserved enhanced description with lots of rich detail.',
    },
    aiAnalysis: {
      scoring: { overallScore: 85, verdict: 'STRONG_POTENTIAL' },
      isApproved: true,
    },
  });

  const restore = mockDatabase(idea);
  const originalFindByIdAndUpdate = Idea.findByIdAndUpdate;

  Idea.findByIdAndUpdate = async (_id, updates) => {
    Object.assign(idea, updates);
    return idea;
  };

  try {
    const res = response();
    await updateIdea(
      {
        user: { uid: owner.firebaseUid },
        params: { ideaId: idea._id },
        body: {
          title: 'Updated Raw Title',
          description: 'Updated raw description that is also at least 20 characters long.',
        },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(idea.title, 'Updated Raw Title');
    assert.equal(idea.enhanced.title, 'Preserved Enhanced Title');
    assert.equal(idea.aiAnalysis.scoring.overallScore, 85);
  } finally {
    Idea.findByIdAndUpdate = originalFindByIdAndUpdate;
    restore();
  }
});

test('saving enhanced idea advances status to enhanced and preserves raw and aiAnalysis', async () => {
  const idea = createIdea({
    title: 'Raw Title',
    description: 'Raw description that is at least 20 characters long.',
    status: 'draft',
    aiAnalysis: {
      scoring: { overallScore: 78, verdict: 'PROMISING' },
    },
  });

  const restore = mockDatabase(idea);
  const originalFindByIdAndUpdate = Idea.findByIdAndUpdate;

  Idea.findByIdAndUpdate = async (_id, updates) => {
    Object.assign(idea, updates);
    return idea;
  };

  try {
    const res = response();
    await updateIdea(
      {
        user: { uid: owner.firebaseUid },
        params: { ideaId: idea._id },
        body: {
          enhanced: {
            title: 'New Enhanced Title',
            description: 'New refined description with minimum length requirement.',
            problem: 'Defined problem',
          },
        },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(idea.status, 'enhanced');
    assert.equal(idea.title, 'Raw Title');
    assert.equal(idea.enhanced.title, 'New Enhanced Title');
    assert.equal(idea.aiAnalysis.scoring.overallScore, 78);
  } finally {
    Idea.findByIdAndUpdate = originalFindByIdAndUpdate;
    restore();
  }
});

test('invitation AI endpoint forwards each supported action and verified context', async () => {
  const idea = createIdea({
    _id: '507f1f77bcf86cd799439011',
    aiAnalysis: {
      isApproved: true,
      rolesAndSkills: [{ role: 'Frontend Developer', skills: ['React'] }],
    },
    enhanced: {
      title: 'Enhanced Campus Marketplace',
      description: 'A refined marketplace for local campus exchanges.',
      problem: 'Students struggle to find useful goods nearby.',
      solution: 'A verified local exchange for students.',
      targetAudience: 'College students',
    },
  });
  const candidate = {
    _id: '507f1f77bcf86cd799439012',
    name: 'Candidate User',
    profileType: 'candidate',
    profileCompleted: true,
    skills: [{ name: 'React', level: 'Advanced' }],
  };
  const restoreUserFindOne = User.findOne;
  const restoreIdeaFindById = Idea.findById;
  const restoreMatchFindOne = Match.findOne;
  const restoreGenerator = ai.generateInvitationMessage;
  const calls = [];

  User.findOne = async (query) => (query.firebaseUid ? owner : candidate);
  Idea.findById = async () => idea;
  Match.findOne = async () => ({
    explanation: {
      roleMatches: ['Frontend Developer'],
      matchedSkills: ['React'],
      missingSkills: [],
    },
    matchScore: 88,
  });
  ai.generateInvitationMessage = async (input) => {
    calls.push(input);
    return `generated ${input.action}`;
  };

  try {
    for (const action of ['personalize', 'enhance', 'summarize']) {
      const res = response();
      await generateInvitationMessage({
        user: { uid: owner.firebaseUid },
        body: {
          ideaId: idea._id,
          candidateId: candidate._id,
          role: 'Frontend Developer',
          action,
          draft: action === 'enhance' ? 'Founder draft.' : '',
        },
      }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.message, `generated ${action}`);
    }

    assert.deepEqual(calls.map((call) => call.action), ['personalize', 'enhance', 'summarize']);
    assert.equal(calls[0].ideaTitle, 'Enhanced Campus Marketplace');
    assert.deepEqual(calls[0].candidateSkills, ['React']);
    assert.equal(calls[1].draft, 'Founder draft.');
    assert.equal(calls[2].ideaProblem, 'Students struggle to find useful goods nearby.');
  } finally {
    User.findOne = restoreUserFindOne;
    Idea.findById = restoreIdeaFindById;
    Match.findOne = restoreMatchFindOne;
    ai.generateInvitationMessage = restoreGenerator;
  }
});

test('invitation AI endpoint rejects unsupported actions and missing enhancement drafts', async () => {
  const restoreUserFindOne = User.findOne;
  User.findOne = async () => owner;

  try {
    const invalidAction = response();
    await generateInvitationMessage({
      user: { uid: owner.firebaseUid },
      body: { ideaId: '507f1f77bcf86cd799439011', candidateId: '507f1f77bcf86cd799439012', role: 'Frontend Developer', action: 'bulk' },
    }, invalidAction);
    assert.equal(invalidAction.statusCode, 400);

    const missingDraft = response();
    await generateInvitationMessage({
      user: { uid: owner.firebaseUid },
      body: { ideaId: '507f1f77bcf86cd799439011', candidateId: '507f1f77bcf86cd799439012', role: 'Frontend Developer', action: 'enhance' },
    }, missingDraft);
    assert.equal(missingDraft.statusCode, 400);
  } finally {
    User.findOne = restoreUserFindOne;
  }
});
