import { describe, expect, test } from "vitest";
import { calculateTeamCompletion } from "../utils/teamCompletion";

describe("calculateTeamCompletion", () => {
  test("reports no filled positions when there are no team members", () => {
    const result = calculateTeamCompletion(
      [{ role: "Backend Developer", count: 1 }],
      [],
    );

    expect(result.roles).toEqual([
      { role: "Backend Developer", required: 1, filled: 0, remaining: 1 },
    ]);
    expect(result.percentage).toBe(0);
    expect(result.complete).toBe(false);
  });

  test("counts one actual member for a matching required role", () => {
    const result = calculateTeamCompletion(
      [{ role: "Backend Developer", count: 1 }],
      [{ role: "Backend Developer" }],
    );

    expect(result.roles[0]).toMatchObject({ filled: 1, remaining: 0 });
    expect(result.percentage).toBe(100);
    expect(result.complete).toBe(true);
  });

  test("reports per-role and overall partial completion across multiple roles", () => {
    const result = calculateTeamCompletion(
      [
        { role: "Backend Developer", count: 1 },
        { role: "Frontend Developer", count: 1 },
        { role: "UI/UX Designer", count: 1 },
      ],
      [{ role: "Backend Developer" }],
    );

    expect(result.roles.map(({ filled, remaining }) => [filled, remaining])).toEqual([
      [1, 0],
      [0, 1],
      [0, 1],
    ]);
    expect(result.totalRequired).toBe(3);
    expect(result.totalFilled).toBe(1);
    expect(result.percentage).toBe(33);
    expect(result.complete).toBe(false);
  });

  test("reports 100 percent only when all required positions are filled", () => {
    const result = calculateTeamCompletion(
      [
        { role: "Backend Developer", count: 1 },
        { role: "Frontend Developer", count: 1 },
      ],
      [{ role: "Backend Developer" }, { role: "Frontend Developer" }],
    );

    expect(result.percentage).toBe(100);
    expect(result.complete).toBe(true);
  });

  test("supports multiple people required for the same role", () => {
    const result = calculateTeamCompletion(
      [{ role: "Backend Developer", count: 2 }],
      [{ role: "Backend Developer" }],
    );

    expect(result.roles[0]).toMatchObject({
      required: 2,
      filled: 1,
      remaining: 1,
    });
    expect(result.percentage).toBe(50);
  });

  test("does not count accepted invitations unless their candidates are team members", () => {
    const acceptedInvitations = [
      { status: "Accepted", role: "Backend Developer", toCandidate: "candidate-1" },
    ];
    const result = calculateTeamCompletion(
      [{ role: "Backend Developer", count: 1 }],
      [],
    );

    expect(acceptedInvitations).toHaveLength(1);
    expect(result.roles[0].filled).toBe(0);
  });

  test("uses actual member role data and the existing Full Stack compatibility convention", () => {
    const result = calculateTeamCompletion(
      [{ role: "Backend Developer", count: 1 }],
      [{ userId: { _id: "candidate-1", name: "Alex Developer" }, role: "Full Stack Developer" }],
    );

    expect(result.roles[0].filled).toBe(1);
  });

  test("does not allocate one member to multiple required positions", () => {
    const result = calculateTeamCompletion(
      [
        { role: "Full Stack Developer", count: 1 },
        { role: "Backend Developer", count: 1 },
      ],
      [{ role: "Backend Developer" }, { role: "Frontend Developer" }],
    );

    expect(result.totalFilled).toBe(2);
    expect(result.percentage).toBe(100);
  });

  test("excludes nice-to-have roles from required completion", () => {
    const result = calculateTeamCompletion(
      [
        { role: "Backend Developer", count: 1, priority: "must-have" },
        { role: "Marketing", count: 1, priority: "nice-to-have" },
      ],
      [{ role: "Backend Developer" }],
    );

    expect(result.roles).toHaveLength(1);
    expect(result.percentage).toBe(100);
  });
});