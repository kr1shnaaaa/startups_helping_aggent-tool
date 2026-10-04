import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LoginPage from "../pages/auth/LoginPage";
import WelcomePage from "../pages/onboarding/WelcomePage";
import ApplicationEntryPage from "../pages/ApplicationEntryPage";
import IdeasPage from "../pages/dashboard/IdeasPage";
import CreateIdeaPage from "../pages/dashboard/CreateIdeaPage";
import EnhanceIdeaPage from "../pages/dashboard/EnhanceIdeaPage";
import AnalyzeIdeaPage from "../pages/dashboard/AnalyzeIdeaPage";
import IdeaDetailPage from "../pages/dashboard/IdeaDetailPage";
import GenerateTeamPage from "../pages/dashboard/GenerateTeamPage";
import CandidateInvitationsPage from "../pages/dashboard/CandidateInvitationsPage";
import CandidateTeamPage from "../pages/dashboard/CandidateTeamPage";
import FounderTeamPage from "../pages/dashboard/FounderTeamPage";
import FeaturePage from "../pages/FeaturePage";
import RoleSelectionPage from "../pages/onboarding/RoleSelectionPage";
import FounderOnboarding from "../pages/onboarding/FounderOnboarding";
import CandidateOnboarding from "../pages/onboarding/CandidateOnboarding";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import ProtectedRoute from "./ProtectedRoute";

const PublicRoute = ({ children }) => {
  const { firebaseUser, loading, profileCompleted } = useAuth();
  if (loading) return <LoadingState />;
  if (firebaseUser)
    return (
      <Navigate
        to={profileCompleted ? "/app" : "/onboarding/welcome"}
        replace
      />
    );
  return children;
};

const RootEntry = () => {
  const { firebaseUser, loading, error, profileCompleted, refreshProfile } =
    useAuth();

  console.log("[AUTH DEBUG] RootEntry decision points:", {
    loading,
    userExists: !!firebaseUser,
    profileCompleted,
    error: !!error,
  });

  if (loading) return <LoadingState />;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (error) return <ErrorState message={error} onRetry={refreshProfile} />;

  const destination = profileCompleted ? "/app" : "/onboarding/welcome";
  console.log("[AUTH DEBUG] Navigating to:", destination);
  return <Navigate to={destination} replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route
      path="/login"
      element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      }
    />
    <Route element={<ProtectedRoute />}>
      <Route path="/onboarding/welcome" element={<WelcomePage />} />
      <Route path="/onboarding/role" element={<RoleSelectionPage />} />
      <Route path="/onboarding/founder" element={<FounderOnboarding />} />
      <Route path="/onboarding/candidate" element={<CandidateOnboarding />} />
      <Route path="/app" element={<ApplicationEntryPage />} />
      <Route path="/app/ideas" element={<IdeasPage />} />
      <Route path="/app/ideas/create" element={<CreateIdeaPage />} />
      <Route path="/app/ideas/:ideaId/raw" element={<CreateIdeaPage />} />
      <Route path="/app/ideas/:ideaId/enhance" element={<EnhanceIdeaPage />} />
      <Route path="/app/ideas/:ideaId/analysis" element={<AnalyzeIdeaPage />} />
      <Route
        path="/app/ideas/:ideaId/matching"
        element={<GenerateTeamPage />}
      />
      <Route path="/app/ideas/:ideaId" element={<IdeaDetailPage />} />
      <Route
        path="/app/talent"
        element={
          <FeaturePage
            title="Discover Talent"
            description="Find team members."
          />
        }
      />
      <Route path="/app/team" element={<CandidateTeamPage />} />
      <Route path="/app/founder-team" element={<FounderTeamPage />} />
      <Route path="/app/invitations" element={<CandidateInvitationsPage />} />
      <Route
        path="/app/explore"
        element={
          <FeaturePage
            title="Explore Startups"
            description="Find opportunities."
          />
        }
      />
      <Route
        path="/app/matches"
        element={<FeaturePage title="Matches" description="View matches." />}
      />
    </Route>
    <Route path="/" element={<RootEntry />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRoutes;
