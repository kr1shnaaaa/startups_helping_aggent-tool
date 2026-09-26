import Button from "../common/Button";
import Badge from "../common/Badge";
import Card from "../common/Card";
import { normalizeInvitationStatus } from "../../utils/matchGrouping";

const invitationButtonState = (invitationStatus) => {
  switch (normalizeInvitationStatus(invitationStatus)) {
    case "Pending":
      return {
        label: "Invitation Pending",
        disabled: true,
        variant: "secondary",
      };
    case "Accepted":
      return { label: "Accepted", disabled: true, variant: "secondary" };
    case "Team Member":
      return { label: "Already in Team", disabled: true, variant: "secondary" };
    case "Withdrawn":
      return { label: "Invite Again", disabled: false, variant: "primary" };
    case "Declined":
      return { label: "Invite Again", disabled: false, variant: "primary" };
    default:
      return { label: "Invite", disabled: false, variant: "primary" };
  }
};

const CandidateCard = ({
  candidate,
  match,
  onSendRequest,
  sending = false,
  sendError = "",
}) => {
  const {
    name,
    college,
    location,
    targetRoles = [],
    availability,
    workPreference,
  } = candidate || {};

  const {
    score = 0,
    matchedSkills = [],
    missingSkills = [],
    niceToHaveSkills = [],
    roleMatches = [],
    sharedDomains = [],
    recommendationReason = "",
    invitationStatus = null,
  } = match || {};

  const normalizedRoleMatches = Array.isArray(roleMatches)
    ? roleMatches.filter(Boolean)
    : [];
  const normalizedMatchedSkills = Array.isArray(matchedSkills)
    ? matchedSkills.filter(Boolean)
    : [];
  const normalizedMissingSkills = Array.isArray(missingSkills)
    ? missingSkills.filter(Boolean)
    : [];
  const normalizedNiceToHaveSkills = Array.isArray(niceToHaveSkills)
    ? niceToHaveSkills.filter(Boolean)
    : [];
  const normalizedSharedDomains = Array.isArray(sharedDomains)
    ? sharedDomains.filter(Boolean)
    : [];

  const buttonState = invitationButtonState(invitationStatus);
  const primaryRole = normalizedRoleMatches[0] || targetRoles[0] || "Candidate";
  const scoreValue = Number.isFinite(Number(score))
    ? Math.round(Number(score))
    : 0;

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
              fontSize: "1.8rem",
              fontWeight: 700,
              color: "var(--accent)",
              lineHeight: 1,
            }}
          >
            {scoreValue}%
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            Match
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
        {normalizedRoleMatches.map((role) => (
          <Badge key={String(role)} variant="accent">
            {role}
          </Badge>
        ))}
        {normalizedSharedDomains.map((domain) => (
          <Badge key={String(domain)}>{domain}</Badge>
        ))}
        {availability && <Badge>{availability}</Badge>}
        {workPreference && <Badge>{workPreference}</Badge>}
      </div>

      <div style={{ marginTop: "var(--space-md)" }}>
        {normalizedMatchedSkills.length > 0 && (
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--muted)",
                fontWeight: 600,
                marginBottom: "4px",
              }}
            >
              Matched Skills
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-xs)",
              }}
            >
              {normalizedMatchedSkills.map((skill) => (
                <Badge key={String(skill)} variant="accent">
                  ✓ {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {normalizedMissingSkills.length > 0 && (
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--muted)",
                fontWeight: 600,
                marginBottom: "4px",
              }}
            >
              Missing Skills
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-xs)",
              }}
            >
              {normalizedMissingSkills.map((skill) => (
                <Badge key={String(skill)}>{skill}</Badge>
              ))}
            </div>
          </div>
        )}

        {normalizedNiceToHaveSkills.length > 0 && (
          <div style={{ marginBottom: "var(--space-sm)" }}>
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--muted)",
                fontWeight: 600,
                marginBottom: "4px",
              }}
            >
              Nice-to-Have
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-xs)",
              }}
            >
              {normalizedNiceToHaveSkills.map((skill) => (
                <Badge key={String(skill)}>{skill}</Badge>
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
          <strong>Why this candidate?</strong> {recommendationReason}
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
              if (!buttonState.disabled && onSendRequest) {
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
