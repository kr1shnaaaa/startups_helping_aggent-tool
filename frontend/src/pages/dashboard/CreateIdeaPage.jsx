import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Card from "../../components/common/Card";
import IdeaWorkflowProgress from "../../components/common/IdeaWorkflowProgress";
import { createIdea, updateIdea, getIdeaById } from "../../services/ideaApi";

const CreateIdeaPage = () => {
  const { ideaId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(Boolean(ideaId));
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [ideaStatus, setIdeaStatus] = useState("draft");
  const [isApproved, setIsApproved] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });

  const isEditMode = Boolean(ideaId);

  useEffect(() => {
    let isMounted = true;
    if (ideaId) {
      getIdeaById(ideaId)
        .then((data) => {
          if (!isMounted) return;
          const idea = data.idea || data;
          if (idea) {
            setFormData({
              title: idea.original?.title || idea.title || "",
              description: idea.original?.description || idea.description || "",
            });
            setIdeaStatus(idea.status || "draft");
            setIsApproved(idea.aiAnalysis?.isApproved === true);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          setError(err.message || "Failed to load idea details");
        })
        .finally(() => {
          if (isMounted) setFetching(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [ideaId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || formData.title.trim().length < 3) {
      setError("Title must be at least 3 characters.");
      return;
    }
    if (
      !formData.description.trim() ||
      formData.description.trim().length < 20
    ) {
      setError("Description must be at least 20 characters.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      if (isEditMode) {
        await updateIdea(ideaId, {
          title: formData.title.trim(),
          description: formData.description.trim(),
        });
        navigate(`/app/ideas/${ideaId}/enhance`);
      } else {
        const data = await createIdea({
          title: formData.title.trim(),
          description: formData.description.trim(),
        });
        if (data.idea?._id) {
          navigate(`/app/ideas/${data.idea._id}/enhance`);
        } else {
          navigate("/app/ideas");
        }
      }
    } catch (err) {
      setError(err.message || "Failed to save idea. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!formData.title.trim() || formData.title.trim().length < 3) {
      setError("Title must be at least 3 characters to save draft.");
      return;
    }
    if (
      !formData.description.trim() ||
      formData.description.trim().length < 20
    ) {
      setError("Description must be at least 20 characters to save draft.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      if (isEditMode) {
        await updateIdea(ideaId, {
          title: formData.title.trim(),
          description: formData.description.trim(),
        });
        setSuccessMsg("Draft saved successfully!");
      } else {
        const data = await createIdea({
          title: formData.title.trim(),
          description: formData.description.trim(),
        });
        if (data.idea?._id) {
          setSuccessMsg("Draft saved successfully!");
          navigate(`/app/ideas/${data.idea._id}/raw`, { replace: true });
        }
      }
    } catch (err) {
      setError(err.message || "Failed to save draft.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <AppLayout>
        <div
          style={{
            padding: "var(--space-lg)",
            maxWidth: "800px",
            textAlign: "center",
          }}
        >
          <p>Loading your idea...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ padding: "var(--space-lg)", maxWidth: "800px" }}>
        <IdeaWorkflowProgress
          currentPhase={1}
          ideaId={ideaId}
          status={ideaStatus}
          isApproved={isApproved}
        />

        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h1>{isEditMode ? "Edit Raw Idea" : "Capture Your Raw Idea"}</h1>
          <p style={{ color: "var(--muted)" }}>
            Phase 1: Share your initial startup concept. You will review and
            refine the AI-structured enhancement in Phase 2 before finalizing
            your analysis.
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

        <form onSubmit={handleSubmit}>
          <Card>
            <Input
              label="Startup Idea Title"
              placeholder="e.g., CampusConnect: Peer Tutoring & Skills Marketplace"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
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
                Idea Pitch / Description
              </label>
              <textarea
                placeholder="Describe the problem, solution, and target student audience in detail (minimum 20 characters)..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
                rows={6}
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
              <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                {formData.description.length} characters (min 20)
              </span>
            </div>
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
              onClick={() => navigate("/app/ideas")}
            >
              ← My Ideas
            </Button>

            <div style={{ display: "flex", gap: "var(--space-md)" }}>
              <Button
                variant="secondary"
                type="button"
                disabled={loading}
                onClick={handleSaveDraft}
              >
                Save Draft
              </Button>

              <Button type="submit" disabled={loading}>
                {loading
                  ? "Saving..."
                  : isEditMode
                    ? "Save & Review Enhanced →"
                    : "✨ Save & Enhance Idea →"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default CreateIdeaPage;
