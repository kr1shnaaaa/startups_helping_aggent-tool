const { normalizeSkill } = require('../config/taxonomies');

const SCORING_VERSION = 'v1';
const WEIGHTS = Object.freeze({ skills: 0.4, level: 0.15, role: 0.15, domain: 0.15, availability: 0.15 });
const LEVELS = Object.freeze({ beginner: 1, intermediate: 2, advanced: 3 });

const normalize = (value) => String(value || '').trim().toLowerCase();
const normalizeSkillKey = (value) => {
  const canonical = normalizeSkill(value);
  return canonical ? canonical.toLowerCase() : '';
};
const unique = (values) => [...new Map(values.filter(Boolean).map((value) => [normalize(value), String(value).trim()])).values()];

const levelValue = (level) => LEVELS[normalize(level)] || 0;

const normalizeCandidateSkills = (candidate) => {
  const skills = Array.isArray(candidate?.skills) ? candidate.skills : [];
  const byName = new Map();
  for (const skill of skills) {
    const name = typeof skill === 'string' ? skill : skill?.name;
    const key = normalizeSkillKey(name);
    if (!key) continue;
    const current = byName.get(key);
    if (!current || levelValue(skill?.level) > levelValue(current.level)) {
      byName.set(key, { name: String(name).trim(), level: skill?.level || 'Beginner' });
    }
  }
  return byName;
};

const flattenRequirements = (requirements = {}) => {
  const roles = Array.isArray(requirements.rolesAndSkills) ? requirements.rolesAndSkills : [];
  const mustHave = [];
  const niceToHave = [];
  const roleRequirements = [];
  for (const role of roles) {
    const skills = unique(role.skills || []);
    roleRequirements.push({
      role: role.role,
      skills,
      experienceLevel: role.experienceLevel,
      priority: role.priority || 'must-have',
    });
    (role.priority === 'nice-to-have' ? niceToHave : mustHave).push(...skills);
  }

  // Fallback for top-level requiredSkills if rolesAndSkills is empty
  if (!mustHave.length && Array.isArray(requirements.requiredSkills) && requirements.requiredSkills.length) {
    mustHave.push(...requirements.requiredSkills);
  }

  // Fallback for top-level requiredRoles if rolesAndSkills is empty
  if (!roleRequirements.length && Array.isArray(requirements.requiredRoles) && requirements.requiredRoles.length) {
    for (const roleName of requirements.requiredRoles) {
      if (typeof roleName === 'string' && roleName.trim()) {
        roleRequirements.push({
          role: roleName.trim(),
          skills: [],
          experienceLevel: 'Intermediate',
          priority: 'must-have',
        });
      }
    }
  }

  return {
    roles: roleRequirements,
    mustHave: unique(mustHave),
    niceToHave: unique(niceToHave),
  };
};

const tokenizeDomain = (str) =>
  normalize(str)
    .split(/[\s\/&,\-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !['and', 'the', 'for', 'with', 'tech', 'technology'].includes(t));

const domainsMatch = (d1, d2) => {
  const n1 = normalize(d1);
  const n2 = normalize(d2);
  if (!n1 || !n2) return false;
  if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;
  const tokens1 = tokenizeDomain(d1);
  const tokens2 = tokenizeDomain(d2);
  return tokens1.some((t1) => tokens2.includes(t1));
};

const tokenizeRoleKey = (str) =>
  normalize(str)
    .split(/[\s\/&,\-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !['engineer', 'developer', 'designer', 'specialist', 'manager', 'lead'].includes(t));

const rolesMatch = (r1, r2) => {
  const n1 = normalize(r1);
  const n2 = normalize(r2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  if ((n1.includes('full') && n1.includes('stack')) || (n2.includes('full') && n2.includes('stack'))) {
    if (n1.includes('developer') || n1.includes('engineer') || n2.includes('developer') || n2.includes('engineer') || n1.includes('backend') || n1.includes('frontend')) {
      return true;
    }
  }
  const t1 = tokenizeRoleKey(r1);
  const t2 = tokenizeRoleKey(r2);
  return t1.some((token) => t2.includes(token));
};

const calculateLevelCompatibility = (candidateSkills, requirements) => {
  const roleRequirements = (requirements.roles || []).filter((role) => role.priority !== 'nice-to-have');
  if (!roleRequirements.length) return 1;
  const scores = roleRequirements.map((role) => {
    const required = levelValue(role.experienceLevel);
    if (!required) return 1;
    if (!role.skills || !role.skills.length) return 1;
    const relevant = role.skills.map((skill) => candidateSkills.get(normalizeSkillKey(skill))).filter(Boolean);
    if (!relevant.length) return 0;
    const best = Math.max(...relevant.map((skill) => levelValue(skill.level)));
    if (best >= required) return 1;
    if (best === required - 1) return 0.5;
    return 0;
  });
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
};

const calculateAvailabilityCompatibility = (candidate, requirements) => {
  const hasRequirement = requirements.availability || requirements.workPreference || requirements.hoursPerWeek;
  if (!hasRequirement) return 0.5;
  const availabilityMatch = !requirements.availability || normalize(candidate.availability) === normalize(requirements.availability);
  const workModeMatch = !requirements.workPreference || normalize(candidate.workPreference) === normalize(requirements.workPreference);
  const hoursMatch = !requirements.hoursPerWeek || Number(candidate.hoursPerWeek || 0) >= Number(requirements.hoursPerWeek);
  if (availabilityMatch && workModeMatch && hoursMatch) return 1;
  if (availabilityMatch || workModeMatch || hoursMatch) return 0.5;
  return 0;
};

const buildRecommendationReason = (result) => {
  const parts = [];
  const totalSkills = result.matchedSkills.length + result.missingSkills.length;

  if (totalSkills > 0) {
    parts.push(`${result.matchedSkills.length} of ${totalSkills} required skills matched`);
  }

  if (result.roleMatches.length) {
    parts.push('preferred role matches');
  } else if (result.components.role < 15) {
    parts.push('preferred role does not match');
  }

  if (result.sharedDomains.length) {
    parts.push('domain interests align');
  } else if (result.components.domain < 15) {
    parts.push('domain interests do not align');
  }

  if (result.availabilityFallback) {
    parts.push('availability requirements not specified');
  } else if (result.components.availability >= 15) {
    parts.push('availability is compatible');
  } else if (result.components.availability > 0) {
    parts.push('availability is partially compatible');
  } else {
    parts.push('availability is not compatible');
  }

  return parts.join('. ') + '.';
};

function scoreCandidate(candidate = {}, requirements = {}) {
  const flattened = flattenRequirements(requirements);
  const candidateSkills = normalizeCandidateSkills(candidate);
  const candidateSkillKeys = new Set(candidateSkills.keys());
  const mustHaveKeys = flattened.mustHave.map(normalizeSkillKey);
  const matchedSkills = flattened.mustHave.filter((skill) => candidateSkillKeys.has(normalizeSkillKey(skill)));
  const missingSkills = flattened.mustHave.filter((skill) => !candidateSkillKeys.has(normalizeSkillKey(skill)));
  const niceToHaveSkills = flattened.niceToHave.filter((skill) => candidateSkillKeys.has(normalizeSkillKey(skill)));
  const skillsMatchScore = mustHaveKeys.length ? (matchedSkills.length / mustHaveKeys.length) * 100 : 100;
  const levelCompatibility = calculateLevelCompatibility(candidateSkills, flattened);
  const requiredRoles = flattened.roles
    .filter((role) => role.priority !== 'nice-to-have')
    .map((role) => role.role)
    .filter(Boolean);
  const roleMatches = unique(
    requiredRoles.filter((reqRole) =>
      (candidate.targetRoles || []).some((targetRole) => rolesMatch(targetRole, reqRole))
    )
  );
  const roleMatch = requiredRoles.length ? roleMatches.length / unique(requiredRoles).length : 1;
  const ideaDomains = unique([requirements.domain, requirements.ideaDomain, ...(requirements.domainInterests || [])]);
  const candidateDomains = Array.isArray(candidate.domainInterests) ? candidate.domainInterests : [];
  const sharedDomains = [];
  for (const ideaDomain of ideaDomains) {
    for (const candidateDomain of candidateDomains) {
      if (domainsMatch(ideaDomain, candidateDomain)) {
        sharedDomains.push(ideaDomain);
        break;
      }
    }
  }
  const uniqueSharedDomains = unique(sharedDomains);
  const domainMatch = ideaDomains.length ? (uniqueSharedDomains.length ? 1 : 0) : 1;
  const availabilityCompatibility = calculateAvailabilityCompatibility(candidate, requirements);
  const components = {
    skills: skillsMatchScore * WEIGHTS.skills,
    level: levelCompatibility * 100 * WEIGHTS.level,
    role: roleMatch * 100 * WEIGHTS.role,
    domain: domainMatch * 100 * WEIGHTS.domain,
    availability: availabilityCompatibility * 100 * WEIGHTS.availability,
  };
  const score = Math.round((components.skills + components.level + components.role + components.domain + components.availability) * 100) / 100;
  return {
    score,
    matchedSkills,
    missingSkills,
    niceToHaveSkills,
    sharedDomains,
    roleMatches,
    components,
    recommendationReason: buildRecommendationReason({
      matchedSkills,
      missingSkills,
      roleMatches,
      sharedDomains,
      components,
      availabilityFallback: !requirements.availability && !requirements.workPreference && !requirements.hoursPerWeek,
    }),
    scoringVersion: SCORING_VERSION,
    availabilityFallback: !requirements.availability && !requirements.workPreference && !requirements.hoursPerWeek,
  };
}

module.exports = { scoreCandidate, normalize, flattenRequirements, SCORING_VERSION, WEIGHTS };
