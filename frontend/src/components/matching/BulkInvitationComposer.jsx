import { useState } from "react";
import Button from "../common/Button";
import Badge from "../common/Badge";
import {
  generateInvitationMessage,
  sendInvitation,
} from "../../services/matchingApi";

const MAX_MESSAGE_LENGTH = 2000;

const generateDefaultBulkMessage = ({ ideaTitle, role }) => {
  return `Hi {candidateName},

We're working on ${ideaTitle || "our startup project"}.

We're currently looking for a ${role || "team member"} to help us build the project.

Would you be interested in joining the project?

Thanks!`;
};

const BulkInvitationComposer = ({
  isOpen,
  onClose,
  onSuccess,
  ideaId,
  ideaTitle = "",
  ideaDescription = "",
  ideaProblem = "",
  ideaSolution = "",
  ideaTargetAudience = "",
  selectedCandidates = [],
  role = "",
  requiredSkills = [],
}) => {
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [generatingAction, setGeneratingAction] = useState("");
  const [results, setResults] = useState(null); // array of { candidate, success, code, message }
  const [message, setMessage] = useState(() =>
    generateDefaultBulkMessage({ ideaTitle, role }),
  );

  if (!isOpen) return null;

  const candidateCount = selectedCandidates.length;
  const representativeCandidate = selectedCandidates[0]?.candidate || {};
  const representativeMatch = selectedCandidates[0]?.match || {};

  const handleGenerateWithAI = async () => {
    if (!role.trim()) {
      setError("Role is required for AI message generation.");
      return;
    }

    setGeneratingAction("personalize");
    setError("");

    try {
      const repCandidateId =
        representativeCandidate._id || representativeCandidate.id;
      const data = await generateInvitationMessage({
        ideaId,
        candidateId: repCandidateId,
        role: role.trim(),
        action: "personalize",
        draft: message,
        ideaDescription,
        ideaProblem,
        ideaSolution,
        ideaTargetAudience,
        requiredSkills,
        candidateSkills: (representativeCandidate.skills || [])
          .map((s) => s.name || s)
          .filter(Boolean),
        matchedSkills: representativeMatch.matchedSkills || [],
        missingSkills: representativeMatch.missingSkills || [],
      });

      if (!data.message || typeof data.message !== "string") {
        throw new Error("AI returned an invalid message.");
      }

      // Convert specific candidate name to template placeholder if present
      let templatedMessage = data.message;
      if (representativeCandidate.name) {
        const nameRegex = new RegExp(
          `\\b${representativeCandidate.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "gi",
        );
        templatedMessage = templatedMessage.replace(
          nameRegex,
          "{candidateName}",
        );
      }
      if (!templatedMessage.includes("{candidateName}")) {
        // Ensure {candidateName} placeholder at start if missing
        templatedMessage = templatedMessage.replace(
          /^(Hi|Hello|Hey)\s+[A-Za-z]+,/i,
          "Hi {candidateName},",
        );
      }

      setMessage(templatedMessage);
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
    if (!role.trim()) {
      setError("Role is missing.");
      return false;
    }
    return true;
  };

  const handleSend = async (candidatesToSend = selectedCandidates) => {
    if (!validateMessage()) return;

    setSending(true);
    setError("");

    const sendResults = [];

    for (const item of candidatesToSend) {
      const candidate = item.candidate || item;
      const candidateId = candidate._id || candidate.id;
      const candidateName = candidate.name || "there";
      const targetRole = item.role || role;

      const personalizedMessage = message
        .replace(/\{candidateName\}/g, candidateName)
        .trim();

      try {
        const res = await sendInvitation(
          ideaId,
          candidateId,
          targetRole.trim(),
          personalizedMessage,
        );
        sendResults.push({
          candidate,
          candidateId,
          candidateName,
          success: true,
          invitation: res?.invitation || res,
          message: "Invitation sent successfully",
        });
      } catch (err) {
        const status = err?.status || err?.response?.status;
        const code = err?.code || err?.response?.data?.code;

        let failureReason = "Failed to send invitation";
        if (status === 409 && code === "INVITATION_EXISTS") {
          failureReason = "Already has an active invitation";
        } else if (status === 409 && code === "INVITATION_DECLINED") {
          failureReason =
            "A previous invitation was declined and cannot be reopened";
        } else if (status === 409 && code === "INVITATION_CLOSED") {
          failureReason = "Previous invitation was withdrawn";
        } else if (status === 409 && code === "MATCH_REQUIRED") {
          failureReason = "Candidate must have a match snapshot first";
        } else if (status === 401) {
          failureReason = "Session expired";
        } else if (status === 403) {
          failureReason = "Not authorized";
        } else if (err?.message) {
          failureReason = err.message;
        }

        sendResults.push({
          candidate,
          candidateId,
          candidateName,
          success: false,
          code,
          status,
          message: failureReason,
          rawError: err,
        });
      }
    }

    setResults(sendResults);
    setSending(false);

    const hasAnySuccess = sendResults.some((r) => r.success);
    if (hasAnySuccess && onSuccess) {
      onSuccess({
        results: sendResults,
        successCount: sendResults.filter((r) => r.success).length,
      });
    }
  };

  const handleRetryFailed = () => {
    if (!results) return;
    const failedCandidates = selectedCandidates.filter((item) => {
      const id = item.candidate?._id || item.candidate?.id;
      const matchRes = results.find((r) => r.candidateId === id);
      return matchRes && !matchRes.success;
    });
    if (failedCandidates.length > 0) {
      handleSend(failedCandidates);
    }
  };

  const successCount = results ? results.filter((r) => r.success).length : 0;
  const failureCount = results ? results.filter((r) => !r.success).length : 0;
  const isAllSuccess = results && failureCount === 0;

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
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-xl)",
          maxWidth: "650px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          border: "1px solid var(--line)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "var(--space-md)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Send Invitations</h2>
            <p
              style={{
                margin: "4px 0 0 0",
                color: "var(--muted)",
                fontSize: "0.9rem",
              }}
            >
              <strong>{candidateCount}</strong> candidate
              {candidateCount !== 1 ? "s" : ""} selected • Role:{" "}
              <strong>{role || "Team Member"}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            aria-label="Close dialog"
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: sending ? "not-allowed" : "pointer",
              color: "var(--muted)",
              padding: "0 var(--space-xs)",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Selected Candidates Preview */}
        <div style={{ marginBottom: "var(--space-md)" }}>
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--muted)",
              marginBottom: "var(--space-xs)",
            }}
          >
            Selected Candidates:
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-xs)",
              maxHeight: "80px",
              overflowY: "auto",
              padding: "var(--space-xs)",
              background: "var(--bg)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--line)",
            }}
          >
            {selectedCandidates.map((item, idx) => {
              const cand = item.candidate || item;
              const match = item.match || {};
              const score = Number.isFinite(Number(match.score))
                ? Math.round(Number(match.score))
                : null;
              return (
                <Badge key={cand._id || cand.id || idx} variant="accent">
                  {cand.name || "Candidate"}
                  {score !== null ? ` (${score}%)` : ""}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Results Panel if sent */}
        {results ? (
          <div style={{ marginBottom: "var(--space-lg)" }}>
            <div
              style={{
                padding: "var(--space-md)",
                borderRadius: "var(--radius-md)",
                background:
                  failureCount === 0 ? "var(--accent-soft)" : "var(--surface)",
                border: "1px solid var(--line)",
                marginBottom: "var(--space-md)",
              }}
            >
              <h3
                style={{ margin: "0 0 var(--space-sm) 0", fontSize: "1.1rem" }}
              >
                {isAllSuccess
                  ? `All ${successCount} invitations sent successfully!`
                  : `${successCount} invitation${successCount !== 1 ? "s" : ""} sent successfully (${failureCount} issue${failureCount !== 1 ? "s" : ""})`}
              </h3>

              <div
                style={{
                  display: "grid",
                  gap: "var(--space-xs)",
                  maxHeight: "200px",
                  overflowY: "auto",
                  marginTop: "var(--space-sm)",
                }}
              >
                {results.map((res, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "var(--space-xs) var(--space-sm)",
                      borderRadius: "var(--radius-sm)",
                      background: res.success
                        ? "rgba(34, 197, 94, 0.08)"
                        : "rgba(239, 68, 68, 0.08)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{res.candidateName}</span>
                    <span
                      style={{
                        color: res.success
                          ? "var(--success, #16a34a)"
                          : "var(--danger)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {res.success ? "✓ Sent" : `⚠️ ${res.message}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "var(--space-sm)",
              }}
            >
              {failureCount > 0 && (
                <Button
                  variant="secondary"
                  onClick={handleRetryFailed}
                  disabled={sending}
                >
                  {sending ? "Retrying..." : "Retry Failed"}
                </Button>
              )}
              <Button variant="primary" onClick={onClose} disabled={sending}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Common Message Field */}
            <div style={{ marginBottom: "var(--space-md)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--space-xs)",
                }}
              >
                <label
                  htmlFor="bulk-invitation-message"
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    display: "block",
                  }}
                >
                  Invitation Message
                </label>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {message.length} / {MAX_MESSAGE_LENGTH} characters
                </span>
              </div>
              <textarea
                id="bulk-invitation-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your invitation message..."
                disabled={sending}
                rows={7}
                maxLength={MAX_MESSAGE_LENGTH}
                style={{
                  width: "100%",
                  padding: "var(--space-sm)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--line)",
                  fontFamily: "inherit",
                  fontSize: "0.9rem",
                  resize: "vertical",
                  boxSizing: "border-box",
                  background: "var(--surface)",
                  color: "var(--ink)",
                  lineHeight: 1.5,
                }}
              />
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--muted)",
                  margin: "4px 0 0 0",
                }}
              >
                Tip: Use <code>{`{candidateName}`}</code> to automatically
                personalize the message with each recipient&apos;s name.
              </p>
            </div>

            {error && (
              <div
                style={{
                  color: "var(--danger)",
                  fontSize: "0.85rem",
                  marginBottom: "var(--space-md)",
                  padding: "var(--space-xs) var(--space-sm)",
                  background: "rgba(239, 68, 68, 0.08)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                {error}
              </div>
            )}

            {/* Action Buttons */}
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
              <Button
                variant="secondary"
                disabled={sending || Boolean(generatingAction)}
                onClick={handleGenerateWithAI}
              >
                {generatingAction === "personalize"
                  ? "Generating..."
                  : "Generate with AI"}
              </Button>

              <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                <Button
                  variant="secondary"
                  onClick={onClose}
                  disabled={sending}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSend()}
                  disabled={sending || !message.trim() || candidateCount === 0}
                >
                  {sending
                    ? `Sending (${candidateCount})...`
                    : `Send Invitations (${candidateCount})`}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BulkInvitationComposer;
