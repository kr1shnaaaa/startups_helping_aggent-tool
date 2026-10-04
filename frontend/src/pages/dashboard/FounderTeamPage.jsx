import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import { useAuth } from "../../hooks/useAuth";
import { getIdeaById, getMyIdeas } from "../../services/ideaApi";
import {
  addTeamMember,
  createTeam,
  listInvitations,
  listTeams,
} from "../../services/matchingApi";
import { calculateTeamCompletion } from "../../utils/teamCompletion";

const normalizeList = (payload, key) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload[key])) return payload[key];
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
};

const getId = (value) => {
  if (!value) return "";
  return String(typeof value === "object" ? value._id || "" : value);
};

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const FounderTeamPage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState([]);
  const [teams, setTeams] = useState([]);
  const [acceptedInvitations, setAcceptedInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingIdeaId, setPendingIdeaId] = useState(null);
  const [pendingCandidateId, setPendingCandidateId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  const fetchData = useCallback(async () => {
    const [ideaResponse, teamResponse, invitationResponse] = await Promise.all([
      getMyIdeas(),
      listTeams(),
      listInvitations("sent", "Accepted"),
    ]);
    const ideaDetails = await Promise.all(
      normalizeList(ideaResponse, "ideas").map(async (idea) => {
        const response = await getIdeaById(getId(idea?._id));
        return response?.idea || response;
      }),
    );

    return {
      ideas: ideaDetails,
      teams: normalizeList(teamResponse, "teams"),
      invitations: normalizeList(invitationResponse, "invitations"),
    };
  }, []);

  const applyData = useCallback(
    ({ ideas: nextIdeas, teams: nextTeams, invitations }) => {
      setIdeas(nextIdeas);
      setTeams(nextTeams);
      setAcceptedInvitations(invitations);
    },
    [],
  );

  const applyLoadError = useCallback((requestError) => {
    const status = requestError?.status || requestError?.response?.status;
    setError(
      status === 401
        ? "Your session has expired. Please sign in again."
        : "Unable to load your team and accepted candidates.",
    );
  }, []);

  useEffect(() => {
    let active = true;
    fetchData()
      .then((data) => {
        if (active) applyData(data);
      })
      .catch((requestError) => {
        if (active) applyLoadError(requestError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyData, applyLoadError, fetchData]);

  const handleRetry = () => {
    setLoading(true);
    setError("");
    fetchData()
      .then(applyData)
      .catch(applyLoadError)
      .finally(() => setLoading(false));
  };

  const teamLookup = useMemo(() => {
    const map = {};
    teams.forEach((team) => {
      const ideaId = getId(team?.ideaId);
      if (ideaId) map[ideaId] = team;
    });
    return map;
  }, [teams]);

  const handleCreateTeam = async (idea) => {
    const ideaId = getId(idea?._id);
    const teamName = idea?.enhanced?.title || idea?.title || "Startup Team";
    if (!ideaId) return;

    setPendingIdeaId(ideaId);
    setError("");
    try {
      const response = await createTeam(ideaId, teamName);
      const createdTeam = response?.team;
      if (!createdTeam?._id) {
        throw new Error("The server did not return the created team.");
      }
      setTeams((current) => [
        ...current.filter((team) => getId(team?.ideaId) !== ideaId),
        createdTeam,
      ]);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Unable to create a team for this idea.",
      );
    } finally {
      setPendingIdeaId(null);
    }
  };

  const handleAddMember = (idea, invitation) => {
    const ideaId = getId(idea?._id);
    const candidateId = getId(invitation?.toCandidate);
    const team = teamLookup[ideaId];
    if (!team?._id || !candidateId) return;

    setConfirmation({
      ideaId,
      teamId: team._id,
      candidateId,
      candidateName:
        typeof invitation.toCandidate === "object"
          ? invitation.toCandidate.name || "this candidate"
          : "this candidate",
      role: invitation.role || "Team member",
      ideaTitle: idea?.enhanced?.title || idea?.title || "this idea",
    });
  };

  const handleFindCandidates = (ideaId, role) => {
    navigate(
      `/app/ideas/${ideaId}/matching?role=${encodeURIComponent(role)}`,
    );
  };

  const confirmAddMember = async () => {
    if (!confirmation) return;
    setPendingCandidateId(confirmation.candidateId);
    setError("");
    try {
      const response = await addTeamMember(
        confirmation.teamId,
        confirmation.candidateId,
      );
      const updatedTeam = response?.team;
      if (!updatedTeam?._id) {
        throw new Error("The server did not return the updated team.");
      }
      setTeams((current) =>
        current.map((team) =>
          getId(team?.ideaId) === confirmation.ideaId ? updatedTeam : team,
        ),
      );
      setAcceptedInvitations((current) =>
        current.filter(
          (invitation) =>
            !(
              getId(invitation?.ideaId) === confirmation.ideaId &&
              getId(invitation?.toCandidate) === confirmation.candidateId
            ),
        ),
      );
      setConfirmation(null);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Unable to add this candidate to the team.",
      );
    } finally {
      setPendingCandidateId(null);
    }
  };

  return (
    <AppLayout>
      <div
        style={{
          padding: "var(--space-lg)",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h1 style={{ margin: 0 }}>My Team</h1>
          <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
            Create teams for your ideas and add candidates who accepted your
            invitations.
          </p>
        </div>

        {loading && (
          <Card>
            <p style={{ margin: 0 }}>Loading your ideas and teams...</p>
          </Card>
        )}

        {!loading && error && (
          <Card>
            <h3 style={{ marginTop: 0 }}>Unable to load your team.</h3>
            <p>{error}</p>
            <Button onClick={handleRetry}>Retry</Button>
          </Card>
        )}

        {!loading && !error && ideas.length === 0 && (
          <Card>
            <h3 style={{ marginTop: 0 }}>No startup ideas yet.</h3>
            <p style={{ marginBottom: 0 }}>
              Create an idea before forming a team.
            </p>
          </Card>
        )}

        {!loading && !error && ideas.length > 0 && (
          <div style={{ display: "grid", gap: "var(--space-lg)" }}>
            {ideas.map((idea) => {
              const ideaId = getId(idea?._id);
              const ideaTitle =
                idea?.enhanced?.title || idea?.title || "Startup idea";
              const team = teamLookup[ideaId];
              const memberList = Array.isArray(team?.members)
                ? team.members
                : [];
              const approved = idea?.aiAnalysis?.isApproved === true;
              const completion = calculateTeamCompletion(
                approved ? idea?.aiAnalysis?.rolesAndSkills : [],
                memberList,
              );
              const teamMemberIds = new Set(
                memberList.map((member) => getId(member?.userId)),
              );
              const waitingCandidates = acceptedInvitations.filter(
                (invitation) =>
                  getId(invitation?.ideaId) === ideaId &&
                  !teamMemberIds.has(getId(invitation?.toCandidate)),
              );
              const founder =
                typeof team?.founderId === "object" && team.founderId
                  ? team.founderId
                  : profile || {};

              return (
                <section key={ideaId}>
                  {!team ? (
                    <Card>
                      <h2 style={{ margin: "0 0 var(--space-sm)" }}>
                        {ideaTitle}
                      </h2>
                      <h3 style={{ margin: "0 0 var(--space-sm)" }}>
                        No team has been created yet.
                      </h3>
                      <p
                        style={{
                          margin: "0 0 var(--space-md)",
                          color: "var(--muted)",
                        }}
                      >
                        Create a team for this idea to start building your team.
                      </p>
                      <Button
                        onClick={() => handleCreateTeam(idea)}
                        disabled={pendingIdeaId === ideaId}
                      >
                        {pendingIdeaId === ideaId
                          ? "Creating..."
                          : "Create Team"}
                      </Button>
                    </Card>
                  ) : (
                    <Card>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "var(--space-sm)",
                          marginBottom: "var(--space-md)",
                        }}
                      >
                        <h2 style={{ margin: 0 }}>{team.name}</h2>
                        <Badge variant="accent">
                          {team.status || "Active"}
                        </Badge>
                      </div>
                      <p
                        style={{
                          margin: "0 0 var(--space-sm)",
                          color: "var(--muted)",
                        }}
                      >
                        <strong>Idea:</strong> {ideaTitle}
                      </p>
                      <section style={{ margin: "var(--space-lg) 0" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "var(--space-sm)",
                            marginBottom: "var(--space-sm)",
                          }}
                        >
                          <h3 style={{ margin: 0 }}>Team Completion</h3>
                          <strong>{completion.percentage}%</strong>
                        </div>
                        <div
                          role="progressbar"
                          aria-label="Team completion"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={completion.percentage}
                          style={{
                            height: "8px",
                            background: "var(--line)",
                            borderRadius: "var(--radius-sm)",
                            overflow: "hidden",
                            marginBottom: "var(--space-md)",
                          }}
                        >
                          <div
                            style={{
                              width: `${completion.percentage}%`,
                              height: "100%",
                              background: "var(--accent)",
                            }}
                          />
                        </div>
                        {completion.complete && (
                          <p
                            role="status"
                            style={{ color: "var(--accent-dark)", fontWeight: 600 }}
                          >
                            ✓ Team Complete. All required positions are filled.
                          </p>
                        )}
                        {!approved ? (
                          <p style={{ color: "var(--muted)" }}>
                            Approve this idea's analysis to view required team positions.
                          </p>
                        ) : completion.roles.length === 0 ? (
                          <p style={{ color: "var(--muted)" }}>
                            No required roles are defined for this approved idea.
                          </p>
                        ) : (
                          <div style={{ display: "grid", gap: "var(--space-sm)" }}>
                            {completion.roles.map((role) => (
                              <div
                                key={role.role}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: "var(--space-sm)",
                                  borderBottom: "1px solid var(--line)",
                                  padding: "var(--space-sm) 0",
                                }}
                              >
                                <span>{role.role}</span>
                                <strong>
                                  {role.filled}/{role.required}
                                  {role.remaining === 0 ? " ✓" : ""}
                                </strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                      <h3 style={{ margin: "0 0 var(--space-sm)" }}>
                        Team Members
                      </h3>
                      <div
                        style={{
                          border: "1px solid var(--line)",
                          borderRadius: "var(--radius-sm)",
                          padding: "var(--space-sm)",
                          marginBottom: "var(--space-sm)",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {founder.name || "Founder"}
                        </div>
                        <div
                          style={{ color: "var(--muted)", marginTop: "4px" }}
                        >
                          Founder
                        </div>
                      </div>
                      {memberList.length === 0 ? (
                        <p style={{ color: "var(--muted)" }}>
                          No candidates have joined yet.
                        </p>
                      ) : (
                        <div
                          style={{ display: "grid", gap: "var(--space-sm)" }}
                        >
                          {memberList.map((member, index) => {
                            const memberUser =
                              typeof member?.userId === "object" &&
                              member.userId
                                ? member.userId
                                : {};
                            return (
                              <div
                                key={`${getId(member?.userId) || "member"}-${index}`}
                                style={{
                                  border: "1px solid var(--line)",
                                  borderRadius: "var(--radius-sm)",
                                  padding: "var(--space-sm)",
                                }}
                              >
                                <div style={{ fontWeight: 600 }}>
                                  {memberUser.name || "Team member"}
                                </div>
                                <div
                                  style={{
                                    color: "var(--muted)",
                                    marginTop: "4px",
                                  }}
                                >
                                  {member.role || "Team member"}
                                </div>
                                <div
                                  style={{
                                    color: "var(--muted)",
                                    marginTop: "4px",
                                  }}
                                >
                                  Joined: {formatDate(member.joinedAt)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <section style={{ marginTop: "var(--space-lg)" }}>
                        <h3 style={{ margin: "0 0 var(--space-sm)" }}>
                          Missing Roles
                        </h3>
                        {completion.roles.filter((role) => role.remaining > 0)
                          .length === 0 ? (
                          <p style={{ color: "var(--muted)" }}>
                            {completion.complete
                              ? "All required positions are filled."
                              : "No missing roles to show."}
                          </p>
                        ) : (
                          <div style={{ display: "grid", gap: "var(--space-sm)" }}>
                            {completion.roles
                              .filter((role) => role.remaining > 0)
                              .map((role) => (
                                <div
                                  key={role.role}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: "var(--space-md)",
                                    flexWrap: "wrap",
                                    border: "1px solid var(--line)",
                                    borderRadius: "var(--radius-sm)",
                                    padding: "var(--space-sm)",
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{role.role}</div>
                                    <div style={{ color: "var(--muted)" }}>
                                      {role.filled}/{role.required}
                                    </div>
                                  </div>
                                  <Button
                                    variant="secondary"
                                    onClick={() =>
                                      handleFindCandidates(ideaId, role.role)
                                    }
                                  >
                                    Find Candidates
                                  </Button>
                                </div>
                              ))}
                          </div>
                        )}
                      </section>
                    </Card>
                  )}

                  <Card style={{ marginTop: "var(--space-md)" }}>
                    <h3 style={{ marginTop: 0 }}>Accepted Candidates</h3>
                    {waitingCandidates.length === 0 ? (
                      <p style={{ marginBottom: 0, color: "var(--muted)" }}>
                        No accepted candidates are waiting to be added to this
                        team.
                      </p>
                    ) : (
                      <div style={{ display: "grid", gap: "var(--space-md)" }}>
                        {waitingCandidates.map((invitation) => {
                          const candidate = invitation?.toCandidate || {};
                          const candidateId = getId(candidate);
                          return (
                            <div
                              key={invitation?._id}
                              style={{
                                border: "1px solid var(--line)",
                                borderRadius: "var(--radius-sm)",
                                padding: "var(--space-md)",
                              }}
                            >
                              <div style={{ fontWeight: 600 }}>
                                {candidate?.name || "Candidate"}
                              </div>
                              <div style={{ color: "var(--muted)" }}>
                                {invitation?.role || "Team role"}
                              </div>
                              <div
                                style={{
                                  color: "var(--muted)",
                                  margin: "4px 0 var(--space-sm)",
                                }}
                              >
                                Invitation: Accepted
                              </div>
                              {team ? (
                                <Button
                                  onClick={() =>
                                    handleAddMember(idea, invitation)
                                  }
                                  disabled={pendingCandidateId === candidateId}
                                >
                                  {pendingCandidateId === candidateId
                                    ? "Adding..."
                                    : "Add to Team"}
                                </Button>
                              ) : (
                                <Button variant="secondary" disabled>
                                  Create team first
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </section>
              );
            })}
          </div>
        )}

        {confirmation && (
          <div
            onClick={() => setConfirmation(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--space-md)",
              zIndex: 1000,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
              style={{
                background: "var(--surface)",
                borderRadius: "var(--radius-md)",
                width: "min(100%, 480px)",
                border: "1px solid var(--line)",
                boxShadow: "var(--shadow-lg)",
                padding: "var(--space-lg)",
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                Add {confirmation.candidateName} to Team?
              </h3>
              <p
                style={{
                  margin: "0 0 var(--space-md)",
                  color: "var(--muted)",
                }}
              >
                Role: {confirmation.role}
                <br />
                Project: {confirmation.ideaTitle}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "var(--space-sm)",
                  flexWrap: "wrap",
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => setConfirmation(null)}
                  disabled={pendingCandidateId !== null}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmAddMember}
                  disabled={pendingCandidateId !== null}
                >
                  {pendingCandidateId ? "Adding..." : "Add to Team"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default FounderTeamPage;
