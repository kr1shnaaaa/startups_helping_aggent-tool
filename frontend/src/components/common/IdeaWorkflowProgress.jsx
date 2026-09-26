import { useNavigate } from "react-router-dom";
import Badge from "./Badge";

const IdeaWorkflowProgress = ({
  currentPhase = 1,
  ideaId = null,
  status = "draft",
  isApproved = false,
}) => {
  const navigate = useNavigate();

  const isStep1Done = Boolean(ideaId);
  const isStep2Done = [
    "enhanced",
    "analyzing",
    "analyzed",
    "matching",
    "team-forming",
    "complete",
  ].includes(status);
  const isFullyApproved =
    isApproved || ["matching", "team-forming", "complete"].includes(status);

  const steps = [
    {
      number: 1,
      title: "Raw Idea",
      subtitle: "Initial capture",
      path: ideaId ? `/app/ideas/${ideaId}/raw` : "/app/ideas/create",
      isAccessible: true,
      isDone: isStep1Done && currentPhase > 1,
      isActive: currentPhase === 1,
    },
    {
      number: 2,
      title: "Review Enhanced",
      subtitle: "Refined concept",
      path: ideaId ? `/app/ideas/${ideaId}/enhance` : null,
      isAccessible: Boolean(ideaId),
      isDone: isStep2Done && currentPhase > 2,
      isActive: currentPhase === 2,
    },
    {
      number: 3,
      title: "Critical Analysis",
      subtitle: isFullyApproved
        ? "Approved & Ready"
        : "AI evaluation & approval",
      path: ideaId ? `/app/ideas/${ideaId}/analysis` : null,
      isAccessible: Boolean(ideaId && (isStep2Done || currentPhase >= 2)),
      isDone: isFullyApproved,
      isActive: currentPhase === 3,
    },
  ];

  const handleStepClick = (step) => {
    if (step.isAccessible && step.path) {
      navigate(step.path);
    }
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-md) var(--space-lg)",
        marginBottom: "var(--space-lg)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-md)",
        }}
      >
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Startup Idea Workflow
        </span>
        {isFullyApproved ? (
          <Badge variant="accent">✓ Approved for Matching</Badge>
        ) : (
          <Badge>Phase {currentPhase} of 3</Badge>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          position: "relative",
          gap: "var(--space-sm)",
        }}
      >
        {steps.map((step, idx) => {
          const isClickable = step.isAccessible && ideaId;

          return (
            <div
              key={step.number}
              style={{
                display: "flex",
                alignItems: "center",
                flex: idx < steps.length - 1 ? 1 : "none",
              }}
            >
              <div
                onClick={() => isClickable && handleStepClick(step)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-sm)",
                  cursor: isClickable ? "pointer" : "default",
                  opacity: step.isAccessible || step.isActive ? 1 : 0.5,
                  transition: "all 0.2s ease",
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                }}
                onMouseEnter={(e) => {
                  if (isClickable)
                    e.currentTarget.style.background = "var(--canvas)";
                }}
                onMouseLeave={(e) => {
                  if (isClickable)
                    e.currentTarget.style.background = "transparent";
                }}
                title={isClickable ? `Go to ${step.title}` : undefined}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    background: step.isDone
                      ? "var(--accent)"
                      : step.isActive
                        ? "var(--accent-soft)"
                        : "var(--line)",
                    color: step.isDone
                      ? "#ffffff"
                      : step.isActive
                        ? "var(--accent-dark)"
                        : "var(--muted)",
                    border: step.isActive ? "2px solid var(--accent)" : "none",
                    flexShrink: 0,
                  }}
                >
                  {step.isDone ? "✓" : step.number}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: step.isActive ? 700 : 600,
                      color: step.isActive
                        ? "var(--accent-dark)"
                        : "var(--ink)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {step.title}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {step.subtitle}
                  </div>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: "2px",
                    background:
                      steps[idx + 1].isDone ||
                      steps[idx + 1].isActive ||
                      steps[idx].isDone
                        ? "var(--accent)"
                        : "var(--line)",
                    margin: "0 var(--space-sm)",
                    minWidth: "20px",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IdeaWorkflowProgress;
