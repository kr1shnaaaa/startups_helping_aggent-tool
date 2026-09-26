import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import LoadingState from "../../components/common/LoadingState";
import ErrorState from "../../components/common/ErrorState";
import CandidateCard from "../../components/matching/CandidateCard";
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
  const [sendingId, setSendingId] = useState(null);
  const [sendError, setSendError] = useState("");
  const [activeTab, setActiveTab] = useState("candidates");
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
            Math.ceil((data.pagination?.total || 0) / 20),
        });
      } catch (err) {
        if (isMountedRef.current) setError(err.message || "Search failed");
      } finally {
        if (isMountedRef.current) setSearching(false);
      }
    },
    [ideaId, filters],
  );

  useEffect(() => {
    isMountedRef.current = true;
    const loadIdea = async () => {
      if (!isMountedRef.current) return;
      setLoading(true);
      try {
        const data = await getIdeaById(ideaId);
        if (!isMountedRef.current) return;
        const ideaData = data.idea || data;
        setIdea(ideaData);
        setAnalysisApproved(ideaData?.aiAnalysis?.isApproved === true);
        if (ideaData?.aiAnalysis?.isApproved && !hasSearchedRef.current) {
          hasSearchedRef.current = true;
          executeSearch(1);
        }
      } catch (err) {
        if (isMountedRef.current)
          setError(err.message || "Failed to load idea");
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };
    loadIdea();
    return () => {
      isMountedRef.current = false;
    };
  }, [ideaId, executeSearch]);

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
    const candidateId = candidate._id || candidate.id;
    setSendingId(candidateId);
    setSendError("");
    try {
      const role = match?.roleMatches?.[0] || "Team Member";
      await sendInvitation(ideaId, candidateId, role, "");
      executeSearch(pagination.page);
    } catch (err) {
      setSendError(err.message || "Failed to send request");
    } finally {
      setSendingId(null);
    }
  };

  const rolesAndSkills = idea?.aiAnalysis?.rolesAndSkills || [];
  const ideaTitle = idea?.title || "Idea";

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
              a team. This ensures we match you with candidates who fit your
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
              }}
            >
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
    </AppLayout>
  );
};

export default GenerateTeamPage;
