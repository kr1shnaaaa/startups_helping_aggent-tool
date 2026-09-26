const MAX_CANDIDATES_PER_ROLE = 8;

const toArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return value ? [value] : [];
  return [];
};

const normalize = (value) => String(value || "").trim().toLowerCase();

const normalizeRoleLabel = (value) => String(value || "").replace(/\s+/g, " ").trim();

const tokenizeRoleKey = (str) =>
  normalize(str)
    .split(/[\s/&,-]+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 2 &&
        !["engineer", "developer", "designer", "specialist", "manager", "lead"].includes(
          token,
        ),
    );

export const normalizeInvitationStatus = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  const statusMap = {
    pending: "Pending",
    accepted: "Accepted",
    declined: "Declined",
    withdrawn: "Withdrawn",
    "team member": "Team Member",
    "team_member": "Team Member",
  };

  return statusMap[normalized.toLowerCase()] || normalized;
};

export const rolesMatch = (left, right) => {
  const first = normalize(left);
  const second = normalize(right);
  if (!first || !second) return false;
  if (first === second) return true;

  const firstIsFullStack = first.includes("full") && first.includes("stack");
  const secondIsFullStack = second.includes("full") && second.includes("stack");
  if (firstIsFullStack || secondIsFullStack) {
    if (
      first.includes("developer") ||
      first.includes("engineer") ||
      second.includes("developer") ||
      second.includes("engineer") ||
      first.includes("backend") ||
      first.includes("frontend") ||
      second.includes("backend") ||
      second.includes("frontend")
    ) {
      return true;
    }
  }

  const firstTokens = tokenizeRoleKey(left);
  const secondTokens = tokenizeRoleKey(right);
  return firstTokens.some((token) => secondTokens.includes(token));
};

export const getMatchCardData = (item = {}) => {
  const explanation = item.explanation || {};
  const candidate = item.candidate || {};
  const roleMatches = toArray(explanation.roleMatches || item.roleMatches || candidate.roleMatches || []);
  const matchedRoles = toArray(item.matchedRoles || explanation.matchedRoles || []);
  const matchedSkills = toArray(explanation.matchedSkills || item.matchedSkills || []);
  const missingSkills = toArray(explanation.missingSkills || item.missingSkills || []);
  const niceToHaveSkills = toArray(
    explanation.niceToHaveSkills || item.niceToHaveSkills || [],
  );
  const sharedDomains = toArray(explanation.sharedDomains || item.sharedDomains || []);

  return {
    candidate,
    score: Number(item.score ?? explanation.score ?? 0) || 0,
    matchedSkills: matchedSkills.map((skill) => normalizeRoleLabel(skill)),
    missingSkills: missingSkills.map((skill) => normalizeRoleLabel(skill)),
    niceToHaveSkills: niceToHaveSkills.map((skill) => normalizeRoleLabel(skill)),
    roleMatches: roleMatches.map((role) => normalizeRoleLabel(role)),
    matchedRoles: matchedRoles.map((role) => normalizeRoleLabel(role)),
    sharedDomains: sharedDomains.map((domain) => normalizeRoleLabel(domain)),
    recommendationReason: explanation.recommendationReason || item.recommendationReason || "",
    invitationStatus: normalizeInvitationStatus(item.invitationStatus || explanation.invitationStatus),
    invitationId: item.invitationId || explanation.invitationId || null,
    teamId: item.teamId || explanation.teamId || null,
    matchId: item.matchId || null,
  };
};

const candidateMatchesRole = (item, roleName) => {
  const card = getMatchCardData(item);
  
  // Use explicit matchedRoles from backend (preferred) or fall back to roleMatches
  const matchedRoles = toArray(card.matchedRoles || card.roleMatches || []);
  
  // Only match against explicitly matched roles - do NOT fall back to targetRoles
  // This prevents candidates from appearing in roles they don't actually match
  return matchedRoles.some((role) => rolesMatch(role, roleName));
};

export const groupMatchesByRequiredRoles = (rolesAndSkills = [], matches = []) => {
  const rankedMatches = Array.isArray(matches)
    ? [...matches].sort(
        (a, b) =>
          (Number(b.score ?? 0) || 0) - (Number(a.score ?? 0) || 0),
      )
    : [];

  return (rolesAndSkills || []).map((roleSkill) => {
    const roleName = roleSkill?.role || "Team Member";
    const assigned = rankedMatches
      .filter((item) => candidateMatchesRole(item, roleName))
      .slice(0, MAX_CANDIDATES_PER_ROLE);

    return {
      role: normalizeRoleLabel(roleName),
      skills: toArray(roleSkill?.skills || []).map((skill) => normalizeRoleLabel(skill)),
      priority: roleSkill?.priority || "must-have",
      count: roleSkill?.count || 1,
      experienceLevel: roleSkill?.experienceLevel || "Intermediate",
      candidates: assigned,
    };
  });
};

export { MAX_CANDIDATES_PER_ROLE };
