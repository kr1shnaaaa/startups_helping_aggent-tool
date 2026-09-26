const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreCandidate, flattenRequirements } = require('../../services/matchScoring');

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

test('Multi-role: Full Stack candidate matches both Backend and Frontend roles', () => {
  const result = scoreCandidate({
    skills: [
      { name: 'Node.js', level: 'Advanced' },
      { name: 'MongoDB', level: 'Intermediate' },
      { name: 'React', level: 'Advanced' },
    ],
    targetRoles: ['Full Stack Developer'],
    domainInterests: ['EdTech'],
    availability: 'part-time',
    workPreference: 'hybrid',
    hoursPerWeek: 20,
  }, baseRequirements);

  // Full Stack should match both Backend and Frontend roles
  assert.ok(result.roleMatches.includes('Backend Developer'), 'Full Stack should match Backend Developer');
  assert.ok(result.roleMatches.includes('Frontend Developer'), 'Full Stack should match Frontend Developer');
  assert.equal(result.roleMatches.length, 2);
});

test('Multi-role: Backend-only candidate only matches Backend role', () => {
  const result = scoreCandidate({
    skills: [
      { name: 'Node.js', level: 'Advanced' },
      { name: 'MongoDB', level: 'Intermediate' },
    ],
    targetRoles: ['Backend Developer'],
    domainInterests: ['EdTech'],
    availability: 'part-time',
    workPreference: 'hybrid',
    hoursPerWeek: 20,
  }, baseRequirements);

  // Backend-only candidate should only match Backend role
  assert.ok(result.roleMatches.includes('Backend Developer'), 'Should match Backend Developer');
  assert.ok(!result.roleMatches.includes('Frontend Developer'), 'Should NOT match Frontend Developer');
  assert.equal(result.roleMatches.length, 1);
});

test('Multi-role: Frontend-only candidate only matches Frontend role', () => {
  const result = scoreCandidate({
    skills: [
      { name: 'React', level: 'Advanced' },
      { name: 'JavaScript', level: 'Intermediate' },
    ],
    targetRoles: ['Frontend Developer'],
    domainInterests: ['EdTech'],
    availability: 'part-time',
    workPreference: 'hybrid',
    hoursPerWeek: 20,
  }, baseRequirements);

  // Frontend-only candidate should only match Frontend role
  assert.ok(!result.roleMatches.includes('Backend Developer'), 'Should NOT match Backend Developer');
  assert.ok(result.roleMatches.includes('Frontend Developer'), 'Should match Frontend Developer');
  assert.equal(result.roleMatches.length, 1);
});

test('Multi-role: Candidate with no role match has empty roleMatches', () => {
  const result = scoreCandidate({
    skills: [
      { name: 'Python', level: 'Advanced' },
    ],
    targetRoles: ['Data Scientist'],
    domainInterests: ['AI'],
    availability: 'full-time',
    workPreference: 'remote',
    hoursPerWeek: 40,
  }, baseRequirements);

  // Data Scientist candidate shouldn't match Backend or Frontend
  assert.equal(result.roleMatches.length, 0, 'Should have no role matches');
});

test('Multi-role: Role matching is case-insensitive and handles variations', () => {
  const result = scoreCandidate({
    skills: [
      { name: 'Node.js', level: 'Advanced' },
    ],
    targetRoles: ['BACKEND DEVELOPER', 'backend dev'], // Different case
    domainInterests: ['EdTech'],
  }, baseRequirements);

  assert.ok(result.roleMatches.includes('Backend Developer'), 'Case insensitive matching should work');
});

test('Multi-role: flattenRequirements correctly extracts all required roles', () => {
  const requirements = {
    rolesAndSkills: [
      { role: 'Backend Developer', skills: ['Node.js'], priority: 'must-have' },
      { role: 'Frontend Developer', skills: ['React'], priority: 'must-have' },
      { role: 'DevOps Engineer', skills: ['Docker'], priority: 'nice-to-have' },
    ],
  };

  const flattened = flattenRequirements(requirements);
  
  // Should extract all three roles
  assert.equal(flattened.roles.length, 3);
  assert.ok(flattened.roles.some(r => r.role === 'Backend Developer'));
  assert.ok(flattened.roles.some(r => r.role === 'Frontend Developer'));
  assert.ok(flattened.roles.some(r => r.role === 'DevOps Engineer'));
  
  // mustHave should only include must-have skills
  assert.ok(flattened.mustHave.includes('Node.js'));
  assert.ok(flattened.mustHave.includes('React'));
  assert.ok(!flattened.mustHave.includes('Docker'));
  
  // niceToHave should include nice-to-have skills
  assert.ok(flattened.niceToHave.includes('Docker'));
});

test('Multi-role: Candidate matching multiple roles gets higher role score', () => {
  const fullStackResult = scoreCandidate({
    skills: [
      { name: 'Node.js', level: 'Advanced' },
      { name: 'MongoDB', level: 'Advanced' },
      { name: 'React', level: 'Advanced' },
    ],
    targetRoles: ['Full Stack Developer'],
    domainInterests: ['EdTech'],
    availability: 'part-time',
    workPreference: 'hybrid',
    hoursPerWeek: 20,
  }, baseRequirements);

  const backendOnlyResult = scoreCandidate({
    skills: [
      { name: 'Node.js', level: 'Advanced' },
      { name: 'MongoDB', level: 'Advanced' },
    ],
    targetRoles: ['Backend Developer'],
    domainInterests: ['EdTech'],
    availability: 'part-time',
    workPreference: 'hybrid',
    hoursPerWeek: 20,
  }, baseRequirements);

  // Full stack should have higher role component (matches 2/2 required roles = 100%)
  // Backend only matches 1/2 required roles = 50%
  assert.ok(fullStackResult.components.role > backendOnlyResult.components.role, 
    'Full Stack candidate should have higher role score than Backend-only');
});

test('Multi-role: Skills matching is per-role, not global', () => {
  // A candidate with only React skills should match Frontend but not Backend
  const frontendOnly = scoreCandidate({
    skills: [{ name: 'React', level: 'Advanced' }],
    targetRoles: ['Frontend Developer'],
    domainInterests: ['EdTech'],
  }, baseRequirements);

  // Should match Frontend role (has React) but not Backend (no Node.js/MongoDB)
  assert.ok(frontendOnly.roleMatches.includes('Frontend Developer'));
  assert.ok(!frontendOnly.roleMatches.includes('Backend Developer'));
});

test('Multi-role: Score ordering is preserved within each role', () => {
  const requirements = {
    domain: 'EdTech',
    availability: 'part-time',
    workPreference: 'hybrid',
    hoursPerWeek: 10,
    rolesAndSkills: [
      { role: 'Backend Developer', skills: ['Node.js'], experienceLevel: 'Intermediate', priority: 'must-have' },
    ],
  };

  const candidates = [
    { 
      skills: [{ name: 'Node.js', level: 'Beginner' }], 
      targetRoles: ['Backend Developer'],
      domainInterests: ['EdTech'],
      availability: 'part-time',
      workPreference: 'hybrid',
      hoursPerWeek: 10,
    },
    { 
      skills: [{ name: 'Node.js', level: 'Advanced' }], 
      targetRoles: ['Backend Developer'],
      domainInterests: ['EdTech'],
      availability: 'part-time',
      workPreference: 'hybrid',
      hoursPerWeek: 20,
    },
    { 
      skills: [{ name: 'Node.js', level: 'Intermediate' }], 
      targetRoles: ['Backend Developer'],
      domainInterests: ['EdTech'],
      availability: 'part-time',
      workPreference: 'hybrid',
      hoursPerWeek: 15,
    },
  ];

  const results = candidates.map(c => scoreCandidate(c, requirements));
  const scores = results.map(r => r.score);
  
  // Beginner scores lower than Intermediate/Advanced
  assert.ok(scores[0] < scores[1], 'Beginner should score lower than Advanced');
  assert.ok(scores[0] < scores[2], 'Beginner should score lower than Intermediate');
  
  // Advanced and Intermediate both meet the requirement, so they score equally high on role
  // The test just verifies scores are deterministic and Beginner is lowest
  assert.ok(Number.isFinite(scores[0]) && Number.isFinite(scores[1]) && Number.isFinite(scores[2]));
});