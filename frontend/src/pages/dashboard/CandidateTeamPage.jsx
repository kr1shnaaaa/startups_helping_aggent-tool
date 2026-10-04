import { useCallback, useEffect, useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import { useAuth } from "../../hooks/useAuth";
import { listTeams } from "../../services/matchingApi";
import { getIdeaById } from "../../services/ideaApi";

const normalizeTeams = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.teams)) return payload.teams;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
};

const getIdeaId = (ideaRef) => {
  if (!ideaRef) return null;
  if (typeof ideaRef === "string") return ideaRef;
  if (typeof ideaRef === "object" && ideaRef._id) return String(ideaRef._id);
  return null;
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

const CandidateTeamPage = () => {
  const { profile } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTeams = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await listTeams();
      const nextTeams = normalizeTeams(response);
      const ideaTitles = {};

      await Promise.all(
        nextTeams.map(async (team) => {
          const ideaId = getIdeaId(team?.ideaId);
          if (!ideaId) return;

          try {
            const ideaResponse = await getIdeaById(ideaId);
            const idea = ideaResponse?.idea || ideaResponse;
            ideaTitles[ideaId] = idea?.title || "";
          } catch {
            ideaTitles[ideaId] = "";
          }
        }),
      );

      setTeams(
        nextTeams.map((team) => ({
          ...team,
          ideaTitle:
            ideaTitles[getIdeaId(team?.ideaId)] ||
            (typeof team?.ideaId === "object" ? team.ideaId.title : "") ||
            team?.name ||
            "Startup team",
        })),
      );
    } catch (requestError) {
      const status = requestError?.status || requestError?.response?.status;
      if (status === 401) {
        setError("Your session has expired. Please sign in again.");
      } else {
        setError("Unable to load your teams.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  const currentUserId = profile?._id ? String(profile._id) : "";

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
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 2.7rem)" }}>
            My Team
          </h1>
          <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
            Review the startups and team memberships you are part of.
          </p>
        </div>

        {loading && (
          <Card>
            <p style={{ margin: 0 }}>Loading your teams...</p>
          </Card>
        )}

        {!loading && error && (
          <Card>
            <h3 style={{ marginTop: 0 }}>Unable to load your teams.</h3>
            <p>{error}</p>
            <Button onClick={loadTeams}>Retry</Button>
          </Card>
        )}

        {!loading && !error && teams.length === 0 && (
          <Card>
            <h3 style={{ marginTop: 0 }}>You are not part of any team yet.</h3>
            <p style={{ marginBottom: 0 }}>
              Accepted invitations will appear here once you are added to a
              team.
            </p>
          </Card>
        )}

        {!loading && !error && teams.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: "var(--space-md)",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            }}
          >
            {teams.map((team) => {
              const founder =
                typeof team?.founderId === "object" && team.founderId
                  ? team.founderId.name || "Founder"
                  : "Founder";
              const ideaTitle = team?.ideaTitle || team?.name || "Startup team";
              const memberList = Array.isArray(team?.members)
                ? team.members
                : [];

              return (
                <Card key={team?._id || team?.name || Math.random().toString()}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "var(--space-sm)",
                      marginBottom: "var(--space-md)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: "var(--muted)",
                          fontSize: "0.8rem",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        Team
                      </div>
                      <h3 style={{ margin: "6px 0 0" }}>
                        {team?.name || "Startup team"}
                      </h3>
                    </div>
                    <Badge
                      variant={team?.status === "Active" ? "accent" : "neutral"}
                    >
                      {team?.status || "Active"}
                    </Badge>
                  </div>

                  <div
                    style={{
                      marginBottom: "var(--space-md)",
                      color: "var(--muted)",
                    }}
                  >
                    <strong>Idea:</strong> {ideaTitle}
                  </div>

                  <div
                    style={{
                      marginBottom: "var(--space-md)",
                      color: "var(--muted)",
                    }}
                  >
                    <strong>Founder:</strong> {founder}
                  </div>

                  <div style={{ marginBottom: "var(--space-md)" }}>
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.8rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: "var(--space-sm)",
                      }}
                    >
                      Team members
                    </div>
                    <div style={{ display: "grid", gap: "var(--space-sm)" }}>
                      {memberList.length === 0 ? (
                        <p style={{ margin: 0, color: "var(--muted)" }}>
                          No members listed yet.
                        </p>
                      ) : (
                        memberList.map((member, index) => {
                          const memberUser =
                            typeof member?.userId === "object" && member.userId
                              ? member.userId
                              : {};
                          const memberName =
                            memberUser.name || `Member ${index + 1}`;
                          const memberRole = member?.role || "Team member";
                          const isCurrentUser =
                            String(memberUser._id || member?.userId) ===
                            currentUserId;

                          return (
                            <div
                              key={`${member?.userId?._id || member?.userId || "member"}-${index}`}
                              style={{
                                border: "1px solid var(--line)",
                                borderRadius: "var(--radius-sm)",
                                padding: "var(--space-sm)",
                              }}
                            >
                              <div style={{ fontWeight: 600 }}>
                                {memberName}
                                {isCurrentUser && " (You)"}
                              </div>
                              <div
                                style={{
                                  color: "var(--muted)",
                                  marginTop: "4px",
                                }}
                              >
                                {memberRole}
                              </div>
                              {member?.joinedAt && (
                                <div
                                  style={{
                                    color: "var(--muted)",
                                    marginTop: "4px",
                                  }}
                                >
                                  Joined: {formatDate(member.joinedAt)}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default CandidateTeamPage;
