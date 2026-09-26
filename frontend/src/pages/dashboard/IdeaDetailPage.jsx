import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import IdeaWorkflowProgress from "../../components/common/IdeaWorkflowProgress";
import { getIdeaById, deleteIdea } from "../../services/ideaApi";

const IdeaDetailPage = () => {
  const { ideaId } = useParams();
  const navigate = useNavigate();
  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const fetchIdea = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getIdeaById(ideaId);
        if (!isMounted) return;
        setIdea(data.idea || data);
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load idea details");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchIdea();

    return () => {
      isMounted = false;
    };
  }, [ideaId]);

  const handleDelete = async () => {
    if (idea?.aiAnalysis?.isApproved) {
      alert("Approved ideas cannot be deleted directly.");
      return;
    }
    if (
      window.confirm(
        "Are you sure you want to delete this idea? This cannot be undone.",
      )
    ) {
      try {
        await deleteIdea(ideaId);
        navigate("/app/ideas");
      } catch (err) {
        alert(err.message || "Failed to delete idea");
      }
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div
          style={{
            padding: "var(--space-lg)",
            maxWidth: "900px",
            textAlign: "center",
          }}
        >
          <p>Loading idea details...</p>
        </div>
      </AppLayout>
    );
  }

  if (error || !idea) {
    return (
      <AppLayout>
        <div
          style={{
            padding: "var(--space-lg)",
            maxWidth: "800px",
            textAlign: "center",
          }}
        >
          <Card style={{ borderColor: "var(--danger)" }}>
            <p style={{ color: "var(--danger)" }}>
              {error || "Idea not found"}
            </p>
            <Button onClick={() => navigate("/app/ideas")}>
              Back to My Ideas
            </Button>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const status = idea.status || "draft";
  const isApproved =
    idea.aiAnalysis?.isApproved === true || status === "matching";
  const isEnhanced = Boolean(idea.enhanced && idea.enhanced.description);
  const isAnalyzed = Boolean(idea.aiAnalysis && idea.aiAnalysis.scoring);

  const getStatusBadge = () => {
    if (isApproved) return <Badge variant="accent">✓ APPROVED</Badge>;
    switch (status) {
      case "draft":
        return <Badge>RAW DRAFT</Badge>;
      case "enhancing":
        return <Badge>ENHANCING...</Badge>;
      case "enhanced":
        return <Badge variant="accent">ENHANCED</Badge>;
      case "analyzing":
        return <Badge>ANALYZING...</Badge>;
      case "analyzed":
        return <Badge variant="accent">ANALYSIS READY</Badge>;
      default:
        return <Badge>{status.toUpperCase()}</Badge>;
    }
  };

  const getPrimaryAction = () => {
    if (isApproved) {
      return {
        label: "👥 Generate Team & Match Candidates →",
        onClick: () => navigate(`/app/ideas/${ideaId}/matching`),
        variant: "primary",
      };
    }
    if (isAnalyzed) {
      return {
        label: "✅ Review & Approve Analysis →",
        onClick: () => navigate(`/app/ideas/${ideaId}/analysis`),
        variant: "primary",
      };
    }
    if (isEnhanced) {
      return {
        label: "📊 Proceed to Critical Analysis →",
        onClick: () => navigate(`/app/ideas/${ideaId}/analysis`),
        variant: "primary",
      };
    }
    return {
      label: "✨ Enhance Raw Idea →",
      onClick: () => navigate(`/app/ideas/${ideaId}/enhance`),
      variant: "primary",
    };
  };

  const primaryAction = getPrimaryAction();
  const displayTitle = idea.enhanced?.title || idea.title;

  return (
    <AppLayout>
      <div style={{ padding: "var(--space-lg)", maxWidth: "1000px" }}>
        <IdeaWorkflowProgress
          currentPhase={isApproved ? 3 : isAnalyzed ? 3 : isEnhanced ? 2 : 1}
          ideaId={ideaId}
          status={status}
          isApproved={isApproved}
        />

        {/* Top Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "var(--space-lg)",
            gap: "var(--space-md)",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                gap: "var(--space-sm)",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              {getStatusBadge()}
              {idea.domain && <Badge>{idea.domain}</Badge>}
              {idea.category && <Badge>{idea.category}</Badge>}
              {idea.aiAnalysis?.scoring?.overallScore && (
                <Badge variant="accent">
                  Score: {idea.aiAnalysis.scoring.overallScore}/100 •{" "}
                  {idea.aiAnalysis.scoring.verdict}
                </Badge>
              )}
            </div>
            <h1 style={{ margin: "0 0 8px 0" }}>{displayTitle}</h1>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
              Created on {new Date(idea.createdAt).toLocaleDateString()} • Last
              updated {new Date(idea.updatedAt).toLocaleDateString()}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "var(--space-sm)",
              flexWrap: "wrap",
            }}
          >
            <Button variant="secondary" onClick={() => navigate("/app/ideas")}>
              ← My Ideas
            </Button>
            <Button
              variant={primaryAction.variant}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          </div>
        </div>

        {/* Callout Banner based on state */}
        {isApproved ? (
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
                  ✓ Idea is Approved and in Matching Phase
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: "var(--accent-dark)",
                    fontSize: "0.9rem",
                  }}
                >
                  All requirements and required skills are locked. You can
                  discover candidates, review match compatibility scores, and
                  send invitations.
                </p>
              </div>
              <Button onClick={() => navigate(`/app/ideas/${ideaId}/matching`)}>
                Find Candidates
              </Button>
            </div>
          </Card>
        ) : null}

        <div style={{ display: "grid", gap: "var(--space-lg)" }}>
          {/* Phase 1 Card: Raw Idea */}
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-md)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-sm)",
                }}
              >
                <span
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}
                >
                  1.
                </span>
                <h3 style={{ margin: 0 }}>Raw Startup Idea</h3>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate(`/app/ideas/${ideaId}/raw`)}
              >
                Edit Raw Idea
              </Button>
            </div>

            <div
              style={{
                background: "var(--canvas)",
                padding: "var(--space-md)",
                borderRadius: "var(--radius-sm)",
                marginBottom: "var(--space-sm)",
              }}
            >
              <strong>Title:</strong> {idea.original?.title || idea.title}
            </div>
            <div
              style={{
                background: "var(--canvas)",
                padding: "var(--space-md)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <strong>Pitch / Description:</strong>
              <p style={{ margin: "8px 0 0 0", whiteSpace: "pre-wrap" }}>
                {idea.original?.description || idea.description}
              </p>
            </div>
          </Card>

          {/* Phase 2 Card: Enhanced Idea */}
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-md)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-sm)",
                }}
              >
                <span
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}
                >
                  2.
                </span>
                <h3 style={{ margin: 0 }}>Enhanced Concept</h3>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate(`/app/ideas/${ideaId}/enhance`)}
              >
                {isEnhanced ? "Review & Edit Enhanced" : "✨ Enhance with AI"}
              </Button>
            </div>

            {isEnhanced ? (
              <div style={{ display: "grid", gap: "var(--space-sm)" }}>
                <div
                  style={{
                    background: "var(--canvas)",
                    padding: "var(--space-md)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <strong>Enhanced Title:</strong> {idea.enhanced.title}
                </div>
                <div
                  style={{
                    background: "var(--canvas)",
                    padding: "var(--space-md)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <strong>Refined Description:</strong>
                  <p style={{ margin: "8px 0 0 0" }}>
                    {idea.enhanced.description}
                  </p>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                    gap: "var(--space-sm)",
                  }}
                >
                  {idea.enhanced.problem && (
                    <div
                      style={{
                        background: "var(--canvas)",
                        padding: "var(--space-md)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <strong>Problem:</strong>
                      <p style={{ margin: "4px 0 0 0", fontSize: "0.9rem" }}>
                        {idea.enhanced.problem}
                      </p>
                    </div>
                  )}
                  {idea.enhanced.solution && (
                    <div
                      style={{
                        background: "var(--canvas)",
                        padding: "var(--space-md)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <strong>Solution:</strong>
                      <p style={{ margin: "4px 0 0 0", fontSize: "0.9rem" }}>
                        {idea.enhanced.solution}
                      </p>
                    </div>
                  )}
                  {idea.enhanced.targetAudience && (
                    <div
                      style={{
                        background: "var(--canvas)",
                        padding: "var(--space-md)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <strong>Target Audience:</strong>
                      <p style={{ margin: "4px 0 0 0", fontSize: "0.9rem" }}>
                        {idea.enhanced.targetAudience}
                      </p>
                    </div>
                  )}
                  {idea.enhanced.valueProposition && (
                    <div
                      style={{
                        background: "var(--canvas)",
                        padding: "var(--space-md)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <strong>Value Proposition:</strong>
                      <p style={{ margin: "4px 0 0 0", fontSize: "0.9rem" }}>
                        {idea.enhanced.valueProposition}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--muted)", margin: 0 }}>
                Concept has not been enhanced yet. Click "Enhance with AI" to
                generate a structured concept.
              </p>
            )}
          </Card>

          {/* Phase 3 Card: Analysis */}
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-md)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-sm)",
                }}
              >
                <span
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}
                >
                  3.
                </span>
                <h3 style={{ margin: 0 }}>Critical Analysis & Evaluation</h3>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate(`/app/ideas/${ideaId}/analysis`)}
              >
                {isAnalyzed
                  ? isApproved
                    ? "View Full Analysis"
                    : "Review & Approve Analysis"
                  : "Run Analysis"}
              </Button>
            </div>

            {isAnalyzed ? (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-lg)",
                    marginBottom: "var(--space-md)",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      padding: "var(--space-md)",
                      background: "var(--canvas)",
                      borderRadius: "var(--radius-sm)",
                      minWidth: "100px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "2.2rem",
                        fontWeight: 700,
                        color: "var(--accent)",
                      }}
                    >
                      {idea.aiAnalysis.scoring?.overallScore} / 100
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "var(--accent-dark)",
                        fontSize: "0.85rem",
                      }}
                    >
                      {idea.aiAnalysis.scoring?.verdict}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <strong>Required Roles & Skills:</strong>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "var(--space-xs)",
                        marginTop: "6px",
                      }}
                    >
                      {idea.aiAnalysis.rolesAndSkills?.map((r, idx) => (
                        <Badge
                          key={idx}
                          variant={
                            r.priority === "must-have" ? "accent" : "neutral"
                          }
                        >
                          {r.role} ({r.skills?.join(", ")})
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "var(--space-sm)",
                  }}
                >
                  <Button
                    onClick={() => navigate(`/app/ideas/${ideaId}/analysis`)}
                  >
                    {isApproved
                      ? "View Complete Evaluation →"
                      : "Review Breakdown & Approve →"}
                  </Button>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--muted)", margin: 0 }}>
                Critical AI analysis has not been run yet. Advance from Phase 2
                to evaluate feasibility, scoring, and required team skills.
              </p>
            )}
          </Card>
        </div>

        {/* Danger zone (delete if not approved) */}
        {!isApproved && (
          <div style={{ marginTop: "var(--space-lg)", textAlign: "right" }}>
            <Button
              variant="secondary"
              onClick={handleDelete}
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              Delete Idea
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default IdeaDetailPage;
