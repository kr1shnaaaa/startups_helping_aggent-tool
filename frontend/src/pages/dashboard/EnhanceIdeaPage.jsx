import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Card from "../../components/common/Card";
import IdeaWorkflowProgress from "../../components/common/IdeaWorkflowProgress";
import { enhanceIdea, updateIdea, getIdeaById } from "../../services/ideaApi";

const EnhanceIdeaPage = () => {
  const { ideaId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [enhanced, setEnhanced] = useState(null);
  const [ideaStatus, setIdeaStatus] = useState("enhanced");
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadEnhancedData = async () => {
      if (!ideaId) return;
      setLoading(true);
      setError("");
      try {
        const ideaData = await getIdeaById(ideaId);
        if (!isMounted) return;
        const currentIdea = ideaData.idea || ideaData;

        setIdeaStatus(currentIdea.status || "draft");
        setIsApproved(currentIdea.aiAnalysis?.isApproved === true);

        // If enhanced data already exists, load it directly without regenerating
        if (currentIdea.enhanced && currentIdea.enhanced.description) {
          setEnhanced(currentIdea.enhanced);
        } else {
          // No enhancement exists yet, generate initial enhancement
          setEnhancing(true);
          const data = await enhanceIdea(ideaId);
          if (isMounted) {
            setEnhanced(data.enhancedIdea);
            setIdeaStatus("enhanced");
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.message || "Failed to load idea enhancement. Please try again.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setEnhancing(false);
        }
      }
    };

    loadEnhancedData();

    return () => {
      isMounted = false;
    };
  }, [ideaId]);

  const persistEnhancedIdea = async () => {
    if (!ideaId || !enhanced) return;

    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const result = await updateIdea(ideaId, { enhanced });
      const updatedIdea = result.idea || result;
      setIdeaStatus(updatedIdea.status || "enhanced");
      setSuccessMsg("Enhanced idea saved successfully! Visible in My Ideas.");
    } catch (err) {
      const message =
        err.message || "Could not save your edits. Please try again.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleReEnhance = async () => {
    if (
      !window.confirm(
        "Do you want AI to generate a fresh enhancement based on your latest raw idea? Any manual edits on this page will be replaced.",
      )
    ) {
      return;
    }
    setEnhancing(true);
    setError("");
    setSuccessMsg("");
    try {
      const data = await enhanceIdea(ideaId);
      setEnhanced(data.enhancedIdea);
      setIdeaStatus("enhanced");
      setSuccessMsg("AI enhancement refreshed!");
    } catch (err) {
      setError(err.message || "Re-enhancement failed.");
    } finally {
      setEnhancing(false);
    }
  };

  const updateField = (field, value) => {
    setEnhanced((current) => ({
      ...current,
      [field]: value,
    }));
  };

  if (loading && !enhanced) {
    return (
      <AppLayout>
        <div
          style={{
            padding: "var(--space-lg)",
            maxWidth: "800px",
            textAlign: "center",
          }}
        >
          <p>
            {enhancing
              ? "✨ Clarifying and enhancing your idea with AI..."
              : "Loading saved idea..."}
          </p>
        </div>
      </AppLayout>
    );
  }

  if (error && !enhanced) {
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
            <p style={{ color: "var(--danger)" }}>
              Enhancement failed: {error}
            </p>
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
                onClick={() => navigate(`/app/ideas/${ideaId}/raw`)}
              >
                ← Back to Raw Idea
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

  if (!enhanced) {
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

  return (
    <AppLayout>
      <div style={{ padding: "var(--space-lg)", maxWidth: "800px" }}>
        <IdeaWorkflowProgress
          currentPhase={2}
          ideaId={ideaId}
          status={ideaStatus}
          isApproved={isApproved}
        />

        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h1>Review Your Enhanced Idea</h1>
          <p style={{ color: "var(--muted)" }}>
            Phase 2: Review and refine the AI-structured concept below. You can
            freely edit any field to match your vision before proceeding to
            critical analysis.
          </p>
        </div>

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

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await persistEnhancedIdea();
              navigate(`/app/ideas/${ideaId}/analysis`);
            } catch {
              // leave the user on the page if save failed
            }
          }}
        >
          <Card>
            <Input
              label="Enhanced Title"
              value={enhanced.title || ""}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Enhanced title will appear here"
              required
            />
            <div style={{ marginBottom: "var(--space-md)" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "var(--space-sm)",
                  fontWeight: 600,
                }}
              >
                Refined Description
              </label>
              <textarea
                value={enhanced.description || ""}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="Refined description"
                required
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "1rem",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <Input
              label="Problem Statement"
              value={enhanced.problem || ""}
              onChange={(event) => updateField("problem", event.target.value)}
              placeholder="What core problem does this solve?"
            />
            <Input
              label="Solution"
              value={enhanced.solution || ""}
              onChange={(event) => updateField("solution", event.target.value)}
              placeholder="What is your proposed solution?"
            />
            <Input
              label="Target Audience"
              value={enhanced.targetAudience || ""}
              onChange={(event) =>
                updateField("targetAudience", event.target.value)
              }
              placeholder="Who are the primary users or customers?"
            />
            <Input
              label="Value Proposition"
              value={enhanced.valueProposition || ""}
              onChange={(event) =>
                updateField("valueProposition", event.target.value)
              }
              placeholder="Why is this uniquely valuable?"
            />
            <Input
              label="Core Workflow"
              value={enhanced.coreWorkflow || ""}
              onChange={(event) =>
                updateField("coreWorkflow", event.target.value)
              }
              placeholder="Step-by-step how the product works"
            />
          </Card>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "var(--space-lg)",
              gap: "var(--space-md)",
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="secondary"
              type="button"
              onClick={() => navigate(`/app/ideas/${ideaId}/raw`)}
            >
              ← Back to Raw Idea
            </Button>

            <div
              style={{
                display: "flex",
                gap: "var(--space-md)",
                flexWrap: "wrap",
              }}
            >
              <Button
                variant="secondary"
                type="button"
                disabled={loading || enhancing}
                onClick={handleReEnhance}
              >
                {enhancing ? "Generating..." : "🔄 Re-enhance with AI"}
              </Button>

              <Button
                variant="secondary"
                type="button"
                disabled={loading}
                onClick={async () => {
                  try {
                    await persistEnhancedIdea();
                  } catch {
                    // error handled in persistEnhancedIdea
                  }
                }}
              >
                {loading ? "Saving..." : "Save Enhanced Idea"}
              </Button>

              <Button type="submit" disabled={loading || enhancing}>
                Continue to Analysis →
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default EnhanceIdeaPage;
