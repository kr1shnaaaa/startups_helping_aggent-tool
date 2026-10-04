import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import { useAuth } from "../../hooks/useAuth";
import {
  addTeamMember,
  getIdeaById,
  listInvitations,
  listTeams,
} from "../../services/matchingApi";

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.invitations)) return payload.invitations;
  if (payload && Array.isArray(payload.teams)) return payload.teams;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
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
  const [teams, setTeams] = useState([]);
  const [acceptedInvitations, setAcceptedInvitations] = useState([]);
  const [ideaTitles, setIdeaTitles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingCandidateId, setPendingCandidateId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [teamResponse, invitationResponse] = await Promise.all([
        listTeams(),
        listInvitations("sent", "Accepted"),
      ]);

      const nextTeams = normalizeList(teamResponse);
      const nextInvitations = normalizeList(invitationResponse);
      setTeams(nextTeams);
      setAcceptedInvitations(nextInvitations);

      const uniqueIdeaIds = Array.from(
        new Set(
          [...nextTeams.map((team) => team?.ideaId?._id || team?.ideaId), ...nextInvitations.map((invitation) => invitation?.ideaId?._id || invitation?.ideaId)],
        ).filter(Boolean),
      );

      const titles = {};
      await Promise.all(
        uniqueIdeaIds.map(async (ideaId) => {
          try {
            const result = await getIdeaById(ideaId);
            const idea = result?.idea || result;
            titles[ideaId] = idea?.title || "Startup idea";
          } catch {
            titles[ideaId] = "Startup idea";
          }
        }),
      );

      setIdeaTitles(titles);
    } catch (requestError) {
      const status = requestError?.status || requestError?.response?.status;
      if (status === 401) {
        setError("Your session has expired. Please sign in again.");
      } else {
        setError("Unable to load your team and accepted candidates.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const teamLookup = useMemo(() => {
    const map = {};
    teams.forEach((team) => {
      const ideaId = team?.ideaId?._id || team?.ideaId;
      if (ideaId) map[String(ideaId)] = team;
    });
    return map;
  }, [teams]);

  const handleAddMember = async (invitation) => {
    const ideaId = invitation?.ideaId?._id || invitation?.ideaId;
    const team = teamLookup[String(ideaId)];
    const candidateId = invitation?.toCandidate?._id || invitation?.toCandidate;

    if (!team || !team._id) {
      setError("Create a team for this idea before adding candidates.");
      return;
    }

    if (!candidateId) {
      setError("Candidate details are unavailable for this invitation.");
      return;
    }

    setPendingCandidateId(candidateId);
    setConfirmation({
      candidateName: invitation?.toCandidate?.name || "this candidate",
      role: invitation?.role || "Team member",
      ideaTitle: ideaTitles[String(ideaId)] || "this idea",
      teamId: team._id,
      candidateId,
    });
  };

  const confirmAddMember = async () => {
    if (!confirmation) return;
    setPendingCandidateId(confirmation.candidateId);
    try {
      await addTeamMember(confirmation.teamId, confirmation.candidateId);
      setConfirmation(null);
      await loadData();
    } catch (requestError) {
      const status = requestError?.status || requestError?.response?.status;
      const message = requestError?.response?.data?.message || requestError?.message || "Unable to add this candidate to the team.";
      if (status === 409) {
        setError(message);
      } else if (status === 403) {
        setError("Only the team founder can add members.");
      } else {
        setError(message);
      }
    } finally {
      setPendingCandidateId(null);
    }
  };

  return (
    <AppLayout>
      <div style={{ padding: "var(--space-lg)", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h1 style={{ margin: 0 }}>My Team</h1>
          <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
            Review accepted candidates and add them to your team.
          </p>
        </div>

        {loading && (
          <Card>
            <p style={{ margin: 0 }}>Loading your team and accepted candidates...</p>
          </Card>
        )}

        {!loading && error && (
          <Card>
            <h3 style={{ marginTop: 0 }}>Unable to load your team.</h3>
            <p>{error}</p>
            <Button onClick={loadData}>Retry</Button>
          </Card>
        )}

        {!loading && !error && (
          <>
            {teams.length > 0 && (
              <div style={{ display: "grid", gap: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
                {teams.map((team) => {
                  const memberList = Array.isArray(team?.members) ? team.members : [];
                  const ideaId = team?.ideaId?._id || team?.ideaId;
                  const ideaTitle = ideaTitles[String(ideaId)] || team?.name || "Startup team";
                  const founderName = team?.founderId?.name || profile?.name || "Founder";

                  return (
                    <Card key={team?._id || team?.name || "team-card"}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                        <div>
                          <div style={{ color: "var(--muted)", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Team</div>
                          <h3 style={{ margin: "6px 0 0" }}>{team?.name || "Startup team"}</h3>
                        </div>
                        <Badge variant="accent">{team?.status || "Active"}</Badge>
                      </div>

                      <div style={{ marginBottom: "var(--space-md)", color: "var(--muted)" }}>
                        <strong>Idea:</strong> {ideaTitle}
                      </div>

                      <div style={{ marginBottom: "var(--space-md)", color: "var(--muted)" }}>
                        <strong>Founder:</strong> {founderName}
                      </div>

                      <div>
                        <div style={{ color: "var(--muted)", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "var(--space-sm)" }}>
                          Team members
                        </div>

                        {memberList.length === 0 ? (
                          <p style={{ margin: 0, color: "var(--muted)" }}>No members listed yet.</p>
                        ) : (
                          <div style={{ display: "grid", gap: "var(--space-sm)" }}>
                            {memberList.map((member, index) => {
                              const memberUser = member?.userId && typeof member.userId === "object" ? member.userId : {};
                              const memberName = memberUser.name || `Member ${index + 1}`;
                              return (
                                <div key={`${member?.userId?._id || "member"}-${index}`} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "var(--space-sm)" }}>
                                  <div style={{ fontWeight: 600 }}>{memberName}</div>
                                  <div style={{ color: "var(--muted)", marginTop: "4px" }}>{member?.role || "Team member"}</div>
                                  {member?.joinedAt && (
                                    <div style={{ color: "var(--muted)", marginTop: "4px" }}>Joined: {formatDate(member.joinedAt)}</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            <Card>
              <h3 style={{ marginTop: 0 }}>Accepted invitations</h3>
              {acceptedInvitations.length === 0 ? (
                <p style={{ marginBottom: 0 }}>No accepted candidates are waiting to be added to a team yet.</p>
              ) : (
                <div style={{ display: "grid", gap: "var(--space-md)" }}>
                  {acceptedInvitations.map((invitation) => {
                    const ideaId = invitation?.ideaId?._id || invitation?.ideaId;
                    const candidate = invitation?.toCandidate || {};
                    const team = teamLookup[String(ideaId)];
                    const isMemberAlready = team?.members?.some((member) => String(member?.userId?._id || member?.userId) === String(candidate?._id || candidate));

                    return (
                      <div key={invitation?._id} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", display: "grid", gap: "var(--space-sm)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{candidate?.name || "Candidate"}</div>
                            <div style={{ color: "var(--muted)" }}>{invitation?.role || "Team role"}</div>
                          </div>
                          <Badge variant="accent">Accepted</Badge>
                        </div>
                        <div style={{ color: "var(--muted)" }}>
                          <strong>Idea:</strong> {ideaTitles[String(ideaId)] || "Startup idea"}
                        </div>
                        <div style={{ color: "var(--muted)" }}>
                          <strong>Invitation:</strong> {formatDate(invitation?.createdAt)}
                        </div>
                        {isMemberAlready ? (
                          <Button variant="secondary" disabled>
                            Already on team
                          </Button>
                        ) : team ? (
                          <Button onClick={() => handleAddMember(invitation)} disabled={pendingCandidateId === (candidate?._id || candidate)}>
                            {pendingCandidateId === (candidate?._id || candidate) ? "Adding..." : "Add to Team"}
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
          </>
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
              <h3 style={{ marginTop: 0 }}>Add {confirmation.candidateName} to Team?</h3>
              <p style={{ margin: "0 0 var(--space-md)", color: "var(--muted)" }}>
                Role: {confirmation.role}
                <br />
                Project: {confirmation.ideaTitle}
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                <Button variant="secondary" onClick={() => setConfirmation(null)}>
                  Cancel
                </Button>
                <Button onClick={confirmAddMember}>
                  Add to Team
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
