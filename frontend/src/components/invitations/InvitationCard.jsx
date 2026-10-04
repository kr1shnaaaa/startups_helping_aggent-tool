import Badge from "../common/Badge";
import Button from "../common/Button";

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const getIdeaTitle = (invitation) =>
  invitation?.ideaId?.title || "Startup opportunity";
const getFounderName = (invitation) =>
  invitation?.fromFounder?.name || "Founder";
const getStatusValue = (invitation) => {
  const value = invitation?.status || "Pending";
  return String(value).trim() || "Pending";
};

const InvitationCard = ({ invitation, onViewDetails }) => {
  const status = getStatusValue(invitation);
  const matchContext = invitation?.matchContext || {};
  const matchedSkills = Array.isArray(matchContext.matchedSkills)
    ? matchContext.matchedSkills.filter(Boolean)
    : [];
  const missingSkills = Array.isArray(matchContext.missingSkills)
    ? matchContext.missingSkills.filter(Boolean)
    : [];
  const score = Number.isFinite(Number(matchContext.score))
    ? Math.round(Number(matchContext.score))
    : null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-md)",
        padding: "var(--space-lg)",
        borderColor:
          status === "Pending" ? "rgba(15, 118, 110, 0.35)" : "var(--line)",
      }}
    >
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
              color: "var(--muted)",
              fontSize: "0.8rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {invitation?.ideaId?.domain || "Startup"}
          </div>
          <h3 style={{ margin: "6px 0 0", fontSize: "1.35rem" }}>
            {getIdeaTitle(invitation)}
          </h3>
        </div>
        <Badge variant={status === "Pending" ? "accent" : "neutral"}>
          {status}
        </Badge>
      </div>

      <div style={{ color: "var(--muted)", marginBottom: "var(--space-sm)" }}>
        <strong>Founder:</strong> {getFounderName(invitation)}
      </div>

      <div style={{ marginBottom: "var(--space-sm)" }}>
        <strong>Role:</strong> {invitation?.role || "Role unspecified"}
      </div>

      <p
        style={{
          margin: "0 0 var(--space-md)",
          color: "var(--ink)",
          whiteSpace: "pre-wrap",
        }}
      >
        {invitation?.message || "No invitation message provided."}
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-sm)",
          marginBottom: "var(--space-md)",
        }}
      >
        {score !== null && <Badge variant="accent">Match {score}%</Badge>}
        {matchedSkills.slice(0, 3).map((skill) => (
          <Badge key={skill}>{skill}</Badge>
        ))}
      </div>

      {missingSkills.length > 0 && (
        <div style={{ color: "var(--muted)", marginBottom: "var(--space-md)" }}>
          <strong>Missing skills:</strong> {missingSkills.join(", ")}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-sm)",
          borderTop: "1px solid var(--line)",
          paddingTop: "var(--space-md)",
        }}
      >
        <span style={{ color: "var(--muted)" }}>
          Received: {formatDate(invitation?.createdAt)}
        </span>
        <Button variant="secondary" onClick={() => onViewDetails(invitation)}>
          View Details
        </Button>
      </div>
    </div>
  );
};

export default InvitationCard;
