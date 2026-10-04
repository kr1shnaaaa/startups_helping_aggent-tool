import { rolesMatch } from "./matchGrouping";

const getRequiredCount = (value) => {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : 1;
};

export const calculateTeamCompletion = (rolesAndSkills = [], members = []) => {
  const requirements = Array.isArray(rolesAndSkills)
    ? rolesAndSkills.filter(
        (requirement) =>
          requirement?.role && requirement?.priority !== "nice-to-have",
      )
    : [];
  const teamMembers = Array.isArray(members) ? members : [];
  const roleSlots = requirements.flatMap((requirement, roleIndex) =>
    Array.from({ length: getRequiredCount(requirement.count) }, () => ({
      role: requirement.role,
      roleIndex,
    })),
  );
  const slotByMember = Array(teamMembers.length).fill(-1);

  const assignSlot = (slotIndex, visitedMembers) => {
    const requiredRole = roleSlots[slotIndex].role;

    for (let memberIndex = 0; memberIndex < teamMembers.length; memberIndex += 1) {
      const memberRole = teamMembers[memberIndex]?.role;
      if (
        visitedMembers.has(memberIndex) ||
        !rolesMatch(memberRole, requiredRole)
      ) {
        continue;
      }

      visitedMembers.add(memberIndex);
      const previousSlot = slotByMember[memberIndex];
      if (
        previousSlot === -1 ||
        assignSlot(previousSlot, visitedMembers)
      ) {
        slotByMember[memberIndex] = slotIndex;
        return true;
      }
    }

    return false;
  };

  roleSlots.forEach((_, slotIndex) => {
    assignSlot(slotIndex, new Set());
  });

  const filledByRole = Array(requirements.length).fill(0);
  slotByMember.forEach((slotIndex) => {
    if (slotIndex >= 0) filledByRole[roleSlots[slotIndex].roleIndex] += 1;
  });

  const roles = requirements.map((requirement, roleIndex) => {
    const required = getRequiredCount(requirement.count);
    const filled = filledByRole[roleIndex];
    return {
      role: requirement.role,
      required,
      filled,
      remaining: Math.max(required - filled, 0),
    };
  });
  const totalRequired = roles.reduce((total, role) => total + role.required, 0);
  const totalFilled = roles.reduce((total, role) => total + role.filled, 0);

  return {
    roles,
    totalRequired,
    totalFilled,
    percentage: totalRequired
      ? Math.round((totalFilled / totalRequired) * 100)
      : 0,
    complete: totalRequired > 0 && totalFilled === totalRequired,
  };
};