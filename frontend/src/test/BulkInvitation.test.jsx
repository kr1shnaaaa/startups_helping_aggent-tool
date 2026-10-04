import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CandidateCard from "../components/matching/CandidateCard";
import BulkInvitationComposer from "../components/matching/BulkInvitationComposer";
import * as matchingApi from "../services/matchingApi";

describe("CandidateCard Selection", () => {
  const mockCandidate = {
    _id: "cand-1",
    name: "Alex Rivera",
    college: { name: "MIT" },
    location: { city: "Boston" },
    targetRoles: ["Frontend Developer"],
    availability: "full-time",
    workPreference: "remote",
  };

  const mockMatch = {
    score: 95,
    matchedSkills: ["React", "TypeScript"],
    missingSkills: [],
    roleMatches: ["Frontend Developer"],
    invitationStatus: null,
  };

  test("renders selectable checkbox and handles toggle", () => {
    const onSelectToggle = vi.fn();
    render(
      <CandidateCard
        candidate={mockCandidate}
        match={mockMatch}
        selectable={true}
        selected={false}
        onSelectToggle={onSelectToggle}
        selectionDisabled={false}
      />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /Select Alex Rivera/i,
    });
    expect(checkbox).toBeDefined();
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(false);

    fireEvent.click(checkbox);
    expect(onSelectToggle).toHaveBeenCalledTimes(1);
    expect(onSelectToggle).toHaveBeenCalledWith(mockCandidate, mockMatch);
  });

  test("disables checkbox when candidate has active invitation (Pending or Accepted)", () => {
    render(
      <CandidateCard
        candidate={mockCandidate}
        match={{ ...mockMatch, invitationStatus: "Pending" }}
        selectable={true}
        selected={false}
        selectionDisabled={true}
      />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /Select Alex Rivera/i,
    });
    expect(checkbox.disabled).toBe(true);
    expect(screen.getByText("Invitation Pending")).toBeDefined();
  });

  test("allows selection when candidate invitation is Withdrawn or Declined", () => {
    const onSelectToggle = vi.fn();
    render(
      <CandidateCard
        candidate={mockCandidate}
        match={{ ...mockMatch, invitationStatus: "Withdrawn" }}
        selectable={true}
        selected={true}
        onSelectToggle={onSelectToggle}
        selectionDisabled={false}
      />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /Select Alex Rivera/i,
    });
    expect(checkbox.disabled).toBe(false);
    expect(checkbox.checked).toBe(true);
    expect(screen.getByText("Invite Again")).toBeDefined();
  });

  test("preserves single candidate action buttons like View Profile and Invite", () => {
    const onViewProfile = vi.fn();
    const onSendRequest = vi.fn();

    render(
      <CandidateCard
        candidate={mockCandidate}
        match={mockMatch}
        onViewProfile={onViewProfile}
        onSendRequest={onSendRequest}
      />,
    );

    fireEvent.click(screen.getByText("View Profile"));
    expect(onViewProfile).toHaveBeenCalledWith(mockCandidate, mockMatch);

    fireEvent.click(screen.getByText("Invite"));
    expect(onSendRequest).toHaveBeenCalledWith(mockCandidate, mockMatch);
  });
});

describe("BulkInvitationComposer", () => {
  const selectedCandidates = [
    {
      candidate: {
        _id: "cand-1",
        name: "Alice Smith",
        skills: [{ name: "React" }],
      },
      match: { score: 92, matchedSkills: ["React"] },
      role: "Frontend Developer",
    },
    {
      candidate: {
        _id: "cand-2",
        name: "Bob Jones",
        skills: [{ name: "React" }],
      },
      match: { score: 88, matchedSkills: ["React"] },
      role: "Frontend Developer",
    },
    {
      candidate: {
        _id: "cand-3",
        name: "Charlie Day",
        skills: [{ name: "React" }],
      },
      match: { score: 84, matchedSkills: ["React"] },
      role: "Frontend Developer",
    },
  ];

  test("displays selected candidates, role, and count", () => {
    render(
      <BulkInvitationComposer
        isOpen={true}
        ideaId="idea-123"
        ideaTitle="Startup Platform"
        role="Frontend Developer"
        selectedCandidates={selectedCandidates}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Send Invitations")).toBeDefined();
    expect(screen.getByText(/3/)).toBeDefined();
    expect(screen.getByText(/Alice Smith/)).toBeDefined();
    expect(screen.getByText(/Bob Jones/)).toBeDefined();
    expect(screen.getByText(/Charlie Day/)).toBeDefined();
  });

  test("message textarea is editable and character count updates", () => {
    render(
      <BulkInvitationComposer
        isOpen={true}
        ideaId="idea-123"
        ideaTitle="Startup Platform"
        role="Frontend Developer"
        selectedCandidates={selectedCandidates}
        onClose={vi.fn()}
      />,
    );

    const textarea = screen.getByLabelText(/Invitation Message/i);
    expect(textarea.value).toContain("Hi {candidateName}");

    fireEvent.change(textarea, {
      target: { value: "Custom invitation message for {candidateName}!" },
    });
    expect(textarea.value).toBe(
      "Custom invitation message for {candidateName}!",
    );
  });

  test("disables send button when message is empty", () => {
    render(
      <BulkInvitationComposer
        isOpen={true}
        ideaId="idea-123"
        ideaTitle="Startup Platform"
        role="Frontend Developer"
        selectedCandidates={selectedCandidates}
        onClose={vi.fn()}
      />,
    );

    const textarea = screen.getByLabelText(/Invitation Message/i);
    fireEvent.change(textarea, { target: { value: "   " } });

    const sendBtn = screen.getByRole("button", { name: /Send Invitations/i });
    expect(sendBtn.disabled).toBe(true);
  });

  test("sends individual invitations with candidate name substitution", async () => {
    const sendInvitationSpy = vi
      .spyOn(matchingApi, "sendInvitation")
      .mockResolvedValue({ success: true, invitation: { status: "Pending" } });

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <BulkInvitationComposer
        isOpen={true}
        ideaId="idea-123"
        ideaTitle="Startup Platform"
        role="Frontend Developer"
        selectedCandidates={selectedCandidates}
        onSuccess={onSuccess}
        onClose={onClose}
      />,
    );

    const textarea = screen.getByLabelText(/Invitation Message/i);
    fireEvent.change(textarea, {
      target: { value: "Hello {candidateName}, join our team!" },
    });

    const sendBtn = screen.getByRole("button", {
      name: /Send Invitations \(3\)/i,
    });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(sendInvitationSpy).toHaveBeenCalledTimes(3);
    });

    expect(sendInvitationSpy).toHaveBeenNthCalledWith(
      1,
      "idea-123",
      "cand-1",
      "Frontend Developer",
      "Hello Alice Smith, join our team!",
    );
    expect(sendInvitationSpy).toHaveBeenNthCalledWith(
      2,
      "idea-123",
      "cand-2",
      "Frontend Developer",
      "Hello Bob Jones, join our team!",
    );
    expect(sendInvitationSpy).toHaveBeenNthCalledWith(
      3,
      "idea-123",
      "cand-3",
      "Frontend Developer",
      "Hello Charlie Day, join our team!",
    );

    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        successCount: 3,
      }),
    );

    sendInvitationSpy.mockRestore();
  });

  test("handles partial failure without failing successful sends", async () => {
    const sendInvitationSpy = vi
      .spyOn(matchingApi, "sendInvitation")
      .mockImplementation((ideaId, candidateId) => {
        if (candidateId === "cand-1") {
          return Promise.resolve({
            success: true,
            invitation: { _id: "inv-1", status: "Pending" },
          });
        }
        if (candidateId === "cand-2") {
          const err = new Error("Invitation already exists");
          err.status = 409;
          err.code = "INVITATION_EXISTS";
          return Promise.reject(err);
        }
        const err = new Error("Network error");
        err.status = 500;
        return Promise.reject(err);
      });

    const onSuccess = vi.fn();

    render(
      <BulkInvitationComposer
        isOpen={true}
        ideaId="idea-123"
        ideaTitle="Startup Platform"
        role="Frontend Developer"
        selectedCandidates={selectedCandidates}
        onSuccess={onSuccess}
        onClose={vi.fn()}
      />,
    );

    const sendBtn = screen.getByRole("button", {
      name: /Send Invitations \(3\)/i,
    });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/1 invitation sent successfully/i)).toBeDefined();
    });

    expect(screen.getByText("✓ Sent")).toBeDefined();
    expect(screen.getByText(/Already has an active invitation/i)).toBeDefined();
    expect(screen.getByText(/Network error/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Retry Failed/i })).toBeDefined();

    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        successCount: 1,
      }),
    );

    sendInvitationSpy.mockRestore();
  });

  test("AI generation populates message with template placeholder", async () => {
    const aiSpy = vi
      .spyOn(matchingApi, "generateInvitationMessage")
      .mockResolvedValue({
        message:
          "Hi Alice Smith, we are creating an exciting React project and would love to have you.",
      });

    render(
      <BulkInvitationComposer
        isOpen={true}
        ideaId="idea-123"
        ideaTitle="Startup Platform"
        role="Frontend Developer"
        selectedCandidates={selectedCandidates}
        onClose={vi.fn()}
      />,
    );

    const aiBtn = screen.getByRole("button", { name: /Generate with AI/i });
    fireEvent.click(aiBtn);

    await waitFor(() => {
      const textarea = screen.getByLabelText(/Invitation Message/i);
      expect(textarea.value).toContain("{candidateName}");
      expect(textarea.value).not.toContain("Alice Smith");
    });

    aiSpy.mockRestore();
  });

  test("AI generation failure preserves existing draft and shows error without fake fallback", async () => {
    const aiSpy = vi
      .spyOn(matchingApi, "generateInvitationMessage")
      .mockRejectedValue(new Error("AI service unavailable"));

    render(
      <BulkInvitationComposer
        isOpen={true}
        ideaId="idea-123"
        ideaTitle="Startup Platform"
        role="Frontend Developer"
        selectedCandidates={selectedCandidates}
        onClose={vi.fn()}
      />,
    );

    const textarea = screen.getByLabelText(/Invitation Message/i);
    fireEvent.change(textarea, {
      target: { value: "My preserved founder draft." },
    });

    const aiBtn = screen.getByRole("button", { name: /Generate with AI/i });
    fireEvent.click(aiBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/AI generation failed. Your current draft was kept./i),
      ).toBeDefined();
    });

    expect(textarea.value).toBe("My preserved founder draft.");
    aiSpy.mockRestore();
  });
});
