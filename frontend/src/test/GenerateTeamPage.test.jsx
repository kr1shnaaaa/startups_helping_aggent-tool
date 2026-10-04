import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../components/layout/AppLayout", () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock("../components/common/LoadingState", () => ({
  default: ({ label }) => <div>{label}</div>,
}));
vi.mock("../components/common/ErrorState", () => ({
  default: ({ message }) => <div>{message}</div>,
}));
vi.mock("../components/matching/CandidateCard", () => ({
  default: ({ candidate, match }) => (
    <div data-testid="candidate-card">
      {candidate.name}: {match.role}
    </div>
  ),
}));
vi.mock("../components/matching/CandidateProfileModal", () => ({
  default: () => null,
}));
vi.mock("../components/matching/BulkInvitationComposer", () => ({
  default: () => null,
}));
vi.mock("../services/matchingApi", () => ({
  getIdeaById: vi.fn(),
  searchMatches: vi.fn(),
  sendInvitation: vi.fn(),
}));

import GenerateTeamPage from "../pages/dashboard/GenerateTeamPage";
import { getIdeaById, searchMatches } from "../services/matchingApi";

const approvedIdea = {
  _id: "idea-1",
  title: "Campus Launchpad",
  aiAnalysis: {
    isApproved: true,
    rolesAndSkills: [
      { role: "Backend Developer", skills: ["Node.js"], count: 1 },
      { role: "Frontend Developer", skills: ["React"], count: 1 },
    ],
  },
};

const matches = [
  {
    candidate: { id: "backend-1", name: "Morgan Backend" },
    score: 90,
    explanation: { roleMatches: ["Backend Developer"] },
    matchedRoles: ["Backend Developer"],
  },
  {
    candidate: { id: "frontend-1", name: "Alex Frontend" },
    score: 88,
    explanation: { roleMatches: ["Frontend Developer"] },
    matchedRoles: ["Frontend Developer"],
  },
];

const renderMatchingRoute = (entry) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/app/ideas/:ideaId/matching" element={<GenerateTeamPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("GenerateTeamPage role focus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIdeaById.mockResolvedValue({ success: true, idea: approvedIdea });
    searchMatches.mockResolvedValue({ success: true, matches });
  });

  test("focuses the existing generated recommendations on the requested role", async () => {
    renderMatchingRoute("/app/ideas/idea-1/matching?role=Frontend%20Developer");

    expect(await screen.findByText("Showing candidate matches for Frontend Developer.")).toBeDefined();
    expect(await screen.findByText("Alex Frontend: Frontend Developer")).toBeDefined();
    expect(screen.queryByText("Morgan Backend: Backend Developer")).toBeNull();
    expect(searchMatches).toHaveBeenCalledWith("idea-1", {
      page: 1,
      limit: 50,
      minScore: 0,
    });
  });

  test("keeps every generated role visible when no role focus is requested", async () => {
    renderMatchingRoute("/app/ideas/idea-1/matching");

    expect(await screen.findByText("Alex Frontend: Frontend Developer")).toBeDefined();
    expect(await screen.findByText("Morgan Backend: Backend Developer")).toBeDefined();
    expect(screen.queryByText(/Showing candidate matches for/)).toBeNull();
  });
});
