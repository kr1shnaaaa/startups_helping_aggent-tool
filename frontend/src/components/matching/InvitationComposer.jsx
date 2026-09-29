import { useState } from "react";
import Button from "../common/Button";
import {
  generateInvitationMessage,
  sendInvitation,
} from "../../services/matchingApi";

const MAX_MESSAGE_LENGTH = 2000;

const generateDefaultMessage = ({
  ideaTitle,
  candidateName,
  role,
  matchedSkills = [],
}) => {
  const skillsText =
    matchedSkills.length > 0
      ? `Your ${matchedSkills.slice(0, 3).join(", ")} experience looks relevant to this role.`
      : "";

  return `Hi ${candidateName},

We're working on ${ideaTitle}.

We're currently looking for a ${role} to help us build the project.

${skillsText}

Would you be interested in joining the project?

Thanks!`;
};

const InvitationComposer = ({
  isOpen,
  onClose,
  onSuccess,
  ideaId,
  ideaTitle,
  ideaDescription = "",
  ideaProblem = "",
  ideaSolution = "",
  ideaTargetAudience = "",
  candidateId,
  candidateName,
  roleContext = null,
  matchedRoles = [],
  requiredSkills = [],
  candidateSkills = [],
  matchScore = 0,
  matchedSkills = [],
  missingSkills = [],
}) => {
  const initialRole = roleContext || matchedRoles[0] || "";
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [generatingAction, setGeneratingAction] = useState("");
  const [lastAction, setLastAction] = useState("");
  const [selectedRole, setSelectedRole] = useState(initialRole);
  const [message, setMessage] = useState(
    generateDefaultMessage({
      ideaTitle,
      candidateName,
      role: initialRole,
      matchedSkills,
    }),
  );

  const handleGenerateWithAI = async (action = "personalize") => {
    if (!selectedRole.trim()) {
      setError("Please select a role first.");
      return;
    }
    if (action === "enhance" && !message.trim()) {
      setError("Write a draft before enhancing it.");
      return;
    }

    setGeneratingAction(action);
    setLastAction(action);
    setError("");

    try {
      const data = await generateInvitationMessage({
        ideaId,
        candidateId,
        role: selectedRole,
        action,
        draft: message,
        ideaDescription,
        ideaProblem,
        ideaSolution,
        ideaTargetAudience,
        requiredSkills,
        candidateSkills,
        matchedSkills,
        missingSkills,
      });
      if (!data.message || typeof data.message !== "string") {
        throw new Error("AI returned an invalid message.");
      }
      setMessage(data.message);
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 401)
        setError("Your session has expired. Please log in again.");
      else if (status === 403)
        setError("You are not authorized to generate messages for this idea.");
      else if (status === 404) setError("Idea or candidate not found.");
      else if (status === 409)
        setError("Idea analysis must be approved first.");
      else if (status === 400)
        setError(err?.response?.data?.message || "The AI request is invalid.");
      else
        setError(
          "AI generation failed. Your current draft was kept. Please try again.",
        );
    } finally {
      setGeneratingAction("");
    }
  };

  const generating = Boolean(generatingAction);

  const validateMessage = () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Message cannot be empty.");
      return false;
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setError(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
      return false;
    }
    if (!selectedRole.trim()) {
      setError("Please select a role.");
      return false;
    }
    return true;
  };

  const handleSend = async () => {
    if (!validateMessage()) return;

    setSending(true);
    setError("");

    try {
      const response = await sendInvitation(
        ideaId,
        candidateId,
        selectedRole.trim(),
        message.trim(),
      );
      if (onSuccess) onSuccess(response);
    } catch (err) {
      const status = err?.status || err?.response?.status;
      const code = err?.code;
      if (status === 401)
        setError("Your session has expired. Please log in again.");
      else if (status === 403)
        setError("You are not authorized to invite for this idea.");
      else if (status === 404) setError("Idea or candidate not found.");
      else if (status === 409 && code === "INVITATION_EXISTS")
        setError(
          "An invitation is already pending or accepted for this candidate.",
        );
      else if (status === 409 && code === "INVITATION_DECLINED")
        setError("A previous invitation was declined and cannot be reopened.");
      else if (status === 409 && code === "INVITATION_CLOSED")
        setError(
          "A previous invitation was withdrawn. You can send a new invitation for this candidate.",
        );
      else if (status === 409 && code === "MATCH_REQUIRED")
        setError("Candidate must have a match snapshot first.");
      else if (status === 409)
        setError("Invitation already exists or conflicting state.");
      else if (status === 422 || status === 400)
        setError("Invalid invitation data.");
      else setError("Failed to send invitation. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1001,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.5)",
        padding: "var(--space-md)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          maxWidth: "640px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: "var(--space-lg)",
            borderBottom: "1px solid var(--line)",
            flexWrap: "wrap",
            gap: "var(--space-md)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Send Invitation</h2>
            <p
              style={{
                margin: "4px 0 0 0",
                color: "var(--muted)",
                fontSize: "0.9rem",
              }}
            >
              {candidateName}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={sending || generating}
          >
            Close
          </Button>
        </div>

        <div style={{ padding: "var(--space-lg)" }}>
          {error && (
            <div
              style={{
                marginBottom: "var(--space-md)",
                padding: "var(--space-md)",
                background: "rgba(220, 38, 38, 0.1)",
                border: "1px solid var(--danger)",
                borderRadius: "var(--radius-md)",
                color: "var(--danger)",
                fontSize: "0.9rem",
              }}
            >
              {error}
              {!sending && !generating && lastAction && (
                <div style={{ marginTop: "var(--space-sm)" }}>
                  <Button
                    variant="secondary"
                    onClick={() => handleGenerateWithAI(lastAction)}
                  >
                    Retry AI Generation
                  </Button>
                </div>
              )}
            </div>
          )}

          <div
            style={{
              marginBottom: "var(--space-lg)",
              padding: "var(--space-md)",
              background: "var(--accent-soft)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: "var(--space-sm)",
                fontSize: "0.9rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-md)",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--muted)",
                    minWidth: "80px",
                  }}
                >
                  Project:
                </span>
                <span style={{ fontWeight: 500 }}>{ideaTitle}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-md)",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--muted)",
                    minWidth: "80px",
                  }}
                >
                  Candidate:
                </span>
                <span style={{ fontWeight: 500 }}>{candidateName}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-md)",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--muted)",
                    minWidth: "80px",
                  }}
                >
                  Match:
                </span>
                <span style={{ fontWeight: 500, color: "var(--accent)" }}>
                  {matchScore}%
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-md)",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--muted)",
                    minWidth: "80px",
                  }}
                >
                  Role:
                </span>
                {matchedRoles.length > 1 ? (
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    style={{
                      padding: "var(--space-xs) var(--space-sm)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--surface)",
                      fontSize: "0.9rem",
                      minWidth: "200px",
                    }}
                  >
                    {matchedRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontWeight: 500 }}>
                    {selectedRole || matchedRoles[0] || "—"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "var(--space-md)" }}>
            <label
              htmlFor="invitation-message"
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--ink)",
                marginBottom: "var(--space-xs)",
              }}
            >
              Message
            </label>
            <textarea
              id="invitation-message"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (error) setError("");
              }}
              rows={8}
              style={{
                width: "100%",
                padding: "var(--space-md)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-md)",
                fontSize: "0.95rem",
                lineHeight: 1.5,
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
                background: "var(--surface)",
                color: "var(--ink)",
              }}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="Write your invitation message here..."
              disabled={sending || generating}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "var(--space-xs)",
              }}
            >
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {message.length} / {MAX_MESSAGE_LENGTH} characters
              </span>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-xs)",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => handleGenerateWithAI("personalize")}
                  disabled={generating || sending || !selectedRole.trim()}
                  style={{ fontSize: "0.8rem" }}
                >
                  {generatingAction === "personalize"
                    ? "Creating..."
                    : "Create Personalized Invitation"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleGenerateWithAI("enhance")}
                  disabled={generating || sending || !message.trim()}
                  style={{ fontSize: "0.8rem" }}
                >
                  {generatingAction === "enhance" ? "Enhancing..." : "Enhance My Draft"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleGenerateWithAI("summarize")}
                  disabled={generating || sending}
                  style={{ fontSize: "0.8rem" }}
                >
                  {generatingAction === "summarize" ? "Summarizing..." : "Summarize Startup Idea"}
                </Button>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "var(--space-sm)",
              marginTop: "var(--space-lg)",
              paddingTop: "var(--space-lg)",
              borderTop: "1px solid var(--line)",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={sending || generating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSend}
              disabled={
                sending || generating || !message.trim() || !selectedRole.trim()
              }
            >
              {sending ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvitationComposer;
