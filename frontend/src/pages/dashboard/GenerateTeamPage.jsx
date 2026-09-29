import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import LoadingState from "../../components/common/LoadingState";
import ErrorState from "../../components/common/ErrorState";
import CandidateCard from "../../components/matching/CandidateCard";
import CandidateProfileModal from "../../components/matching/CandidateProfileModal";
import {
  groupMatchesByRequiredRoles,
  MAX_CANDIDATES_PER_ROLE,
} from "../../utils/matchGrouping";
import {
  searchMatches,
  sendInvitation,
  getIdeaById,
} from "../../services/matchingApi";

const DEFAULT_FILTERS = {
  skills: "",
  level: "",
  domain: "",
  workMode: "",
  availability: "",
  minScore: "",
};

const getUserFriendlyError = (err, fallback = "Something went wrong") => {
  const status = err?.status || err?.response?.status;

  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403) return "You do not have permission to view this idea.";
  if (status === 404) return "The idea could not be found.";
  if (status === 409) {
    const code = err?.response?.data?.code || err?.code;
    if (code === "INVITATION_CLOSED") {
      return "A previous invitation was withdrawn. You can send a new invitation for this candidate.";
    }
    if (code === "INVITATION_EXISTS") {
      return "This candidate already has an active invitation for this idea.";
    }
    if (code === "INVITATION_DECLINED") {
      return "A previous invitation was declined and cannot be reopened.";
    }
    return "This idea’s analysis is not approved yet. Please return to the analysis step and approve it before generating team recommendations.";
  }

  return err?.message || fallback;
};

const GenerateTeamPage = () => {
  const { ideaId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [idea, setIdea] = useState(null);
  const [analysisApproved, setAnalysisApproved] = useState(false);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [candidates, setCandidates] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    limit: 20,
    totalPages: 0,
  });
  const [generateTeamLoading, setGenerateTeamLoading] = useState(false);
  const [generateTeamError, setGenerateTeamError] = useState("");
  const [generateTeamResults, setGenerateTeamResults] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [sendError, setSendError] = useState("");
  const [activeTab, setActiveTab] = useState("generate");
  const [profileModal, setProfileModal] = useState({
    isOpen: false,
    candidateId: null,
    matchContext: {},
    roleContext: null,
  });
  const isMountedRef = useRef(true);
  const hasSearchedRef = useRef(false);

  const executeSearch = useCallback(
    async (page = 1) => {
      setSearching(true);
      setSendError("");

      try {
        const params = { page, limit: 20 };
        if (filters.skills?.trim()) params.skills = filters.skills.trim();
        if (filters.level?.trim()) params.level = filters.level.trim();
        if (filters.domain?.trim()) params.domain = filters.domain.trim();
        if (filters.workMode?.trim()) params.workMode = filters.workMode.trim();
        if (filters.availability?.trim())
          params.availability = filters.availability.trim();
        if (filters.minScore) params.minScore = parseInt(filters.minScore, 10);

        const data = await searchMatches(ideaId, params);
        if (!isMountedRef.current) return;

        setCandidates(data.matches || []);
        setPagination({
          page: data.pagination?.page || page,
          total: data.pagination?.total || 0,
          limit: data.pagination?.limit || 20,
          totalPages:
            data.pagination?.totalPages ||
            Math.ceil(
              (data.pagination?.total || 0) / (data.pagination?.limit || 20),
            ),
        });
      } catch (err) {
        if (isMountedRef.current)
          setError(getUserFriendlyError(err, "Search failed"));
      } finally {
        if (isMountedRef.current) setSearching(false);
      }
    },
    [ideaId, filters],
  );

  const executeGenerateTeam = useCallback(
    async (rolesAndSkills = []) => {
      setGenerateTeamLoading(true);
      setGenerateTeamError("");

      try {
        const data = await searchMatches(ideaId, {
          page: 1,
          limit: 50,
          minScore: 0,
        });

        if (!isMountedRef.current) return;

        const grouped = groupMatchesByRequiredRoles(
          rolesAndSkills,
          data.matches || [],
        );
        setGenerateTeamResults(grouped);
      } catch (err) {
        if (isMountedRef.current) {
          setGenerateTeamError(
            getUserFriendlyError(err, "Failed to load recommendations"),
          );
        }
      } finally {
        if (isMountedRef.current) setGenerateTeamLoading(false);
      }
    },
    [ideaId],
  );

  useEffect(() => {
    isMountedRef.current = true;

    const loadIdea = async () => {
      if (!isMountedRef.current) return;
      setLoading(true);
      setError("");

      try {
        const data = await getIdeaById(ideaId);
        if (!isMountedRef.current) return;

        const ideaData = data.idea || data;
        const approved = ideaData?.aiAnalysis?.isApproved === true;

        setIdea(ideaData);
        setAnalysisApproved(approved);

        if (approved && !hasSearchedRef.current) {
          hasSearchedRef.current = true;
          setActiveTab("generate");
          executeGenerateTeam(ideaData.aiAnalysis?.rolesAndSkills || []);
          executeSearch(1);
        }

        if (!approved) {
          setActiveTab("generate");
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(getUserFriendlyError(err, "Failed to load idea"));
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };

    loadIdea();
    return () => {
      isMountedRef.current = false;
    };
  }, [ideaId, executeGenerateTeam, executeSearch]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    executeSearch(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      executeSearch(newPage);
    }
  };

  const handleSendRequest = async (candidate, match) => {
    const candidateId = candidate?._id || candidate?.id;
    if (!candidateId) return;

    setSendingId(candidateId);
    setSendError("");

    try {
      const role = match?.roleMatches?.[0] || match?.role || "Team Member";
      await sendInvitation(ideaId, candidateId, role, "");
      if (activeTab === "generate") {
        executeGenerateTeam(rolesAndSkills);
      } else {
        executeSearch(pagination.page);
      }
    } catch (err) {
      setSendError(getUserFriendlyError(err, "Failed to send request"));
    } finally {
      setSendingId(null);
    }
  };

  const handleViewProfile = (candidate, match) => {
    const candidateId = candidate?._id || candidate?.id;
    if (!candidateId) return;

    setProfileModal({
      isOpen: true,
      candidateId,
      matchContext: match || {},
      roleContext: match?.role || null,
      ideaId: ideaId,
      ideaTitle: idea?.enhanced?.title || idea?.title || "Idea",
      ideaDescription: idea?.enhanced?.description || idea?.description || "",
      ideaProblem: idea?.enhanced?.problem || idea?.problemStatement || "",
      ideaSolution: idea?.enhanced?.solution || "",
      ideaTargetAudience: idea?.enhanced?.targetAudience || idea?.targetUsers || "",
    });
  };

  const closeProfileModal = () => {
    setProfileModal({
      isOpen: false,
      candidateId: null,
      matchContext: {},
      roleContext: null,
    });
  };

  const rolesAndSkills = idea?.aiAnalysis?.rolesAndSkills || [];
  const ideaTitle = idea?.title || "Idea";

  const handleInvitationStateChange = useCallback(() => {
    if (activeTab === "generate") {
      executeGenerateTeam(idea?.aiAnalysis?.rolesAndSkills || []);
    } else {
      executeSearch(pagination.page);
    }
  }, [
    activeTab,
    executeGenerateTeam,
    executeSearch,
    idea,
    pagination.page,
  ]);

  if (loading) {
    return (
      <AppLayout>
        <LoadingState label="Loading your team generation..." />
      </AppLayout>
    );
  }

  if (error && !idea) {
    return (
      <AppLayout>
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ padding: "var(--space-lg)", maxWidth: "1200px" }}>
        <header style={{ marginBottom: "var(--space-lg)" }}>
          <h1>Generate Team</h1>
          <p style={{ color: "var(--muted)" }}>
            {ideaTitle} — Find the right people for your startup.
          </p>
        </header>

        {!analysisApproved ? (
          <Card style={{ borderColor: "var(--accent)", maxWidth: "700px" }}>
            <h2>Analysis Approval Required</h2>
            <p style={{ color: "var(--muted)" }}>
              You need to approve your critical analysis before you can generate
              a team. This ensures the recommendations are based on your
              validated requirements.
            </p>
            <div style={{ marginTop: "var(--space-md)" }}>
              <Button
                onClick={() => {
                  window.location.href = `/app/ideas/${ideaId}/analysis`;
                }}
              >
                Go to Analysis
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                gap: "var(--space-md)",
                marginBottom: "var(--space-lg)",
                flexWrap: "wrap",
              }}
            >
              <Button
                variant={activeTab === "generate" ? "primary" : "secondary"}
                onClick={() => {
                  setActiveTab("generate");
                  if (!generateTeamResults) {
                    executeGenerateTeam(rolesAndSkills);
                  }
                }}
              >
                Generate Team
              </Button>
              <Button
                variant={activeTab === "candidates" ? "primary" : "secondary"}
                onClick={() => setActiveTab("candidates")}
              >
                Candidates
              </Button>
              <Button
                variant={activeTab === "requirements" ? "primary" : "secondary"}
                onClick={() => setActiveTab("requirements")}
              >
                Requirements
              </Button>
            </div>

            {activeTab === "generate" && (
              <>
                {generateTeamLoading && (
                  <LoadingState label="Finding candidates... Matching students with your required roles and skills..." />
                )}

                {generateTeamError && (
                  <Card
                    style={{
                      marginBottom: "var(--space-md)",
                      borderColor: "var(--danger)",
                    }}
                  >
                    <p style={{ color: "var(--danger)" }}>
                      {generateTeamError}
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => executeGenerateTeam(rolesAndSkills)}
                    >
                      Try Again
                    </Button>
                  </Card>
                )}

                {!generateTeamLoading &&
                  !generateTeamError &&
                  generateTeamResults && (
                    <>
                      {generateTeamResults.length === 0 && (
                        <Card>
                          <h3>No matching candidates found yet.</h3>
                          <p style={{ color: "var(--muted)" }}>
                            No role-wise recommendations could be generated. Try
                            the Candidates tab to search manually.
                          </p>
                        </Card>
                      )}

                      {generateTeamResults.length > 0 && (
                        <div
                          style={{ display: "grid", gap: "var(--space-lg)" }}
                        >
                          {generateTeamResults.map((roleGroup, idx) => (
                            <Card
                              key={idx}
                              style={{ padding: "var(--space-lg)" }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: "var(--space-md)",
                                  marginBottom: "var(--space-md)",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div>
                                  <h2 style={{ margin: 0 }}>
                                    {roleGroup.role}
                                  </h2>
                                  {(roleGroup.skills || []).length > 0 && (
                                    <p
                                      style={{
                                        color: "var(--muted)",
                                        fontSize: "0.9rem",
                                        margin: "4px 0 0 0",
                                      }}
                                    >
                                      Required skills:{" "}
                                      {(roleGroup.skills || []).join(", ")}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="accent">
                                  {roleGroup.candidates.length} candidate
                                  {roleGroup.candidates.length !== 1 ? "s" : ""}
                                  {" found"}
                                </Badge>
                              </div>

                              {roleGroup.candidates.length === 0 ? (
                                <p style={{ color: "var(--muted)", margin: 0 }}>
                                  No matching candidates found for this role
                                  yet.
                                </p>
                              ) : (
                                <div
                                  style={{
                                    display: "grid",
                                    gap: "var(--space-md)",
                                  }}
                                >
                                  {roleGroup.candidates
                                    .slice(0, MAX_CANDIDATES_PER_ROLE)
                                    .map((item, cidx) => (
                                      <CandidateCard
                                        key={
                                          item.candidate?._id ||
                                          item.candidate?.id ||
                                          cidx
                                        }
                                        candidate={item.candidate || {}}
                                        match={{
                                          ...(item.explanation || {}),
                                          score: item.score,
                                          invitationStatus:
                                            item.invitationStatus,
                                          invitationId: item.invitationId,
                                          teamId: item.teamId,
                                          role: roleGroup.role,
                                          requiredSkills: roleGroup.skills,
                                          matchedRoles: item.matchedRoles,
                                        }}
                                        onSendRequest={handleSendRequest}
                                        onViewProfile={handleViewProfile}
                                        sending={
                                          sendingId ===
                                          (item.candidate?._id ||
                                            item.candidate?.id)
                                        }
                                        sendError={sendError}
                                      />
                                    ))}
                                </div>
                              )}
                            </Card>
                          ))}
                        </div>
                      )}
                    </>
                  )}
              </>
            )}

            {activeTab === "requirements" && (
              <Card style={{ marginBottom: "var(--space-lg)" }}>
                <h2>Required Team Skills &amp; Roles</h2>
                {rolesAndSkills.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gap: "var(--space-md)",
                      marginTop: "var(--space-md)",
                    }}
                  >
                    {rolesAndSkills.map((roleSkill, idx) => (
                      <Card key={idx} style={{ padding: "var(--space-md)" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "var(--space-sm)",
                            alignItems: "center",
                            gap: "var(--space-sm)",
                            flexWrap: "wrap",
                          }}
                        >
                          <h4 style={{ margin: 0 }}>{roleSkill.role}</h4>
                          <Badge
                            variant={
                              roleSkill.priority === "must-have" ? "accent" : ""
                            }
                          >
                            {roleSkill.priority}
                          </Badge>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "var(--space-xs)",
                            marginBottom: "var(--space-sm)",
                          }}
                        >
                          {(roleSkill.skills || []).map((s, i) => (
                            <Badge key={i} variant="accent">
                              {s}
                            </Badge>
                          ))}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "var(--space-md)",
                            fontSize: "0.85rem",
                            color: "var(--muted)",
                            flexWrap: "wrap",
                          }}
                        >
                          <span>Experience: {roleSkill.experienceLevel}</span>
                          <span>Count: {roleSkill.count}</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
                {rolesAndSkills.length === 0 && (
                  <p
                    style={{
                      color: "var(--muted)",
                      marginTop: "var(--space-md)",
                    }}
                  >
                    No role requirements defined yet. Complete your analysis
                    first.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "candidates" && (
              <>
                <Card style={{ marginBottom: "var(--space-lg)" }}>
                  <form onSubmit={handleSearch}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "var(--space-md)",
                        alignItems: "end",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "4px",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                          }}
                        >
                          Skills
                        </label>
                        <input
                          type="text"
                          value={filters.skills}
                          onChange={(e) =>
                            handleFilterChange("skills", e.target.value)
                          }
                          placeholder="e.g. React, Python"
                          style={{
                            width: "100%",
                            padding: "var(--space-sm)",
                            border: "1px solid var(--line)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "0.9rem",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "4px",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                          }}
                        >
                          Level
                        </label>
                        <select
                          value={filters.level}
                          onChange={(e) =>
                            handleFilterChange("level", e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "var(--space-sm)",
                            border: "1px solid var(--line)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "0.9rem",
                            boxSizing: "border-box",
                            background: "var(--surface)",
                          }}
                        >
                          <option value="">Any Level</option>
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                        </select>
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "4px",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                          }}
                        >
                          Domain
                        </label>
                        <input
                          type="text"
                          value={filters.domain}
                          onChange={(e) =>
                            handleFilterChange("domain", e.target.value)
                          }
                          placeholder="e.g. Fintech"
                          style={{
                            width: "100%",
                            padding: "var(--space-sm)",
                            border: "1px solid var(--line)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "0.9rem",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "4px",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                          }}
                        >
                          Work Mode
                        </label>
                        <select
                          value={filters.workMode}
                          onChange={(e) =>
                            handleFilterChange("workMode", e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "var(--space-sm)",
                            border: "1px solid var(--line)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "0.9rem",
                            boxSizing: "border-box",
                            background: "var(--surface)",
                          }}
                        >
                          <option value="">Any</option>
                          <option value="remote">Remote</option>
                          <option value="hybrid">Hybrid</option>
                          <option value="in-person">In-person</option>
                        </select>
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "4px",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                          }}
                        >
                          Availability
                        </label>
                        <select
                          value={filters.availability}
                          onChange={(e) =>
                            handleFilterChange("availability", e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "var(--space-sm)",
                            border: "1px solid var(--line)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "0.9rem",
                            boxSizing: "border-box",
                            background: "var(--surface)",
                          }}
                        >
                          <option value="">Any</option>
                          <option value="full-time">Full-time</option>
                          <option value="part-time">Part-time</option>
                          <option value="flexible">Flexible</option>
                        </select>
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "4px",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                          }}
                        >
                          Min Score
                        </label>
                        <input
                          type="number"
                          value={filters.minScore}
                          onChange={(e) =>
                            handleFilterChange("minScore", e.target.value)
                          }
                          placeholder="40"
                          min="0"
                          max="100"
                          style={{
                            width: "100%",
                            padding: "var(--space-sm)",
                            border: "1px solid var(--line)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "0.9rem",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <Button type="submit" disabled={searching}>
                          {searching ? "Searching..." : "Search"}
                        </Button>
                      </div>
                    </div>
                  </form>
                </Card>

                {sendError && (
                  <Card
                    style={{
                      marginBottom: "var(--space-md)",
                      borderColor: "var(--danger)",
                    }}
                  >
                    <p style={{ color: "var(--danger)" }}>{sendError}</p>
                  </Card>
                )}

                {searching && candidates.length === 0 && (
                  <LoadingState label="Searching for candidates..." />
                )}

                {!searching && candidates.length === 0 && (
                  <Card
                    style={{
                      textAlign: "center",
                      marginBottom: "var(--space-lg)",
                    }}
                  >
                    <h3>No candidates found</h3>
                    <p style={{ color: "var(--muted)" }}>
                      Try adjusting your filters or search criteria.
                    </p>
                  </Card>
                )}

                {!searching && candidates.length > 0 && (
                  <>
                    <p
                      style={{
                        color: "var(--muted)",
                        marginBottom: "var(--space-md)",
                      }}
                    >
                      Showing {candidates.length} match
                      {candidates.length !== 1 ? "es" : ""}
                      {pagination.total > 0 && ` of ${pagination.total}`}
                    </p>
                    <div style={{ display: "grid", gap: "var(--space-md)" }}>
                      {candidates.map((item, idx) => (
                        <CandidateCard
                          key={item.candidate?._id || item.candidate?.id || idx}
                          candidate={item.candidate || item}
                          match={item.match || item}
                          onSendRequest={handleSendRequest}
                          onViewProfile={handleViewProfile}
                          sending={
                            sendingId ===
                            (item.candidate?._id || item.candidate?.id)
                          }
                          sendError={sendError}
                        />
                      ))}
                    </div>

                    {pagination.totalPages > 1 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: "var(--space-sm)",
                          marginTop: "var(--space-lg)",
                        }}
                      >
                        <Button
                          variant="secondary"
                          disabled={pagination.page <= 1}
                          onClick={() => handlePageChange(pagination.page - 1)}
                        >
                          Previous
                        </Button>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "0 var(--space-md)",
                            color: "var(--ink)",
                            fontWeight: 600,
                          }}
                        >
                          Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <Button
                          variant="secondary"
                          disabled={pagination.page >= pagination.totalPages}
                          onClick={() => handlePageChange(pagination.page + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      <CandidateProfileModal
        isOpen={profileModal.isOpen}
        onClose={closeProfileModal}
        candidateId={profileModal.candidateId}
        matchContext={profileModal.matchContext}
        roleContext={profileModal.roleContext}
        ideaId={profileModal.ideaId}
        ideaTitle={profileModal.ideaTitle}
        ideaDescription={profileModal.ideaDescription}
        onInvitationStateChange={handleInvitationStateChange}
      />
    </AppLayout>
  );
};

export default GenerateTeamPage;
