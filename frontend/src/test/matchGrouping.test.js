import { describe, expect, test } from 'vitest';
import {
  groupMatchesByRequiredRoles,
  MAX_CANDIDATES_PER_ROLE,
  normalizeInvitationStatus,
} from '../utils/matchGrouping';

describe('groupMatchesByRequiredRoles', () => {
  test('keeps backend ranking and caps each role at eight candidates', () => {
    const rolesAndSkills = [
      { role: 'Frontend Developer', skills: ['React'] },
      { role: 'Backend Developer', skills: ['Node.js'] },
    ];

    const matches = [
      { candidate: { targetRoles: ['Frontend Developer'] }, score: 80, explanation: { roleMatches: ['Frontend Developer'], matchedSkills: ['React'], missingSkills: [] } },
      { candidate: { targetRoles: ['Frontend Developer'] }, score: 92, explanation: { roleMatches: ['Frontend Developer'], matchedSkills: ['React'], missingSkills: [] } },
      { candidate: { targetRoles: ['Frontend Developer'] }, score: 88, explanation: { roleMatches: ['Frontend Developer'], matchedSkills: ['React'], missingSkills: [] } },
      { candidate: { targetRoles: ['Frontend Developer'] }, score: 71, explanation: { roleMatches: ['Frontend Developer'], matchedSkills: ['React'], missingSkills: [] } },
      { candidate: { targetRoles: ['Backend Developer'] }, score: 90, explanation: { roleMatches: ['Backend Developer'], matchedSkills: ['Node.js'], missingSkills: [] } },
      { candidate: { targetRoles: ['Backend Developer'] }, score: 84, explanation: { roleMatches: ['Backend Developer'], matchedSkills: ['Node.js'], missingSkills: [] } },
    ];

    const grouped = groupMatchesByRequiredRoles(rolesAndSkills, matches);

    expect(grouped[0].role).toBe('Frontend Developer');
    expect(grouped[0].candidates[0].score).toBe(92);
    expect(grouped[0].candidates).toHaveLength(4);
    expect(grouped[1].candidates[0].score).toBe(90);
    expect(grouped[1].candidates).toHaveLength(2);
    expect(MAX_CANDIDATES_PER_ROLE).toBe(8);
  });

  test('normalizes API case and formatting drift for roles and invitation statuses', () => {
    const grouped = groupMatchesByRequiredRoles(
      [{ role: 'Full Stack Engineer', skills: ['React', 'Node.js'] }],
      [{
        candidate: { targetRoles: ['Frontend Engineer'] },
        score: 91,
        explanation: {
          roleMatches: ['Frontend Developer'],
          matchedSkills: ['React'],
          missingSkills: ['TypeScript'],
          recommendationReason: 'Strong frontend fit',
        },
        invitationStatus: 'pending',
      }],
    );

    expect(grouped).toHaveLength(1);
    expect(grouped[0].candidates).toHaveLength(1);
    expect(grouped[0].candidates[0].explanation.roleMatches[0]).toBe('Frontend Developer');
    expect(normalizeInvitationStatus('pending')).toBe('Pending');
  });

  test('returns an empty candidate list when no role matches exist', () => {
    const grouped = groupMatchesByRequiredRoles(
      [{ role: 'UI/UX Designer', skills: ['Figma'] }],
      [{ candidate: { targetRoles: ['Frontend Developer'] }, score: 95, explanation: { roleMatches: ['Frontend Developer'] } }],
    );

    expect(grouped).toHaveLength(1);
    expect(grouped[0].candidates).toHaveLength(0);
  });
});
