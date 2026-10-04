import client from "../api/client";

export const searchMatches = async (ideaId, params = {}) => {
  const queryParams = new URLSearchParams();
  queryParams.append("ideaId", ideaId);

  if (params.skills) queryParams.append("skills", params.skills);
  if (params.level) queryParams.append("level", params.level);
  if (params.domain) queryParams.append("domain", params.domain);
  if (params.workMode) queryParams.append("workMode", params.workMode);
  if (params.availability) queryParams.append("availability", params.availability);
  if (params.sort) queryParams.append("sort", params.sort);
  if (params.page) queryParams.append("page", params.page);
  if (params.limit) queryParams.append("limit", params.limit);
  if (params.minScore) queryParams.append("minScore", params.minScore);

  const response = await client.get(`/candidates/search/with-scores?${queryParams.toString()}`);
  return response.data;
};

export const getCandidateMatch = async (ideaId) => {
  const response = await client.get(`/candidates/matches/${ideaId}`);
  return response.data;
};

export const getCandidateProfile = async (candidateId) => {
  const response = await client.get(`/users/profile/${candidateId}`);
  return response.data;
};

export const sendInvitation = async (ideaId, candidateId, role, message = "") => {
  const response = await client.post("/invitations", {
    ideaId,
    candidateId,
    role,
    message,
  });
  return response.data;
};

export const generateInvitationMessage = async ({
  ideaId,
  candidateId,
  role,
  action = "personalize",
  draft = "",
  ideaDescription = "",
  ideaProblem = "",
  ideaSolution = "",
  ideaTargetAudience = "",
  requiredSkills = [],
  candidateSkills = [],
  matchedSkills = [],
  missingSkills = [],
}) => {
  const response = await client.post("/ideas/invitations/generate-message", {
    ideaId,
    candidateId,
    role,
    action,
    draft,
    ideaDescription,
    ideaProblem,
    ideaSolution,
    ideaTargetAudience,
    requiredSkills,
    candidateSkills,
    matchedSkills,
    missingSkills,
  });
  return response.data;
};

export const listInvitations = async (direction = "sent", status = "") => {
  const params = new URLSearchParams();
  params.append("direction", direction);
  if (status) params.append("status", status);
  const response = await client.get(`/invitations?${params.toString()}`);
  return response.data;
};

export const acceptInvitation = async (invitationId) => {
  const response = await client.put(`/invitations/${invitationId}/accept`);
  return response.data;
};

export const declineInvitation = async (invitationId) => {
  const response = await client.put(`/invitations/${invitationId}/decline`);
  return response.data;
};

export const withdrawInvitation = async (invitationId) => {
  const response = await client.put(`/invitations/${invitationId}/withdraw`);
  return response.data;
};

export const getInvitation = async (invitationId) => {
  const response = await client.get(`/invitations/${invitationId}`);
  return response.data;
};

export const getIdeaById = async (ideaId) => {
  const response = await client.get(`/ideas/${ideaId}`);
  return response.data;
};

export const listTeams = async () => {
  const response = await client.get("/teams");
  return response.data;
};

export const createTeam = async (ideaId, name) => {
  const response = await client.post("/teams", { ideaId, name });
  return response.data;
};

export const getTeam = async (teamId) => {
  const response = await client.get(`/teams/${teamId}`);
  return response.data;
};

export const addTeamMember = async (teamId, candidateId) => {
  const response = await client.post(`/teams/${teamId}/members`, { candidateId });
  return response.data;
};
