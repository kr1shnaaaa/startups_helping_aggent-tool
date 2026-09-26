import Button from "../common/Button";
import Badge from "../common/Badge";
import Card from "../common/Card";

const invitationButtonState = (invitationStatus) => {
  switch (invitationStatus) {
    case "Pending":
      return { label: "Request Sent", disabled: true, variant: "secondary" };
    case "Accepted":
      return { label: "Accepted", disabled: true, variant: "secondary" };
    case "Team Member":
      return { label: "Team Member", disabled: true, variant: "secondary" };
    case "Withdrawn":
      return { label: "Request Closed", disabled: true, variant: "secondary" };
    case "Declined":
      return { label: "Send Again", disabled: false, variant: "primary" };
    default:
      return { label: "Send Request", disabled: false, variant: "primary" };
  }
};

const CandidateCard = ({
  candidate,
  match,
  onSendRequest,
  sending = false,
  sendError = "",
}) => {
  const { name, college, location, targetRoles, availability, workPreference } =
    candidate;

  const {
    score,
    matchedSkills = [],
    missingSkills = [],
    niceToHaveSkills = [],
    roleMatches = [],
    sharedDomains = [],
    recommendationReason = "",
  } = match;

  const buttonState = invitationButtonState(match.invitationStatus);
  const primaryRole = targetRoles?.[0] || "Candidate";
  const matchedCount = matchedSkills.length;
  const totalRequired = matchedCount + missingSkills.length;

  return (
    <Card style={{ marginBottom: "var(--space-md)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--space-md)",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "var(--space-md)",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "var(--accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-dark)",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {(name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem" }}>{name}</h3>
            <p
              style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}
            >
              {primaryRole}
            </p>
            {college?.name && (
              <p
                style={{ margin: 0, color: "var(--muted)", fontSize: "0.8rem" }}
              >
                {college.name}
                {location?.city ? ` • ${location.city}` : ""}
              </p>
            )}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              color: "var(--accent)",
              lineHeight: 1,
            }}
          >
            {score}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            match score
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-xs)",
          marginTop: "var(--space-sm)",
        }}
      >
        {roleMatches.map((role) => (
          <Badge key={role} variant="accent">
            {role}
          </Badge>
        ))}
        {sharedDomains.map((domain) => (
          <Badge key={domain}>{domain}</Badge>
        ))}
        {availability && <Badge>{availability}</Badge>}
        {workPreference && <Badge>{workPreference}</Badge>}
      </div>

      <div style={{ marginTop: "var(--space-md)" }}>
        {matchedSkills.length > 0 && (
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--muted)",
                fontWeight: 600,
              }}
            >
              Matched Skills ({matchedCount}
              {totalRequired ? `/${totalRequired}` : ""})
            </span>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-xs)",
                marginTop: "4px",
              }}
            >
              {matchedSkills.map((skill) => (
                <Badge key={skill} variant="accent">
                  ✓ {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {missingSkills.length > 0 && (
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--muted)",
                fontWeight: 600,
              }}
            >
              Missing Skills
            </span>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-xs)",
                marginTop: "4px",
              }}
            >
              {missingSkills.map((skill) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>
          </div>
        )}

        {niceToHaveSkills.length > 0 && (
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--muted)",
                fontWeight: 600,
              }}
            >
              Nice-to-Have
            </span>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-xs)",
                marginTop: "4px",
              }}
            >
              {niceToHaveSkills.map((skill) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {recommendationReason && (
        <div
          style={{
            marginTop: "var(--space-md)",
            padding: "var(--space-sm)",
            background: "var(--accent-soft)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            color: "var(--accent-dark)",
          }}
        >
          <strong>Why recommended?</strong> {recommendationReason}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "var(--space-sm)",
          marginTop: "var(--space-md)",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <Button variant="secondary" onClick={() => {}}>
            View Profile
          </Button>
          <Button
            variant={buttonState.variant}
            disabled={buttonState.disabled || sending}
            onClick={() => {
              if (!buttonState.disabled) {
                onSendRequest(candidate, match);
              }
            }}
          >
            {sending ? "Sending..." : buttonState.label}
          </Button>
        </div>
        {sendError && (
          <span style={{ color: "var(--danger)", fontSize: "0.8rem" }}>
            {sendError}
          </span>
        )}
      </div>
    </Card>
  );
};

export default CandidateCard;
