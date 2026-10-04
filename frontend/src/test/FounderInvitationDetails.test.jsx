import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mockAuth = {
  profile: { _id: "founder-1", name: "Riya Shah" },
  profileType: "founder",
};

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("../services/matchingApi", () => ({
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
  withdrawInvitation: vi.fn(),
  getIdeaById: vi.fn().mockResolvedValue({
    success: true,
    idea: {
      _id: "idea-1",
      title: "Campus Launchpad",
      description: "A platform for student founders",
      problemStatement: "Students struggle to find structure",
      targetUsers: "Student founders",
    },
  }),
}));

import InvitationDetailsModal from "../components/invitations/InvitationDetailsModal";

describe("Founder invitation details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("does not show accept or decline actions for a pending invitation sent by the founder", async () => {
    render(
      <InvitationDetailsModal
        invitation={{
          _id: "inv-1",
          status: "Pending",
          role: "Frontend Engineer",
          message: "Hi there",
          createdAt: "2026-09-28T10:00:00.000Z",
          ideaId: "idea-1",
          fromFounder: { _id: "founder-1", name: "Riya Shah" },
          toCandidate: { _id: "candidate-1", name: "Ava" },
          matchContext: {
            score: 92,
            matchedSkills: ["React"],
            missingSkills: [],
          },
        }}
        onClose={() => {}}
        onStatusChange={() => {}}
      />,
    );

    expect(await screen.findByText("Campus Launchpad")).toBeDefined();
    expect(screen.queryByText("Accept Invitation")).toBeNull();
    expect(screen.queryByText("Decline")).toBeNull();
    expect(screen.getByText("Withdraw Invitation")).toBeDefined();
  });

  test("shows accept and decline actions for a pending invitation received by the candidate", async () => {
    mockAuth.profileType = "candidate";
    mockAuth.profile = { _id: "candidate-1", name: "Ava" };

    render(
      <InvitationDetailsModal
        invitation={{
          _id: "inv-2",
          status: "Pending",
          role: "Frontend Engineer",
          message: "Hi there",
          createdAt: "2026-09-28T10:00:00.000Z",
          ideaId: "idea-1",
          fromFounder: { _id: "founder-1", name: "Riya Shah" },
          toCandidate: { _id: "candidate-1", name: "Ava" },
          matchContext: {
            score: 92,
            matchedSkills: ["React"],
            missingSkills: [],
          },
        }}
        onClose={() => {}}
        onStatusChange={() => {}}
      />,
    );

    expect(await screen.findByText("Campus Launchpad")).toBeDefined();
    const acceptButton = screen.getByRole("button", {
      name: /Accept Invitation/i,
    });
    const declineButton = screen.getByRole("button", { name: /Decline/i });
    fireEvent.click(acceptButton);
    fireEvent.click(declineButton);

    expect(acceptButton).toBeDefined();
    expect(declineButton).toBeDefined();
  });
});
