import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { within } from "@testing-library/react";

const mockAuth = {
  profile: { _id: "founder-1", name: "Riya Shah" },
  profileType: "founder",
};

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("../services/matchingApi", () => ({
  createTeam: vi.fn(),
  listTeams: vi.fn(),
  listInvitations: vi.fn(),
  addTeamMember: vi.fn(),
}));

vi.mock("../services/ideaApi", () => ({
  getMyIdeas: vi.fn(),
}));

import FounderTeamPage from "../pages/dashboard/FounderTeamPage";
import { getMyIdeas } from "../services/ideaApi";
import { addTeamMember, createTeam, listInvitations, listTeams } from "../services/matchingApi";

describe("FounderTeamPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.profile = { _id: "founder-1", name: "Riya Shah" };
    mockAuth.profileType = "founder";
    getMyIdeas.mockResolvedValue({
      success: true,
      ideas: [{ _id: "idea-1", title: "Campus Launchpad" }],
    });
  });

  test("creates an empty team for the existing idea without auto-adding accepted candidates", async () => {
    listTeams.mockResolvedValue({ success: true, teams: [] });
    listInvitations.mockResolvedValue({
      success: true,
      invitations: [
        {
          _id: "inv-accepted",
          status: "Accepted",
          role: "Frontend Engineer",
          ideaId: { _id: "idea-1", title: "Campus Launchpad" },
          toCandidate: { _id: "candidate-1", name: "Ava" },
          createdAt: "2026-10-01T09:00:00.000Z",
        },
      ],
    });
    createTeam.mockResolvedValue({
      success: true,
      team: {
        _id: "team-1",
        name: "Campus Launchpad",
        ideaId: "idea-1",
        founderId: { _id: "founder-1", name: "Riya Shah" },
        members: [],
        status: "Active",
      },
    });

    render(
      <MemoryRouter>
        <FounderTeamPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No team has been created yet.")).toBeDefined();
    expect(await screen.findByText("Accepted Candidates")).toBeDefined();
    expect(await screen.findByText("Ava")).toBeDefined();
    expect(screen.getByRole("button", { name: "Create Team" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Create Team" }));

    await waitFor(() => {
      expect(createTeam).toHaveBeenCalledWith("idea-1", "Campus Launchpad");
    });
    expect(await screen.findByText("Riya Shah")).toBeDefined();
    expect(await screen.findByText("No candidates have joined yet.")).toBeDefined();
    expect(await screen.findByText("Ava")).toBeDefined();
    expect(addTeamMember).not.toHaveBeenCalled();
  });

  test("adds an accepted candidate to an existing team using the real team member API", async () => {
    listTeams.mockResolvedValue({
      success: true,
      teams: [
        {
          _id: "team-1",
          name: "Campus Launchpad",
          status: "Active",
          ideaId: "idea-1",
          founderId: { _id: "founder-1", name: "Riya Shah" },
          members: [],
        },
      ],
    });
    listInvitations.mockResolvedValue({
      success: true,
      invitations: [
        {
          _id: "inv-accepted",
          status: "Accepted",
          role: "Frontend Engineer",
          ideaId: "idea-1",
          toCandidate: { _id: "candidate-1", name: "Ava" },
          createdAt: "2026-10-01T09:00:00.000Z",
        },
      ],
    });
    addTeamMember.mockResolvedValue({
      success: true,
      team: {
        _id: "team-1",
        name: "Campus Launchpad",
        ideaId: "idea-1",
        founderId: { _id: "founder-1", name: "Riya Shah" },
        members: [
          {
            userId: { _id: "candidate-1", name: "Ava" },
            role: "Frontend Engineer",
            invitationId: "inv-accepted",
            joinedAt: "2026-10-04T09:00:00.000Z",
          },
        ],
        status: "Active",
      },
    });

    render(
      <MemoryRouter>
        <FounderTeamPage />
      </MemoryRouter>,
    );

    const addButton = await screen.findByRole("button", { name: /Add to Team/i });
    fireEvent.click(addButton);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Add to Team/i,
      }),
    );

    await waitFor(() => {
      expect(addTeamMember).toHaveBeenCalledWith("team-1", "candidate-1");
    });
    expect(await screen.findByText("Joined: Oct 4, 2026")).toBeDefined();
    expect(screen.getByText("No accepted candidates are waiting to be added to this team.")).toBeDefined();
  });
});
