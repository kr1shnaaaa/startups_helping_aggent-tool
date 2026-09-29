/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import Button from "../common/Button";
import Badge from "../common/Badge";
import LoadingState from "../common/LoadingState";
import ErrorState from "../common/ErrorState";
import { normalizeInvitationStatus } from "../../utils/matchGrouping";
import {
  getCandidateProfile,
  withdrawInvitation,
} from "../../services/matchingApi";
import InvitationComposer from "./InvitationComposer";

const invitationButtonState = (invitationStatus) => {
  switch (normalizeInvitationStatus(invitationStatus)) {
    case "Pending":
      return {
        label: "Invitation Pending",
        disabled: true,
        variant: "secondary",
      };
    case "Accepted":
      return {
        label: "Invitation Accepted",
        disabled: true,
        variant: "secondary",
      };
    case "Team Member":
      return { label: "Already in Team", disabled: true, variant: "secondary" };
    case "Withdrawn":
      return { label: "Invite Again", disabled: false, variant: "primary" };
    case "Declined":
      return { label: "Invite Again", disabled: false, variant: "primary" };
    default:
      return { label: "Send Invitation", disabled: false, variant: "primary" };
  }
};

const CandidateProfileModal = ({
  isOpen,
  onClose,
  candidateId,
  matchContext = {},
  roleContext = null,
  ideaId = null,
  ideaTitle = null,
  ideaDescription = "",
  ideaProblem = "",
  ideaSolution = "",
  ideaTargetAudience = "",
  onInvitationStateChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [candidate, setCandidate] = useState(null);
  const [showComposer, setShowComposer] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [invitationState, setInvitationState] = useState({
    status: normalizeInvitationStatus(matchContext.invitationStatus),
    id: matchContext.invitationId || null,
  });

  const loadProfile = useCallback(async () => {
    if (!isOpen || !candidateId) return;

    setLoading(true);
    setError("");
    try {
      const data = await getCandidateProfile(candidateId);
      const user = data.user || data;
      setCandidate(user);
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 401)
        setError("Your session has expired. Please log in again.");
      else if (status === 403)
        setError("You do not have permission to view this profile.");
      else if (status === 404) setError("Candidate profile not found.");
      else setError("Failed to load candidate profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [isOpen, candidateId]);

  useEffect(() => {
    setInvitationState({
      status: normalizeInvitationStatus(matchContext.invitationStatus),
      id: matchContext.invitationId || null,
    });
  }, [matchContext.invitationId, matchContext.invitationStatus]);

  const handleInvitationSuccess = useCallback(
    (response) => {
      const invitation = response?.invitation || response;
      setInvitationState({
        status: normalizeInvitationStatus(invitation?.status) || "Pending",
        id: invitation?._id || invitation?.id || null,
      });
      setSuccessMessage("Invitation sent successfully.");
      setShowWithdrawConfirm(false);
      setShowComposer(false);
      onInvitationStateChange?.();
      if (isOpen && candidateId) loadProfile();
    },
    [candidateId, isOpen, loadProfile, onInvitationStateChange],
  );

  const handleWithdraw = async () => {
    if (!invitationState.id) {
      setError("Invitation details are unavailable. Refresh and try again.");
      return;
    }

    setWithdrawing(true);
    setError("");
    try {
      const response = await withdrawInvitation(invitationState.id);
      const invitation = response?.invitation || response;
      setInvitationState({
        status: normalizeInvitationStatus(invitation?.status) || "Withdrawn",
        id: invitation?._id || invitation?.id || invitationState.id,
      });
      setShowWithdrawConfirm(false);
      setSuccessMessage("Invitation withdrawn successfully.");
      onInvitationStateChange?.();
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 401)
        setError("Your session has expired. Please log in again.");
      else if (status === 403)
        setError("You do not have permission to withdraw this invitation.");
      else if (status === 404)
        setError("Invitation not found. Refresh and try again.");
      else if (status === 409)
        setError("This invitation is no longer pending.");
      else setError("Failed to withdraw invitation. Please try again.");
    } finally {
      setWithdrawing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (!isOpen) return null;

  const {
    name,
    college,
    location,
    skills = [],
    interests = [],
    targetRoles = [],
    domainInterests = [],
    availability,
    workPreference,
    hoursPerWeek,
  } = candidate || {};

  const {
    score = 0,
    matchedSkills = [],
    missingSkills = [],
    niceToHaveSkills = [],
    roleMatches = [],
    recommendationReason = "",
    requiredSkills = [],
    matchedRoles = [],
  } = matchContext || {};

  const normalizedRoleMatches = Array.isArray(roleMatches)
    ? roleMatches.filter(Boolean)
    : [];
  const normalizedMatchedRoles = Array.isArray(matchedRoles)
    ? matchedRoles.filter(Boolean)
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
  const scoreValue = Number.isFinite(Number(score))
    ? Math.round(Number(score))
    : 0;
  const buttonState = invitationButtonState(invitationState.status);

  const handleOpenComposer = () => {
    if (buttonState.disabled) return;
    setShowComposer(true);
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
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
            maxWidth: "600px",
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
            <div
              style={{
                display: "flex",
                gap: "var(--space-md)",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "var(--accent-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent-dark)",
                  fontWeight: 700,
                  fontSize: "1.5rem",
                  flexShrink: 0,
                }}
              >
                {(name || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.4rem" }}>{name}</h2>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    color: "var(--muted)",
                    fontSize: "0.9rem",
                  }}
                >
                  {normalizedRoleMatches[0] || targetRoles[0] || "Candidate"}
                </p>
                {college?.name && (
                  <p
                    style={{
                      margin: "4px 0 0 0",
                      color: "var(--muted)",
                      fontSize: "0.85rem",
                    }}
                  >
                    {college.name}
                    {location?.city ? ` • ${location.city}` : ""}
                    {location?.state ? `, ${location.state}` : ""}
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
                {scoreValue}%
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                Match Score
              </div>
            </div>
          </div>

          <div style={{ padding: "var(--space-lg)" }}>
            {loading && <LoadingState label="Loading candidate profile..." />}

            {error && !loading && (
              <ErrorState
                message={error}
                onRetry={() => window.location.reload()}
              />
            )}

            {successMessage && !error && (
              <div
                role="status"
                style={{
                  marginBottom: "var(--space-md)",
                  padding: "var(--space-md)",
                  background: "rgba(22, 163, 74, 0.1)",
                  border: "1px solid #16a34a",
                  borderRadius: "var(--radius-md)",
                  color: "#15803d",
                  fontSize: "0.9rem",
                }}
              >
                {successMessage}
              </div>
            )}

            {!loading && !error && candidate && (
              <>
                {roleContext && (
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
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        fontWeight: 600,
                        marginBottom: "4px",
                      }}
                    >
                      Matching For
                    </div>
                    <div
                      style={{ fontWeight: 600, color: "var(--accent-dark)" }}
                    >
                      {roleContext}
                    </div>
                  </div>
                )}

                {normalizedMatchedRoles.length > 0 && (
                  <div style={{ marginBottom: "var(--space-lg)" }}>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        fontWeight: 600,
                        marginBottom: "var(--space-xs)",
                      }}
                    >
                      Matched Roles
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "var(--space-xs)",
                      }}
                    >
                      {normalizedMatchedRoles.map((role) => (
                        <Badge key={String(role)} variant="accent">
                          ✓ {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {normalizedMatchedSkills.length > 0 && (
                  <div style={{ marginBottom: "var(--space-md)" }}>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        fontWeight: 600,
                        marginBottom: "var(--space-xs)",
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
                  <div style={{ marginBottom: "var(--space-md)" }}>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        fontWeight: 600,
                        marginBottom: "var(--space-xs)",
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
                  <div style={{ marginBottom: "var(--space-md)" }}>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--muted)",
                        fontWeight: 600,
                        marginBottom: "var(--space-xs)",
                      }}
                    >
                      Nice-to-Have Skills
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

                {recommendationReason && (
                  <div
                    style={{
                      marginBottom: "var(--space-lg)",
                      padding: "var(--space-md)",
                      background: "var(--accent-soft)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "0.9rem",
                      color: "var(--accent-dark)",
                    }}
                  >
                    <strong>Why this candidate?</strong> {recommendationReason}
                  </div>
                )}

                <div
                  style={{
                    borderTop: "1px solid var(--line)",
                    paddingTop: "var(--space-lg)",
                  }}
                >
                  <h3 style={{ margin: "0 0 var(--space-md) 0" }}>
                    Full Profile
                  </h3>

                  <div style={{ display: "grid", gap: "var(--space-md)" }}>
                    {skills.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--muted)",
                            fontWeight: 600,
                            marginBottom: "var(--space-xs)",
                          }}
                        >
                          Skills
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "var(--space-xs)",
                          }}
                        >
                          {skills.map((skill, i) => (
                            <Badge key={i}>
                              {skill.name || skill}{" "}
                              {skill.level ? `(${skill.level})` : ""}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {interests.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--muted)",
                            fontWeight: 600,
                            marginBottom: "var(--space-xs)",
                          }}
                        >
                          Interests
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "var(--space-xs)",
                          }}
                        >
                          {interests.map((interest, i) => (
                            <Badge key={i}>{interest}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {targetRoles.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--muted)",
                            fontWeight: 600,
                            marginBottom: "var(--space-xs)",
                          }}
                        >
                          Target Roles
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "var(--space-xs)",
                          }}
                        >
                          {targetRoles.map((role, i) => (
                            <Badge key={i} variant="accent">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {domainInterests.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--muted)",
                            fontWeight: 600,
                            marginBottom: "var(--space-xs)",
                          }}
                        >
                          Domain Interests
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "var(--space-xs)",
                          }}
                        >
                          {domainInterests.map((domain, i) => (
                            <Badge key={i}>{domain}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "var(--space-md)",
                        fontSize: "0.9rem",
                        color: "var(--muted)",
                      }}
                    >
                      {availability && (
                        <span>Availability: {availability}</span>
                      )}
                      {workPreference && (
                        <span>Work Preference: {workPreference}</span>
                      )}
                      {hoursPerWeek && <span>Hours/Week: {hoursPerWeek}</span>}
                    </div>
                  </div>
                </div>
              </>
            )}

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
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
              {invitationState.status === "Pending" && (
                <Button
                  variant="secondary"
                  onClick={() => setShowWithdrawConfirm(true)}
                  disabled={withdrawing}
                >
                  Withdraw Invitation
                </Button>
              )}
              <Button
                variant={buttonState.variant}
                disabled={buttonState.disabled}
                onClick={handleOpenComposer}
              >
                {buttonState.label}
              </Button>
            </div>

            {showWithdrawConfirm && (
              <div
                role="dialog"
                aria-label="Withdraw invitation confirmation"
                style={{
                  marginTop: "var(--space-md)",
                  padding: "var(--space-md)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--accent-soft)",
                }}
              >
                <p style={{ margin: "0 0 var(--space-md) 0" }}>
                  Are you sure you want to withdraw this invitation?
                </p>
                <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                  <Button
                    variant="secondary"
                    onClick={() => setShowWithdrawConfirm(false)}
                    disabled={withdrawing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleWithdraw}
                    disabled={withdrawing}
                  >
                    {withdrawing ? "Withdrawing..." : "Withdraw Invitation"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <InvitationComposer
        key={`${candidateId}-${name || ""}-${roleContext || ""}`}
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
        onSuccess={handleInvitationSuccess}
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        ideaDescription={ideaDescription}
        ideaProblem={ideaProblem}
        ideaSolution={ideaSolution}
        ideaTargetAudience={ideaTargetAudience}
        candidateId={candidateId}
        candidateName={name}
        roleContext={roleContext}
        matchedRoles={normalizedMatchedRoles}
        requiredSkills={requiredSkills}
        matchScore={scoreValue}
        matchedSkills={normalizedMatchedSkills}
        missingSkills={normalizedMissingSkills}
        candidateSkills={skills
          .map((skill) => skill.name || skill)
          .filter(Boolean)}
        candidateExperienceLevel={candidate?.skills?.[0]?.level}
      />
    </>
  );
};

export default CandidateProfileModal;
