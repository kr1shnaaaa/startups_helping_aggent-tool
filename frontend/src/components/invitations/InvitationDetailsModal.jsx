import { useEffect, useMemo, useState } from "react";
import Badge from "../common/Badge";
import Button from "../common/Button";
import { acceptInvitation, declineInvitation, getIdeaById } from "../../services/matchingApi";

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

const InvitationDetailsModal = ({ invitation, onClose, onStatusChange }) => {
  const [projectDetails, setProjectDetails] = useState(null);
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    if (!invitation) return undefined;

    const ideaId = invitation?.ideaId?._id || invitation?.ideaId || null;
    if (!ideaId) {
      setProjectDetails(null);
      return undefined;
    }

    let active = true;
    const fetchIdeaDetails = async () => {
      setIdeaLoading(true);
      try {
        const response = await getIdeaById(ideaId);
        const idea = response?.idea || response;
        if (active) setProjectDetails(idea || null);
      } catch {
        if (active) setProjectDetails(null);
      } finally {
        if (active) setIdeaLoading(false);
      }
    };

    void fetchIdeaDetails();
    return () => {
      active = false;
    };
  }, [invitation]);

  const matchContext = invitation?.matchContext || {};
  const matchedSkills = Array.isArray(matchContext.matchedSkills)
    ? matchContext.matchedSkills.filter(Boolean)
    : [];
  const missingSkills = Array.isArray(matchContext.missingSkills)
    ? matchContext.missingSkills.filter(Boolean)
    : [];
  const niceToHaveSkills = Array.isArray(matchContext.niceToHaveSkills)
    ? matchContext.niceToHaveSkills.filter(Boolean)
    : [];
  const score = Number.isFinite(Number(matchContext.score))
    ? Math.round(Number(matchContext.score))
    : null;
  const roleContext = invitation?.matchContext?.roleContext || invitation?.roleContext || null;

  const idea = useMemo(() => {
    const potentialIdea = projectDetails || invitation?.ideaId || {};
    return {
      title: potentialIdea.title || "Startup opportunity",
      description: potentialIdea.description || potentialIdea.summary || "",
      problem: potentialIdea.problemStatement || potentialIdea.problem || potentialIdea.enhanced?.problem || "",
      solution: potentialIdea.solution || potentialIdea.enhanced?.solution || "",
      targetAudience: potentialIdea.targetUsers || potentialIdea.targetAudience || potentialIdea.enhanced?.targetAudience || "",
    };
  }, [invitation, projectDetails]);

  const actionInFlight = pendingAction !== null;
  const canAct = invitation?.status === "Pending";

  if (!invitation) return null;

  const handleActionSubmit = async (action) => {
    if (!invitation?._id) return;
    setStatusError("");
    setPendingAction(action);
    setConfirmAction(null);

    try {
      const response = action === "accept" ? await acceptInvitation(invitation._id) : await declineInvitation(invitation._id);
      const updatedInvitation = response?.invitation || response || { ...invitation, status: action === "accept" ? "Accepted" : "Declined" };
      onStatusChange?.(updatedInvitation);
      setPendingAction(null);
    } catch (error) {
      const status = error?.status || error?.response?.status;
      const backendMessage = error?.message || "Unable to update this invitation. Please try again.";
      if (status === 401) {
        setStatusError("Your session has expired. Please sign in again.");
      } else if (status === 404 || status === 409) {
        setStatusError("This invitation is no longer active. Please refresh to view the latest status.");
      } else {
        setStatusError(backendMessage || (action === "accept" ? "Unable to accept this invitation. Please try again." : "Unable to decline this invitation. Please try again."));
      }
      setPendingAction(null);
    }
  };

  const renderField = (label, value) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;
    return (
      <div>
        <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{label}</div>
        <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", color: "var(--ink)" }}>{value}</p>
      </div>
    );
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-md)",
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-md)",
          width: "min(100%, 700px)",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--space-md)",
            padding: "var(--space-lg)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div>
            <div style={{ color: "var(--muted)", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Invitation Details
            </div>
            <h2 style={{ margin: "8px 0 0" }}>{idea.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid var(--line)",
              background: "transparent",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              font: "inherit",
              cursor: "pointer",
              color: "var(--ink)",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: "var(--space-lg)", display: "grid", gap: "var(--space-lg)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", alignItems: "center" }}>
            <Badge variant={invitation?.status === "Pending" ? "accent" : "neutral"}>{invitation?.status || "Pending"}</Badge>
            {score !== null && <Badge variant="accent">Match {score}%</Badge>}
          </div>

          <section>
            <h3 style={{ margin: "0 0 var(--space-md)" }}>Project Invitation</h3>
            {renderField("About the Project", idea.description)}
            {renderField("Problem", idea.problem)}
            {renderField("Solution", idea.solution)}
            {renderField("Target Audience", idea.targetAudience)}
          </section>

          <section>
            <h3 style={{ margin: "0 0 var(--space-md)" }}>Invitation from Founder</h3>
            <div style={{ display: "grid", gap: "var(--space-md)" }}>
              <div>
                <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Founder</div>
                <div>{invitation?.fromFounder?.name || "Founder"}</div>
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Role</div>
                <div>{invitation?.role || "Role unspecified"}</div>
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Message from Founder</div>
                <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", color: "var(--ink)" }}>
                  {invitation?.message || "No invitation message provided."}
                </p>
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Date received</div>
                <div>{formatDate(invitation?.createdAt)}</div>
              </div>
            </div>
          </section>

          {(matchedSkills.length > 0 || missingSkills.length > 0 || niceToHaveSkills.length > 0 || score !== null || roleContext) && (
            <section>
              <h3 style={{ margin: "0 0 var(--space-md)" }}>Why You Were Matched</h3>
              <div style={{ display: "grid", gap: "var(--space-md)" }}>
                {score !== null && (
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Match score</div>
                    <div>{score}%</div>
                  </div>
                )}

                {roleContext && (
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Role context</div>
                    <div>{roleContext}</div>
                  </div>
                )}

                {matchedSkills.length > 0 && (
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Matched skills</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginTop: "8px" }}>
                      {matchedSkills.map((skill) => <Badge key={skill}>{skill}</Badge>)}
                    </div>
                  </div>
                )}

                {missingSkills.length > 0 && (
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Missing skills</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginTop: "8px" }}>
                      {missingSkills.map((skill) => <Badge key={skill}>{skill}</Badge>)}
                    </div>
                  </div>
                )}

                {niceToHaveSkills.length > 0 && (
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Nice to have</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginTop: "8px" }}>
                      {niceToHaveSkills.map((skill) => <Badge key={skill}>{skill}</Badge>)}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {ideaLoading && <div style={{ color: "var(--muted)" }}>Loading project details…</div>}

          {statusError && (
            <div style={{ color: "var(--danger)", fontWeight: 600 }}>{statusError}</div>
          )}

          {confirmAction && (
            <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "var(--space-md)" }}>
              <h4 style={{ margin: "0 0 var(--space-sm)" }}>
                {confirmAction === "accept" ? "Accept Invitation?" : "Decline Invitation?"}
              </h4>
              <p style={{ margin: "0 0 var(--space-md)", color: "var(--muted)" }}>
                {confirmAction === "accept"
                  ? `You are about to join ${idea.title} as ${invitation?.role || "this role"}.`
                  : "Are you sure you want to decline this invitation?"}
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                <Button variant="secondary" onClick={() => setConfirmAction(null)} disabled={actionInFlight}>
                  Cancel
                </Button>
                <Button
                  onClick={() => handleActionSubmit(confirmAction)}
                  disabled={actionInFlight}
                >
                  {actionInFlight && pendingAction === confirmAction
                    ? confirmAction === "accept"
                      ? "Accepting..."
                      : "Declining..."
                    : confirmAction === "accept"
                      ? "Accept Invitation"
                      : "Decline Invitation"}
                </Button>
              </div>
            </div>
          )}

          {!confirmAction && canAct && (
            <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={() => setConfirmAction("decline")} disabled={actionInFlight}>
                Decline
              </Button>
              <Button onClick={() => setConfirmAction("accept")} disabled={actionInFlight}>
                Accept Invitation
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvitationDetailsModal;
