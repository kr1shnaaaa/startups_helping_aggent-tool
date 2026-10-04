const mongoose = require('mongoose');
const Team = require('../models/Team');
const Invitation = require('../models/Invitation');
const Idea = require('../models/Idea');
const User = require('../models/User');

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

const getAuthenticatedUser = async (req) => User.findOne({ firebaseUid: req.user.uid });

const populateAuthorizedTeam = async (team) => {
  if (!team) return null;

  const populated = await Team.findById(team._id)
    .populate('founderId', 'name profileImage college location')
    .populate('members.userId', 'name profileImage college location skills targetRoles domainInterests availability workPreference hoursPerWeek')
    .lean();

  return populated;
};

const createTeam = async (req, res) => {
  try {
    const { ideaId, name } = req.body;

    if (!isValidId(ideaId)) {
      return res.status(400).json({ success: false, message: 'Invalid idea ID format', code: 'INVALID_ID' });
    }

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      return res.status(400).json({ success: false, message: 'Team name must be between 2 and 120 characters', code: 'INVALID_TEAM_NAME' });
    }

    const founder = await getAuthenticatedUser(req);
    if (!founder) {
      return res.status(401).json({ success: false, message: 'User profile not found', code: 'USER_NOT_FOUND' });
    }

    const idea = await Idea.findById(ideaId).lean();
    if (!idea) {
      return res.status(404).json({ success: false, message: 'Idea not found', code: 'IDEA_NOT_FOUND' });
    }

    if (String(idea.createdBy) !== String(founder._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to form a team for this idea', code: 'NOT_OWNER' });
    }

    const existingTeam = await Team.exists({ ideaId });
    if (existingTeam) {
      return res.status(409).json({ success: false, message: 'A team already exists for this idea', code: 'TEAM_EXISTS' });
    }

    const session = await mongoose.startSession();
    try {
      let createdTeam = null;
      await session.withTransaction(async () => {
        const acceptedInvitations = await Invitation.find({
          ideaId,
          status: 'Accepted',
          teamId: { $exists: false },
        })
          .sort({ createdAt: 1 })
          .session(session)
          .lean();

        if (!acceptedInvitations.length) {
          const err = new Error('No accepted invitations available for team formation');
          err.code = 'NO_ACCEPTED_INVITATIONS';
          throw err;
        }

        createdTeam = await Team.create([
          {
            ideaId,
            founderId: founder._id,
            name: trimmedName,
            members: acceptedInvitations.map((invitation) => ({
              userId: invitation.toCandidate,
              role: invitation.role,
              invitationId: invitation._id,
              joinedAt: new Date(),
            })),
            status: 'Active',
          },
        ], { session });

        for (const invitation of acceptedInvitations) {
          await Invitation.updateOne(
            { _id: invitation._id, status: 'Accepted', teamId: { $exists: false } },
            { $set: { teamId: createdTeam[0]._id } },
            { session },
          );
        }
      });

      const teamDetail = await populateAuthorizedTeam(createdTeam[0]);
      return res.status(201).json({ success: true, team: teamDetail });
    } catch (error) {
      if (error.code === 11000 || error.message === 'No accepted invitations available for team formation' || error.code === 'NO_ACCEPTED_INVITATIONS') {
        const statusCode = error.code === 'NO_ACCEPTED_INVITATIONS' ? 409 : 409;
        return res.status(statusCode).json({
          success: false,
          message: error.code === 'NO_ACCEPTED_INVITATIONS' ? 'At least one accepted invitation is required to form a team' : 'A team already exists for this idea',
          code: error.code === 'NO_ACCEPTED_INVITATIONS' ? 'NO_ACCEPTED_INVITATIONS' : 'TEAM_EXISTS',
        });
      }

      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'A team already exists for this idea', code: 'TEAM_EXISTS' });
      }

      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('[ERROR] POST /teams:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to form team', code: 'TEAM_CREATE_FAILED' });
  }
};

const addTeamMember = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { candidateId } = req.body;

    if (!isValidId(teamId)) {
      return res.status(400).json({ success: false, message: 'Invalid team ID format', code: 'INVALID_ID' });
    }

    if (!isValidId(candidateId)) {
      return res.status(400).json({ success: false, message: 'Invalid candidate ID format', code: 'INVALID_CANDIDATE_ID' });
    }

    const founder = await getAuthenticatedUser(req);
    if (!founder) {
      return res.status(401).json({ success: false, message: 'User profile not found', code: 'USER_NOT_FOUND' });
    }

    const team = await Team.findById(teamId).lean();
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found', code: 'TEAM_NOT_FOUND' });
    }

    if (String(team.founderId) !== String(founder._id)) {
      return res.status(403).json({ success: false, message: 'Only the team founder can add members', code: 'FORBIDDEN' });
    }

    if (String(candidateId) === String(founder._id)) {
      return res.status(409).json({ success: false, message: 'The founder cannot be added as a team member', code: 'INVALID_MEMBER' });
    }

    const alreadyMember = team.members.some((member) => String(member.userId) === String(candidateId));
    if (alreadyMember) {
      return res.status(409).json({ success: false, message: 'Candidate is already a team member', code: 'ALREADY_TEAM_MEMBER' });
    }

    const candidate = await User.findById(candidateId).lean();
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found', code: 'CANDIDATE_NOT_FOUND' });
    }

    const acceptedInvitation = await Invitation.findOne({
      ideaId: team.ideaId,
      toCandidate: candidateId,
      status: 'Accepted',
    }).sort({ createdAt: -1 }).lean();

    if (!acceptedInvitation) {
      return res.status(409).json({ success: false, message: 'Only accepted invitations can be added to a team', code: 'INVITATION_NOT_ACCEPTED' });
    }

    const updatedTeam = await Team.findByIdAndUpdate(
      teamId,
      {
        $push: {
          members: {
            userId: candidateId,
            role: acceptedInvitation.role || 'Team member',
            invitationId: acceptedInvitation._id,
            joinedAt: new Date(),
          },
        },
      },
      { new: true },
    )
      .populate('founderId', 'name profileImage college location')
      .populate('members.userId', 'name profileImage college location skills targetRoles domainInterests availability workPreference hoursPerWeek')
      .lean();

    await Invitation.updateOne(
      { _id: acceptedInvitation._id },
      { $set: { teamId: teamId } },
    );

    return res.status(200).json({ success: true, message: 'Candidate added to team', team: updatedTeam });
  } catch (error) {
    console.error('[ERROR] POST /teams/:teamId/members:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to add team member', code: 'TEAM_MEMBER_CREATE_FAILED' });
  }
};

const getTeam = async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!isValidId(teamId)) {
      return res.status(400).json({ success: false, message: 'Invalid team ID format', code: 'INVALID_ID' });
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User profile not found', code: 'USER_NOT_FOUND' });
    }

    const team = await Team.findById(teamId)
      .populate('founderId', 'name profileImage college location')
      .populate('members.userId', 'name profileImage college location skills targetRoles domainInterests availability workPreference hoursPerWeek')
      .lean();

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found', code: 'TEAM_NOT_FOUND' });
    }

    const isAuthorized = String(team.founderId?._id || team.founderId) === String(user._id)
      || team.members.some((member) => String(member.userId) === String(user._id));

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this team', code: 'FORBIDDEN' });
    }

    return res.status(200).json({ success: true, team });
  } catch (error) {
    console.error('[ERROR] GET /teams/:teamId:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to get team', code: 'TEAM_READ_FAILED' });
  }
};

const listTeams = async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User profile not found', code: 'USER_NOT_FOUND' });
    }

    const teams = await Team.find({
      $or: [{ founderId: user._id }, { 'members.userId': user._id }],
    })
      .populate('founderId', 'name profileImage college location')
      .populate('members.userId', 'name profileImage college location skills targetRoles domainInterests availability workPreference hoursPerWeek')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, teams });
  } catch (error) {
    console.error('[ERROR] GET /teams:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to list teams', code: 'TEAM_LIST_FAILED' });
  }
};

module.exports = { createTeam, getTeam, listTeams, addTeamMember };
