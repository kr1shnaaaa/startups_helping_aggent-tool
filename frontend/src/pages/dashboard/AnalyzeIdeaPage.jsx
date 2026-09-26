import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import IdeaWorkflowProgress from "../../components/common/IdeaWorkflowProgress";
import {
  analyzeIdea,
  approveAnalysis,
  getIdeaById,
} from "../../services/ideaApi";

const AnalyzeIdeaPage = () => {
  const { ideaId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [ideaStatus, setIdeaStatus] = useState("analyzed");
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadAnalysisData = async () => {
      if (!ideaId) return;
      setLoading(true);
      setError("");
      try {
        const ideaData = await getIdeaById(ideaId);
        if (!isMounted) return;
        const currentIdea = ideaData.idea || ideaData;

        setIdeaStatus(currentIdea.status || "analyzed");
        const approved =
          currentIdea.aiAnalysis?.isApproved === true ||
          currentIdea.status === "matching";
        setIsApproved(approved);

        // If analysis already exists, load it directly without calling AI
        if (currentIdea.aiAnalysis && currentIdea.aiAnalysis.scoring) {
          setAnalysis(currentIdea.aiAnalysis);
        } else {
          // No analysis exists yet, generate initial analysis
          setAnalyzing(true);
          const data = await analyzeIdea(ideaId);
          if (isMounted) {
            setAnalysis(data.analysis);
            setIdeaStatus("analyzed");
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.message || "Failed to load idea analysis. Please try again.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setAnalyzing(false);
        }
      }
    };

    loadAnalysisData();

    return () => {
      isMounted = false;
    };
  }, [ideaId]);

  const handleApprove = async () => {
    setApproving(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await approveAnalysis(ideaId, true);
      setIsApproved(true);
      setIdeaStatus("matching");
      if (res.analysis) {
        setAnalysis(res.analysis);
      }
      setSuccessMsg(
        "Idea approved successfully! You can now start matching with candidates.",
      );
    } catch (err) {
      setError(err.message || "Failed to approve idea. Please try again.");
    } finally {
      setApproving(false);
    }
  };

  const handleReAnalyze = async () => {
    if (
      !window.confirm(
        "Do you want AI to run a fresh critical analysis based on your latest enhanced idea?",
      )
    ) {
      return;
    }
    setAnalyzing(true);
    setError("");
    setSuccessMsg("");
    try {
      const data = await analyzeIdea(ideaId);
      setAnalysis(data.analysis);
      setIdeaStatus("analyzed");
      setIsApproved(false);
      setSuccessMsg("AI analysis refreshed successfully!");
    } catch (err) {
      setError(err.message || "Re-analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading && !analysis) {
    return (
      <AppLayout>
        <div
          style={{
            padding: "var(--space-lg)",
            maxWidth: "1000px",
            textAlign: "center",
          }}
        >
          <p>
            {analyzing
              ? "📊 Running critical AI analysis and scoring on your idea..."
              : "Loading saved analysis..."}
          </p>
        </div>
      </AppLayout>
    );
  }

  if (error && !analysis) {
    return (
      <AppLayout>
        <div
          style={{
            padding: "var(--space-lg)",
            maxWidth: "700px",
            textAlign: "center",
          }}
        >
          <Card style={{ borderColor: "var(--danger)" }}>
            <p style={{ color: "var(--danger)" }}>Analysis failed: {error}</p>
            <div
              style={{
                display: "flex",
                gap: "var(--space-md)",
                justifyContent: "center",
                marginTop: "var(--space-md)",
              }}
            >
              <Button
                variant="secondary"
                onClick={() => navigate(`/app/ideas/${ideaId}/enhance`)}
              >
                ← Back to Enhanced Idea
              </Button>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!analysis) {
    return (
      <AppLayout>
        <div
          style={{
            padding: "var(--space-lg)",
            maxWidth: "800px",
            textAlign: "center",
          }}
        >
          <p>Loading...</p>
        </div>
      </AppLayout>
    );
  }

  const {
    scoring,
    evidence,
    rolesAndSkills,
    techStack,
    keyRequirements,
    nextSteps,
  } = analysis;

  return (
    <AppLayout>
      <div style={{ padding: "var(--space-lg)", maxWidth: "1000px" }}>
        <IdeaWorkflowProgress
          currentPhase={3}
          ideaId={ideaId}
          status={ideaStatus}
          isApproved={isApproved}
        />

        <header style={{ marginBottom: "var(--space-lg)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "var(--space-md)",
            }}
          >
            <div>
              <h1>Final Idea & Critical Analysis</h1>
              <p style={{ color: "var(--muted)" }}>
                Phase 3: Objective evaluation and deterministic scoring from AI
                evidence. Approve this analysis to unlock candidate matching.
              </p>
            </div>
            {isApproved && (
              <Badge
                variant="accent"
                style={{ padding: "8px 14px", fontSize: "0.95rem" }}
              >
                ✓ Idea Approved
              </Badge>
            )}
          </div>
        </header>

        {isApproved && (
          <Card
            style={{
              borderColor: "var(--accent)",
              background: "var(--accent-soft)",
              marginBottom: "var(--space-lg)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "var(--space-md)",
              }}
            >
              <div>
                <h3
                  style={{ margin: "0 0 4px 0", color: "var(--accent-dark)" }}
                >
                  ✓ This Startup Idea is Approved!
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: "var(--accent-dark)",
                    fontSize: "0.9rem",
                  }}
                >
                  All requirements, roles, and skills are locked for matching.
                  You can now discover and invite candidates.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => navigate(`/app/ideas/${ideaId}/matching`)}
              >
                👥 Generate Team & Match Candidates →
              </Button>
            </div>
          </Card>
        )}

        {successMsg && (
          <Card
            style={{
              borderColor: "var(--accent)",
              marginBottom: "var(--space-md)",
            }}
          >
            <p
              style={{
                color: "var(--accent-dark)",
                margin: 0,
                fontWeight: 600,
              }}
            >
              ✓ {successMsg}
            </p>
          </Card>
        )}

        {error && (
          <Card
            style={{
              borderColor: "var(--danger)",
              marginBottom: "var(--space-md)",
            }}
          >
            <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>
          </Card>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: "var(--space-lg)",
          }}
        >
          <div>
            <Card>
              <h2>Overall Assessment</h2>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-lg)",
                  marginBottom: "var(--space-lg)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ textAlign: "center", minWidth: "120px" }}>
                  <div
                    style={{
                      fontSize: "3rem",
                      fontWeight: 700,
                      color: "var(--accent)",
                    }}
                  >
                    {scoring?.overallScore} / 100
                  </div>
                  <div
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: 700,
                      color: "var(--accent-dark)",
                    }}
                  >
                    {scoring?.verdict}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                    <strong>How this works:</strong> Scores are calculated
                    deterministically on the backend from structured AI
                    evidence. These are decision-support signals designed to
                    help you build an effective team.
                  </p>
                </div>
              </div>

              <h3>Score Breakdown</h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: "var(--space-md)",
                }}
              >
                {scoring?.breakdown &&
                  Object.entries(scoring.breakdown).map(([key, value]) => (
                    <Card
                      key={key}
                      style={{
                        textAlign: "center",
                        padding: "var(--space-md)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "1.8rem",
                          fontWeight: 700,
                          color: "var(--ink)",
                        }}
                      >
                        {value}
                      </div>
                      <div
                        style={{ color: "var(--muted)", fontSize: "0.85rem" }}
                      >
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </div>
                    </Card>
                  ))}
              </div>
            </Card>

            <Card className="mar-t">
              <h3>Required Team Skills & Roles</h3>
              <div style={{ display: "grid", gap: "var(--space-md)" }}>
                {rolesAndSkills?.map((role, idx) => (
                  <Card key={idx} style={{ padding: "var(--space-md)" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "var(--space-sm)",
                        alignItems: "center",
                      }}
                    >
                      <h4 style={{ margin: 0 }}>{role.role}</h4>
                      <Badge
                        variant={
                          role.priority === "must-have" ? "accent" : "neutral"
                        }
                      >
                        {role.priority}
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
                      {(role.skills || []).map((s, i) => (
                        <Badge key={i} style={{ fontSize: "0.8rem" }}>
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
                      <span>Experience: {role.experienceLevel}</span>
                      <span>Count: {role.count}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>

            <Card className="mar-t">
              <h3>Important Limitations & Assumptions</h3>
              <ul style={{ margin: 0, paddingLeft: "var(--space-lg)" }}>
                <li>
                  AI analysis is based on the information provided in the
                  enhanced concept.
                </li>
                <li>
                  Differentiation assessment is not proof of market uniqueness.
                </li>
                <li>
                  Market and user assumptions should be independently validated.
                </li>
                <li>
                  Scores are decision-support signals, not guaranteed business
                  outcomes.
                </li>
              </ul>
            </Card>

            <Card className="mar-t">
              <h3>Risks & Mitigation Areas</h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--space-md)",
                }}
              >
                <div>
                  <h4>Identified Risks</h4>
                  <ul style={{ margin: 0, paddingLeft: "var(--space-lg)" }}>
                    {evidence?.limits?.risks?.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Key Assumptions</h4>
                  <ul style={{ margin: 0, paddingLeft: "var(--space-lg)" }}>
                    {evidence?.limits?.assumptions?.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>

            <Card className="mar-t">
              <h3>Recommended Next Steps</h3>
              <ul style={{ margin: 0, paddingLeft: "var(--space-lg)" }}>
                {nextSteps?.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </Card>
          </div>

          <aside>
            <Card>
              <h3>Key Requirements</h3>
              <ul style={{ margin: 0, paddingLeft: "var(--space-lg)" }}>
                {keyRequirements?.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </Card>

            <Card className="mar-t">
              <h3>Recommended Tech Stack</h3>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-xs)",
                }}
              >
                {(techStack || []).map((t, i) => (
                  <Badge key={i}>{t}</Badge>
                ))}
              </div>
            </Card>

            <Card className="mar-t">
              <h3>Actions</h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-sm)",
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/app/ideas/${ideaId}`)}
                  style={{ width: "100%" }}
                >
                  View Full Idea Details
                </Button>
                <Button
                  variant="secondary"
                  disabled={analyzing}
                  onClick={handleReAnalyze}
                  style={{ width: "100%" }}
                >
                  {analyzing ? "Analyzing..." : "🔄 Re-run Analysis"}
                </Button>
              </div>
            </Card>
          </aside>
        </div>

        <div
          style={{
            display: "flex",
            gap: "var(--space-md)",
            marginTop: "var(--space-lg)",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="secondary"
            type="button"
            onClick={() => navigate(`/app/ideas/${ideaId}/enhance`)}
          >
            ← Back to Enhanced Idea
          </Button>

          <div
            style={{
              display: "flex",
              gap: "var(--space-md)",
              flexWrap: "wrap",
            }}
          >
            {!isApproved ? (
              <Button
                variant="primary"
                disabled={approving || analyzing}
                onClick={handleApprove}
              >
                {approving ? "Approving..." : "✓ Approve Idea & Continue"}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => navigate(`/app/ideas/${ideaId}/matching`)}
              >
                👥 Generate Team & Match Candidates →
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AnalyzeIdeaPage;
