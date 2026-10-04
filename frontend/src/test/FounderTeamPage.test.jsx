import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
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
  getIdeaById: vi.fn(),
}));

import FounderTeamPage from "../pages/dashboard/FounderTeamPage";
import { getIdeaById, getMyIdeas } from "../services/ideaApi";
import {
  addTeamMember,
  createTeam,
  listInvitations,
  listTeams,
} from "../services/matchingApi";

const LocationDisplay = () => {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
};

describe("FounderTeamPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.profile = { _id: "founder-1", name: "Riya Shah" };
    mockAuth.profileType = "founder";
    getMyIdeas.mockResolvedValue({
      success: true,
      ideas: [{ _id: "idea-1", title: "Campus Launchpad" }],
    });
    getIdeaById.mockResolvedValue({
      success: true,
      idea: {
        _id: "idea-1",
        title: "Campus Launchpad",
        aiAnalysis: {
          isApproved: true,
          rolesAndSkills: [{ role: "Backend Developer", count: 1 }],
        },
      },
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

    expect(
      await screen.findByText("No team has been created yet."),
    ).toBeDefined();
    expect(await screen.findByText("Accepted Candidates")).toBeDefined();
    expect(await screen.findByText("Ava")).toBeDefined();
    expect(screen.getByRole("button", { name: "Create Team" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Create Team" }));

    await waitFor(() => {
      expect(createTeam).toHaveBeenCalledWith("idea-1", "Campus Launchpad");
    });
    expect(await screen.findByText("Riya Shah")).toBeDefined();
    expect(
      await screen.findByText("No candidates have joined yet."),
    ).toBeDefined();
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

    const addButton = await screen.findByRole("button", {
      name: /Add to Team/i,
    });
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
    expect(
      screen.getByText(
        "No accepted candidates are waiting to be added to this team.",
      ),
    ).toBeDefined();
  });

  test("counts only real members, shows missing roles, and focuses existing matching on the missing role", async () => {
    getIdeaById.mockResolvedValue({
      success: true,
      idea: {
        _id: "idea-1",
        title: "Campus Launchpad",
        aiAnalysis: {
          isApproved: true,
          rolesAndSkills: [
            { role: "Backend Developer", count: 1 },
            { role: "Frontend Developer", count: 2 },
          ],
        },
      },
    });
    listTeams.mockResolvedValue({
      success: true,
      teams: [
        {
          _id: "team-1",
          name: "Campus Launchpad",
          status: "Active",
          ideaId: "idea-1",
          founderId: { _id: "founder-1", name: "Riya Shah" },
          members: [
            {
              userId: { _id: "candidate-2", name: "Morgan Backend" },
              role: "Backend Developer",
              joinedAt: "2026-10-04T09:00:00.000Z",
            },
          ],
        },
      ],
    });
    listInvitations.mockResolvedValue({
      success: true,
      invitations: [
        {
          _id: "inv-accepted",
          status: "Accepted",
          role: "Frontend Developer",
          ideaId: "idea-1",
          toCandidate: { _id: "candidate-1", name: "Alex Frontend" },
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/app/founder-team"]}>
        <FounderTeamPage />
        <LocationDisplay />
      </MemoryRouter>,
    );

    expect(
      (await screen.findByRole("progressbar")).getAttribute("aria-valuenow"),
    ).toBe("33");
    expect(screen.getAllByText("Backend Developer").length).toBeGreaterThan(0);
    expect(screen.getByText("1/1 ✓")).toBeDefined();
    expect(screen.getAllByText("Frontend Developer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0/2").length).toBeGreaterThan(0);
    expect(screen.getByText("Alex Frontend")).toBeDefined();
    expect(screen.getByText("Morgan Backend")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Find Candidates" }),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Find Candidates" }));
    expect(screen.getByTestId("location").textContent).toBe(
      "/app/ideas/idea-1/matching?role=Frontend%20Developer",
    );
  });

  test("shows Team Complete only when all required positions are filled", async () => {
    getIdeaById.mockResolvedValue({
      success: true,
      idea: {
        _id: "idea-1",
        title: "Campus Launchpad",
        aiAnalysis: {
          isApproved: true,
          rolesAndSkills: [{ role: "Backend Developer", count: 1 }],
        },
      },
    });
    listTeams.mockResolvedValue({
      success: true,
      teams: [
        {
          _id: "team-1",
          name: "Campus Launchpad",
          status: "Active",
          ideaId: "idea-1",
          founderId: { _id: "founder-1", name: "Riya Shah" },
          members: [
            {
              userId: { _id: "candidate-1", name: "Alex Developer" },
              role: "Full Stack Developer",
              joinedAt: "2026-10-04T09:00:00.000Z",
            },
          ],
        },
      ],
    });
    listInvitations.mockResolvedValue({ success: true, invitations: [] });

    render(
      <MemoryRouter>
        <FounderTeamPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("100%")).toBeDefined();
    expect(
      await screen.findByText(
        "✓ Team Complete. All required positions are filled.",
      ),
    ).toBeDefined();
    expect(screen.queryByText(/your startup will succeed/i)).toBeNull();
  });
});
