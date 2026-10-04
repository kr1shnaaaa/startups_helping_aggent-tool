import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ profile: { _id: "user-1", name: "Ava" } }),
}));

vi.mock("../services/matchingApi", () => ({
  listTeams: vi.fn(),
}));

vi.mock("../services/ideaApi", () => ({
  getIdeaById: vi.fn(),
}));

import CandidateTeamPage from "../pages/dashboard/CandidateTeamPage";
import { listTeams } from "../services/matchingApi";
import { getIdeaById } from "../services/ideaApi";

describe("CandidateTeamPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shows the real backend team data for a member", async () => {
    listTeams.mockResolvedValue({
      success: true,
      teams: [
        {
          _id: "team-1",
          name: "Campus Launchpad",
          status: "Active",
          ideaId: "idea-1",
          founderId: { name: "Riya Shah" },
          members: [
            {
              userId: { _id: "user-1", name: "Ava" },
              role: "Frontend Engineer",
              joinedAt: "2026-10-01T09:00:00.000Z",
            },
            {
              userId: { _id: "user-2", name: "Milo" },
              role: "Product Manager",
              joinedAt: "2026-10-01T10:00:00.000Z",
            },
          ],
        },
      ],
    });

    getIdeaById.mockResolvedValue({
      success: true,
      idea: { _id: "idea-1", title: "Campus Launchpad" },
    });

    render(
      <MemoryRouter>
        <CandidateTeamPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /My Team/i })).toBeDefined();

    await waitFor(() => {
      expect(listTeams).toHaveBeenCalledTimes(1);
      expect(getIdeaById).toHaveBeenCalledWith("idea-1");
    });

    expect(
      (await screen.findAllByText("Campus Launchpad")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Riya Shah")).toBeDefined();
    expect(screen.getByText("Frontend Engineer")).toBeDefined();
    expect(screen.getByText("Team members")).toBeDefined();
    expect(screen.getByText("Ava (You)")).toBeDefined();
  });

  test("shows the empty state when the candidate is not on any team", async () => {
    listTeams.mockResolvedValue({ success: true, teams: [] });

    render(
      <MemoryRouter>
        <CandidateTeamPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("You are not part of any team yet."),
    ).toBeDefined();
  });

  test("shows the error state when the team API fails", async () => {
    listTeams.mockRejectedValue(new Error("server down"));

    render(
      <MemoryRouter>
        <CandidateTeamPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: /Unable to load your teams\./i,
      }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeDefined();
  });
});
