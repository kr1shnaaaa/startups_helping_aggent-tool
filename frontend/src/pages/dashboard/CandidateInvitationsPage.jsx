import { useCallback, useEffect, useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import InvitationCard from "../../components/invitations/InvitationCard";
import InvitationDetailsModal from "../../components/invitations/InvitationDetailsModal";
import { useAuth } from "../../hooks/useAuth";
import { listInvitations } from "../../services/matchingApi";

const FILTER_OPTIONS = ["All", "Pending", "Accepted", "Declined"];

const normalizeInvitationsResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.invitations)) return payload.invitations;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
};

const CandidateInvitationsPage = () => {
  const { profileType } = useAuth();
  const direction = profileType === "founder" ? "sent" : "received";
  const [filter, setFilter] = useState("All");
  const [invitations, setInvitations] = useState([]);
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await listInvitations(direction, filter === "All" ? "" : filter);
      const nextInvitations = normalizeInvitationsResponse(response).sort((a, b) => {
        const aTime = new Date(a?.createdAt || 0).getTime();
        const bTime = new Date(b?.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setInvitations(nextInvitations);
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 401) {
        setError("Your session has expired. Please sign in again.");
      } else {
        setError("Unable to load invitations.");
      }
    } finally {
      setLoading(false);
    }
  }, [direction, filter]);

  useEffect(() => {
    let active = true;

    const loadInvitations = async () => {
      if (!active) return;
      await fetchInvitations();
    };

    void loadInvitations();

    return () => {
      active = false;
    };
  }, [fetchInvitations]);

  const renderLoadingState = () => (
    <div style={{ display: "grid", gap: "var(--space-md)" }}>
      {[1, 2, 3].map((key) => (
        <div
          key={key}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-md)",
            height: "220px",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );

  const handleStatusChange = useCallback(
    (updatedInvitation) => {
      if (!updatedInvitation) {
        void fetchInvitations();
        return;
      }

      setSelectedInvitation((current) => {
        if (!current || current?._id !== updatedInvitation?._id) {
          return current;
        }

        return { ...current, ...updatedInvitation, status: updatedInvitation.status || current.status };
      });
      void fetchInvitations();
    },
    [fetchInvitations],
  );

  const renderEmptyState = () => (
    <Card>
      <h3 style={{ marginTop: 0 }}>No invitations yet</h3>
      <p style={{ marginBottom: 0 }}>
        {profileType === "founder"
          ? "Your sent invitations will appear here once you start reaching out to candidates."
          : "Startup founders can invite you to join their project when your skills match their requirements."}
      </p>
    </Card>
  );

  const renderErrorState = () => (
    <Card>
      <h3 style={{ marginTop: 0 }}>Unable to load invitations</h3>
      <p>{error}</p>
      <Button onClick={fetchInvitations}>Retry</Button>
    </Card>
  );

  return (
    <AppLayout>
      <div style={{ padding: "var(--space-lg)", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 2.7rem)" }}>Invitations</h1>
          <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
            {profileType === "founder"
              ? "Review the invitations you have sent to candidates."
              : "Review opportunities from founders who are interested in your skills."}
          </p>
        </div>

        {!error && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-sm)",
              marginBottom: "var(--space-lg)",
            }}
          >
            {FILTER_OPTIONS.map((option) => {
              const active = option === filter;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  style={{
                    border: "1px solid var(--line)",
                    background: active ? "var(--accent)" : "var(--surface)",
                    color: active ? "#fff" : "var(--ink)",
                    borderRadius: "var(--radius-sm)",
                    padding: "8px 14px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}

        {loading && renderLoadingState()}
        {!loading && error && renderErrorState()}
        {!loading && !error && invitations.length === 0 && renderEmptyState()}

        {!loading && !error && invitations.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: "var(--space-md)",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            }}
          >
            {invitations.map((invitation) => (
              <InvitationCard
                key={invitation?._id || invitation?.id || `${invitation?.ideaId?._id || "idea"}-${invitation?.role || "role"}`}
                invitation={invitation}
                onViewDetails={setSelectedInvitation}
              />
            ))}
          </div>
        )}
      </div>

      <InvitationDetailsModal
        invitation={selectedInvitation}
        onClose={() => setSelectedInvitation(null)}
        onStatusChange={handleStatusChange}
      />
    </AppLayout>
  );
};

export default CandidateInvitationsPage;
