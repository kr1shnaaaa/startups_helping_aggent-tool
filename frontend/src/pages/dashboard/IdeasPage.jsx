import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import Card from "../../components/common/Card";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import { getMyIdeas, deleteIdea } from "../../services/ideaApi";

const IdeasPage = () => {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;

    const fetchIdeas = async () => {
      setLoading(true);
      try {
        const data = await getMyIdeas();
        if (isActive) setIdeas(data.ideas || []);
      } catch (err) {
        console.error("Failed to fetch ideas", err);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    fetchIdeas();

    return () => {
      isActive = false;
    };
  }, []);

  const handleDelete = async (id, title, isApproved) => {
    if (isApproved) {
      alert("Approved ideas cannot be deleted directly.");
      return;
    }
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        await deleteIdea(id);
        setIdeas((currentIdeas) =>
          currentIdeas.filter((idea) => idea._id !== id),
        );
      } catch (err) {
        alert(err.message || "Failed to delete idea");
      }
    }
  };

  const getStatusBadge = (status, isApproved) => {
    if (
      isApproved ||
      status === "matching" ||
      status === "team-forming" ||
      status === "complete"
    ) {
      return <Badge variant="accent">✓ APPROVED</Badge>;
    }
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
        return <Badge>{(status || "draft").toUpperCase()}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div style={{ padding: "var(--space-lg)", maxWidth: "1000px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-lg)",
            flexWrap: "wrap",
            gap: "var(--space-md)",
          }}
        >
          <div>
            <h1 style={{ margin: "0 0 4px 0" }}>My Startup Ideas</h1>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              Manage, resume, and track your startup concepts across all 3
              phases.
            </p>
          </div>
          <Button onClick={() => navigate("/app/ideas/create")}>
            + Create New Idea
          </Button>
        </div>

        {loading ? (
          <Card>
            <p style={{ textAlign: "center", margin: "var(--space-lg) 0" }}>
              Loading your ideas...
            </p>
          </Card>
        ) : ideas.length === 0 ? (
          <Card style={{ textAlign: "center", padding: "var(--space-lg)" }}>
            <h3>No startup ideas yet</h3>
            <p
              style={{
                color: "var(--muted)",
                maxWidth: "450px",
                margin: "0 auto var(--space-lg) auto",
              }}
            >
              Start by capturing your raw startup concept in Phase 1. AI will
              help refine the concept and extract required team skills in Phase
              2 & 3.
            </p>
            <Button onClick={() => navigate("/app/ideas/create")}>
              ✨ Capture Your First Idea
            </Button>
          </Card>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-md)" }}>
            {ideas.map((idea) => {
              const isApproved =
                idea.aiAnalysis?.isApproved === true ||
                idea.status === "matching";
              const status = idea.status || "draft";
              const displayTitle = idea.enhanced?.title || idea.title;
              const displayDescription =
                idea.enhanced?.description || idea.description;
              const overallScore = idea.aiAnalysis?.scoring?.overallScore;
              const verdict = idea.aiAnalysis?.scoring?.verdict;

              return (
                <Card key={idea._id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "var(--space-md)",
                      flexWrap: "wrap",
                      marginBottom: "var(--space-sm)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          gap: "var(--space-xs)",
                          alignItems: "center",
                          flexWrap: "wrap",
                          marginBottom: "6px",
                        }}
                      >
                        {getStatusBadge(status, isApproved)}
                        {idea.domain && <Badge>{idea.domain}</Badge>}
                        {idea.category && <Badge>{idea.category}</Badge>}
                        {overallScore !== undefined && (
                          <Badge variant="accent">
                            Score: {overallScore}/100{" "}
                            {verdict ? `• ${verdict}` : ""}
                          </Badge>
                        )}
                      </div>

                      <h3
                        onClick={() => navigate(`/app/ideas/${idea._id}`)}
                        style={{
                          margin: "0 0 6px 0",
                          cursor: "pointer",
                          color: "var(--ink)",
                          fontSize: "1.2rem",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "var(--accent-dark)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "var(--ink)")
                        }
                      >
                        {displayTitle}
                      </h3>
                    </div>

                    <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      {new Date(idea.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: "0 0 var(--space-md) 0",
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {displayDescription}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "var(--space-sm)",
                      flexWrap: "wrap",
                      borderTop: "1px solid var(--line)",
                      paddingTop: "var(--space-md)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--space-sm)",
                        flexWrap: "wrap",
                      }}
                    >
                      {/* Status-specific primary and secondary action buttons */}
                      {status === "draft" && (
                        <>
                          <Button
                            variant="primary"
                            onClick={() =>
                              navigate(`/app/ideas/${idea._id}/enhance`)
                            }
                          >
                            ✨ Enhance Idea →
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() =>
                              navigate(`/app/ideas/${idea._id}/raw`)
                            }
                          >
                            Edit Raw Draft
                          </Button>
                        </>
                      )}

                      {status === "enhanced" && (
                        <>
                          <Button
                            variant="primary"
                            onClick={() =>
                              navigate(`/app/ideas/${idea._id}/enhance`)
                            }
                          >
                            Review Enhanced Concept
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() =>
                              navigate(`/app/ideas/${idea._id}/analysis`)
                            }
                          >
                            Proceed to Analysis →
                          </Button>
                        </>
                      )}

                      {status === "analyzed" && !isApproved && (
                        <>
                          <Button
                            variant="primary"
                            onClick={() =>
                              navigate(`/app/ideas/${idea._id}/analysis`)
                            }
                          >
                            Review & Approve Analysis →
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() =>
                              navigate(`/app/ideas/${idea._id}/enhance`)
                            }
                          >
                            Review Enhanced
                          </Button>
                        </>
                      )}

                      {isApproved && (
                        <>
                          <Button
                            variant="primary"
                            onClick={() =>
                              navigate(`/app/ideas/${idea._id}/matching`)
                            }
                          >
                            👥 Generate Team
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => navigate(`/app/ideas/${idea._id}`)}
                          >
                            View Idea Details
                          </Button>
                        </>
                      )}

                      {/* Always show View Idea overview button for unapproved if not already shown */}
                      {!isApproved && (
                        <Button
                          variant="secondary"
                          onClick={() => navigate(`/app/ideas/${idea._id}`)}
                        >
                          Overview
                        </Button>
                      )}
                    </div>

                    {!isApproved && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          handleDelete(idea._id, displayTitle, isApproved)
                        }
                        style={{
                          color: "var(--danger)",
                          borderColor: "var(--line)",
                        }}
                      >
                        Delete
                      </Button>
                    )}
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

export default IdeasPage;
