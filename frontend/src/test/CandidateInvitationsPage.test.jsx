import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ profileType: 'candidate' }),
}));

vi.mock('../services/matchingApi', () => ({
  listInvitations: vi.fn(),
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
  getIdeaById: vi.fn(),
}));

import CandidateInvitationsPage from '../pages/dashboard/CandidateInvitationsPage';
import { acceptInvitation, declineInvitation, getIdeaById, listInvitations } from '../services/matchingApi';

const baseInvitation = {
  _id: 'inv-1',
  status: 'Pending',
  role: 'Full Stack Developer',
  message: 'Hi there,\n\nWe are building a student startup.',
  createdAt: '2026-09-28T10:00:00.000Z',
  ideaId: {
    _id: 'idea-1',
    title: 'Campus Launchpad',
    description: 'A platform for student founders to discover project opportunities.',
    problemStatement: 'Students struggle to find people and structure for early startup work.',
    targetUsers: 'Student founders',
  },
  fromFounder: { name: 'Riya Shah' },
  matchContext: {
    score: 92,
    matchedSkills: ['React', 'Node.js'],
    missingSkills: ['Design'],
    niceToHaveSkills: ['MongoDB'],
  },
};

describe('CandidateInvitationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listInvitations.mockResolvedValue({ success: true, invitations: [baseInvitation] });
    getIdeaById.mockResolvedValue({
      success: true,
      idea: {
        _id: 'idea-1',
        title: 'Campus Launchpad',
        description: 'A platform for student founders to discover project opportunities.',
        problemStatement: 'Students struggle to find people and structure for early startup work.',
        targetUsers: 'Student founders',
      },
    });
  });

  test('loads and displays backend invitations for the authenticated candidate', async () => {
    render(
      <MemoryRouter>
        <CandidateInvitationsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Invitations/i })).toBeDefined();

    await waitFor(() => {
      expect(listInvitations).toHaveBeenCalledWith('received', '');
    });

    expect(await screen.findByText('Campus Launchpad')).toBeDefined();
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
  });

  test('keeps the filter controls visible for every selected filter state', async () => {
    render(
      <MemoryRouter>
        <CandidateInvitationsPage />
      </MemoryRouter>,
    );

    await screen.findByText('Campus Launchpad');

    const filters = ['All', 'Pending', 'Accepted', 'Declined'];

    for (const filter of filters) {
      fireEvent.click(screen.getByRole('button', { name: filter }));
      for (const option of filters) {
        expect(screen.getByRole('button', { name: option })).toBeDefined();
      }
    }
  });

  test('shows full project details and message content in the modal', async () => {
    render(
      <MemoryRouter>
        <CandidateInvitationsPage />
      </MemoryRouter>,
    );

    await screen.findByText('Campus Launchpad');
    fireEvent.click(screen.getByRole('button', { name: /View Details/i }));

    expect(await screen.findByText('Project Invitation')).toBeDefined();
    expect(screen.getByText('Students struggle to find people and structure for early startup work.')).toBeDefined();
    expect(screen.getAllByText(/Hi there/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/We are building a student startup\./).length).toBeGreaterThan(0);
    expect(screen.getByText('Why You Were Matched')).toBeDefined();
  });

  test('requires confirmation before accept or decline calls the backend', async () => {
    acceptInvitation.mockResolvedValue({ success: true, invitation: { ...baseInvitation, status: 'Accepted' } });
    declineInvitation.mockResolvedValue({ success: true, invitation: { ...baseInvitation, status: 'Declined' } });

    render(
      <MemoryRouter>
        <CandidateInvitationsPage />
      </MemoryRouter>,
    );

    await screen.findByText('Campus Launchpad');
    fireEvent.click(screen.getByRole('button', { name: /View Details/i }));

    const acceptTrigger = screen.getAllByRole('button', { name: /Accept Invitation/i })[0];
    fireEvent.click(acceptTrigger);
    expect(acceptInvitation).not.toHaveBeenCalled();

    await waitFor(() => {
      const confirmButton = screen.getAllByRole('button', { name: /Accept Invitation/i });
      expect(confirmButton.length).toBeGreaterThan(0);
    });

    const acceptConfirm = screen.getAllByRole('button', { name: /Accept Invitation/i })[screen.getAllByRole('button', { name: /Accept Invitation/i }).length - 1];
    fireEvent.click(acceptConfirm);
    await waitFor(() => {
      expect(acceptInvitation).toHaveBeenCalledWith('inv-1');
    });

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    fireEvent.click(screen.getByRole('button', { name: /View Details/i }));

    const declineButtons = screen.getAllByRole('button', { name: /Decline/i });
    fireEvent.click(declineButtons[declineButtons.length - 1]);

    await waitFor(() => {
      const confirmDeclineButtons = screen.getAllByRole('button', { name: /Decline Invitation/i });
      expect(confirmDeclineButtons.length).toBeGreaterThan(0);
    });

    const declineConfirm = screen.getAllByRole('button', { name: /Decline Invitation/i })[screen.getAllByRole('button', { name: /Decline Invitation/i }).length - 1];
    fireEvent.click(declineConfirm);

    await waitFor(() => {
      expect(declineInvitation).toHaveBeenCalledWith('inv-1');
    });
  });
});
