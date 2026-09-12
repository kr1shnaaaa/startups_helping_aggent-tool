const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreCandidate } = require('../../services/matchScoring');

const baseRequirements = {
  domain: 'EdTech',
  availability: 'part-time',
  workPreference: 'hybrid',
  hoursPerWeek: 10,
  rolesAndSkills: [
    { role: 'Backend Developer', skills: ['Node.js', 'MongoDB'], experienceLevel: 'Intermediate', priority: 'must-have' },
    { role: 'Frontend Developer', skills: ['React'], experienceLevel: 'Beginner', priority: 'must-have' },
    { role: 'UI/UX Designer', skills: ['Figma'], experienceLevel: 'Beginner', priority: 'nice-to-have' },
  ],
};

test('scores an exact compatible candidate at 100 with explanation', () => {
  const result = scoreCandidate({
    skills: [
      { name: 'Node.js', level: 'Advanced' },
      { name: 'MongoDB', level: 'Intermediate' },
      { name: 'React', level: 'Advanced' },
      { name: 'Figma', level: 'Beginner' },
    ],
    targetRoles: ['Backend Developer', 'Frontend Developer'],
    domainInterests: ['EdTech'],
    availability: 'part-time',
    workPreference: 'hybrid',
    hoursPerWeek: 20,
  }, baseRequirements);
  assert.equal(result.score, 100);
  assert.deepEqual(result.matchedSkills, ['Node.js', 'MongoDB', 'React']);
  assert.deepEqual(result.missingSkills, []);
  assert.deepEqual(result.niceToHaveSkills, ['Figma']);
  assert.equal(result.scoringVersion, 'v1');
});

test('normalizes duplicate and case-variant skills and rounds final score', () => {
  const result = scoreCandidate({
    skills: [{ name: ' node.js ', level: 'Intermediate' }, { name: 'NODE.JS', level: 'Advanced' }],
    targetRoles: ['Backend Developer'],
    domainInterests: [],
  }, { rolesAndSkills: [{ role: 'Backend Developer', skills: ['Node.js', 'MongoDB'], experienceLevel: 'Advanced' }] });
  assert.equal(result.matchedSkills.length, 1);
  assert.deepEqual(result.missingSkills, ['MongoDB']);
  assert.equal(result.score, 72.5);
});

test('matches skill taxonomy aliases such as ReactJS to React', () => {
  const result = scoreCandidate({
    skills: [{ name: 'ReactJS', level: 'Advanced' }, { name: 'NodeJS', level: 'Intermediate' }],
    targetRoles: ['Full Stack Developer'],
    domainInterests: ['SaaS'],
    availability: 'part-time',
    workPreference: 'hybrid',
    hoursPerWeek: 20,
  }, {
    domain: 'SaaS',
    availability: 'part-time',
    workPreference: 'hybrid',
    hoursPerWeek: 10,
    rolesAndSkills: [{ role: 'Full Stack Developer', skills: ['React', 'Node.js'], experienceLevel: 'Intermediate' }],
  });
  assert.deepEqual(result.matchedSkills, ['React', 'Node.js']);
  assert.deepEqual(result.missingSkills, []);
  assert.equal(result.score, 100);
});

test('provides a human-readable recommendation reason', () => {
  const result = scoreCandidate({
    skills: [{ name: 'React', level: 'Advanced' }, { name: 'Node.js', level: 'Intermediate' }],
    targetRoles: ['Full Stack Developer'],
    domainInterests: ['SaaS'],
    availability: 'part-time',
    workPreference: 'hybrid',
    hoursPerWeek: 20,
  }, {
    domain: 'SaaS',
    availability: 'part-time',
    workPreference: 'hybrid',
    hoursPerWeek: 10,
    rolesAndSkills: [{ role: 'Full Stack Developer', skills: ['React', 'Node.js', 'MongoDB'], experienceLevel: 'Intermediate' }],
  });
  assert.equal(result.recommendationReason, '2 of 3 required skills matched. preferred role matches. domain interests align. availability is compatible.');
});

test('keeps nice-to-have skills explanation-only and handles no must-have skills', () => {
  const result = scoreCandidate({ skills: [{ name: 'Docker', level: 'Advanced' }] }, {
    rolesAndSkills: [{ role: 'DevOps Engineer', skills: ['Docker'], priority: 'nice-to-have', experienceLevel: 'Advanced' }],
  });
  assert.equal(result.components.skills, 40);
  assert.equal(result.niceToHaveSkills[0], 'Docker');
  assert.equal(result.availabilityFallback, true);
});

test('uses half-step level compatibility and availability fallback when requirements are absent', () => {
  const result = scoreCandidate({ skills: [{ name: 'Python', level: 'Beginner' }], domainInterests: ['AI'] }, {
    domain: 'AI',
    rolesAndSkills: [{ role: 'ML Engineer', skills: ['Python'], experienceLevel: 'Intermediate' }],
  });
  assert.equal(result.components.level, 7.5);
  assert.equal(result.components.availability, 7.5);
  assert.equal(result.availabilityFallback, true);
});

test('is deterministic and does not mutate inputs', () => {
  const candidate = { skills: [{ name: 'React', level: 'Advanced' }], targetRoles: ['Frontend Developer'] };
  const requirements = { rolesAndSkills: [{ role: 'Frontend Developer', skills: ['React'], experienceLevel: 'Advanced' }] };
  const original = JSON.stringify({ candidate, requirements });
  const first = scoreCandidate(candidate, requirements);
  const second = scoreCandidate(candidate, requirements);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify({ candidate, requirements }), original);
});

test('handles top-level requiredSkills and requiredRoles fallbacks when rolesAndSkills is empty', () => {
  const candidate = {
    skills: [{ name: 'Node.js', level: 'Intermediate' }],
    targetRoles: ['Backend Developer'],
    domainInterests: ['EdTech'],
  };
  const requirements = {
    domain: 'EdTech',
    requiredSkills: ['Node.js'],
    requiredRoles: ['Backend Developer'],
  };
  const result = scoreCandidate(candidate, requirements);
  assert.equal(result.matchedSkills[0], 'Node.js');
  assert.equal(result.roleMatches[0], 'Backend Developer');
  assert.equal(result.sharedDomains[0], 'EdTech');
  assert.equal(result.score, 92.5);
});

test('performs flexible domain and role matching for candidates', () => {
  const candidate = {
    skills: [{ name: 'React', level: 'Advanced' }],
    targetRoles: ['Full Stack Developer'],
    domainInterests: ['EdTech'],
  };
  const requirements = {
    domain: 'EdTech / AI Platform',
    rolesAndSkills: [
      { role: 'Frontend Developer', skills: ['React'], experienceLevel: 'Intermediate', priority: 'must-have' },
    ],
  };
  const result = scoreCandidate(candidate, requirements);
  assert.equal(result.roleMatches.length, 1);
  assert.equal(result.sharedDomains.length, 1);
  assert.equal(result.score, 92.5);
});


