const mongoose = require('mongoose');
const Invitation = require('../models/Invitation');
const Idea = require('../models/Idea');
const User = require('../models/User');
const Match = require('../models/Match');

const safePopulate = [
  { path: 'ideaId', select: 'title domain status createdBy' },
  { path: 'fromFounder', select: 'name profileImage college location' },
  { path: 'toCandidate', select: 'name profileImage college location skills targetRoles domainInterests availability workPreference hoursPerWeek' },
];

const actor = (req) => User.findOne({ firebaseUid: req.user.uid });
const validId = (value) => mongoose.Types.ObjectId.isValid(value);

const sendInvitation = async (req, res) => {
  try {
    const { ideaId, candidateId, role, message } = req.body;
    if (![ideaId, candidateId].every(validId) || typeof role !== 'string' || role.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'ideaId, candidateId, and role are required', code: 'INVALID_INVITATION' });
    }
    const founder = await actor(req);
    if (!founder) return res.status(401).json({ success: false, message: 'User profile not found', code: 'USER_NOT_FOUND' });
    const idea = await Idea.findById(ideaId).lean();
    if (!idea) return res.status(404).json({ success: false, message: 'Idea not found', code: 'IDEA_NOT_FOUND' });
    if (String(idea.createdBy) !== String(founder._id)) return res.status(403).json({ success: false, message: 'Not authorized to invite for this idea', code: 'NOT_OWNER' });
    if (!idea.aiAnalysis?.isApproved) return res.status(409).json({ success: false, message: 'Idea analysis must be approved before inviting', code: 'ANALYSIS_NOT_APPROVED' });
    const candidate = await User.findOne({ _id: candidateId, profileType: 'candidate', profileCompleted: true }).lean();
    if (!candidate || String(candidate._id) === String(founder._id)) return res.status(400).json({ success: false, message: 'Eligible candidate not found', code: 'INVALID_CANDIDATE' });
    const match = await Match.findOne({ ideaId, userId: candidateId }).lean();
    if (!match) return res.status(409).json({ success: false, message: 'Candidate must have a match snapshot first', code: 'MATCH_REQUIRED' });

    const historicalInvitations = await Invitation.find({ ideaId, toCandidate: candidateId }).sort({ createdAt: -1 }).lean();
    const activeInvitation = historicalInvitations.find((entry) => ['Pending', 'Accepted'].includes(entry.status));
    if (activeInvitation) return res.status(409).json({ success: false, message: 'Invitation already exists', code: 'INVITATION_EXISTS' });
    if (historicalInvitations.length > 0 && !historicalInvitations.some((entry) => entry.status === 'Withdrawn') && historicalInvitations[0].status === 'Declined') {
      return res.status(409).json({ success: false, message: 'A previous invitation was declined and cannot be reopened', code: 'INVITATION_DECLINED' });
    }

    const values = {
      ideaId,
      toCandidate: candidate._id,
      fromFounder: founder._id,
      role: role.trim(),
      message: typeof message === 'string' ? message.trim() : undefined,
      matchId: match._id,
      matchContext: { score: match.matchScore, matchedSkills: match.explanation?.matchedSkills || match.matchedSkills, missingSkills: match.explanation?.missingSkills || [], scoringVersion: match.scoringVersion || 'v1' },
      status: 'Pending',
      respondedAt: undefined,
      withdrawnAt: undefined,
    };
    const invitation = await Invitation.create(values);
    if (!invitation) return res.status(409).json({ success: false, message: 'Invitation state changed; retry', code: 'INVITATION_CONFLICT' });
    return res.status(201).json({ success: true, invitation });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Invitation already exists', code: 'INVITATION_EXISTS' });
    console.error('[ERROR] POST /invitations:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to send invitation', code: 'INVITATION_FAILED' });
  }
};

const listInvitations = async (req, res) => {
  try {
    const user = await actor(req);
    if (!user) return res.status(401).json({ success: false, message: 'User profile not found' });
    const status = req.query.status;
    if (status && !['Pending', 'Accepted', 'Declined', 'Withdrawn'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid invitation status' });
    const direction = req.query.direction || 'received';
    const query = direction === 'sent' ? { fromFounder: user._id } : direction === 'received' ? { toCandidate: user._id } : null;
    if (!query) return res.status(400).json({ success: false, message: 'direction must be sent or received' });
    if (status) query.status = status;
    const invitations = await Invitation.find(query).populate(safePopulate).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, invitations });
  } catch (error) {
    console.error('[ERROR] GET /invitations:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to list invitations' });
  }
};

const getInvitation = async (req, res) => {
  try {
    if (!validId(req.params.invitationId)) return res.status(400).json({ success: false, message: 'Invalid invitation ID' });
    const user = await actor(req);
    if (!user) return res.status(401).json({ success: false, message: 'User profile not found' });
    const invitation = await Invitation.findOne({ _id: req.params.invitationId, $or: [{ fromFounder: user._id }, { toCandidate: user._id }] }).populate(safePopulate).lean();
    if (!invitation) return res.status(404).json({ success: false, message: 'Invitation not found' });
    return res.status(200).json({ success: true, invitation });
  } catch (error) {
    console.error('[ERROR] GET /invitations/:id:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to get invitation' });
  }
};

const transition = async (req, res, action) => {
  if (!validId(req.params.invitationId)) return res.status(400).json({ success: false, message: 'Invalid invitation ID' });

  const user = await actor(req);
  if (!user) return res.status(401).json({ success: false, message: 'User profile not found' });

  const id = req.params.invitationId;
  const invitation = await Invitation.findById(id).lean();
  if (!invitation) return res.status(404).json({ success: false, message: 'Invitation not found' });

  const isRecipient = String(invitation.toCandidate) === String(user._id);
  const isFounder = String(invitation.fromFounder) === String(user._id);

  if (action === 'withdraw') {
    if (!isFounder) return res.status(403).json({ success: false, message: 'Only the founder who sent the invitation can withdraw it.', code: 'INVITATION_SENDER_ONLY' });
  }

  if (action === 'accept' || action === 'decline') {
    if (!isRecipient) return res.status(403).json({ success: false, message: 'Only the invitation recipient can accept or decline this invitation.', code: 'INVITATION_RECIPIENT_ONLY' });
  }

  const terminal = action === 'accept' ? 'Accepted' : action === 'decline' ? 'Declined' : 'Withdrawn';
  const current = await Invitation.findOne({ _id: id, status: 'Pending' }).lean();
  if (!current) {
    if (invitation.status === terminal) return res.status(200).json({ success: true, invitation, idempotent: true });
    return res.status(409).json({ success: false, message: 'Invitation is no longer pending', code: 'STALE_INVITATION' });
  }

  const updated = await Invitation.findOneAndUpdate(
    { _id: id, status: 'Pending' },
    {
      $set: {
        status: terminal,
        respondedAt: action === 'withdraw' ? undefined : new Date(),
        withdrawnAt: action === 'withdraw' ? new Date() : undefined,
      },
    },
    { new: true },
  ).lean();

  if (!updated) return res.status(409).json({ success: false, message: 'Invitation state changed; retry', code: 'STALE_INVITATION' });
  return res.status(200).json({ success: true, invitation: updated });
};

const acceptInvitation = (req, res) => transition(req, res, 'accept').catch((error) => { console.error(error); res.status(500).json({ success: false, message: 'Failed to accept invitation' }); });
const declineInvitation = (req, res) => transition(req, res, 'decline').catch((error) => { console.error(error); res.status(500).json({ success: false, message: 'Failed to decline invitation' }); });
const withdrawInvitation = (req, res) => transition(req, res, 'withdraw').catch((error) => { console.error(error); res.status(500).json({ success: false, message: 'Failed to withdraw invitation' }); });

module.exports = { sendInvitation, listInvitations, getInvitation, acceptInvitation, declineInvitation, withdrawInvitation };
