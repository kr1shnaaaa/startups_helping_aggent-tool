const mongoose = require('mongoose');

const matchContextSchema = new mongoose.Schema(
  {
    score: { type: Number, min: 0, max: 100, required: true },
    matchedSkills: { type: [{ type: String, trim: true }], default: [] },
    missingSkills: { type: [{ type: String, trim: true }], default: [] },
    scoringVersion: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const invitationSchema = new mongoose.Schema(
  {
    ideaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Idea', required: true },
    fromFounder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toCandidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    message: { type: String, trim: true, maxlength: 2000 },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
    matchContext: { type: matchContextSchema, required: true },
    status: { type: String, enum: ['Pending', 'Accepted', 'Declined', 'Withdrawn'], default: 'Pending' },
    respondedAt: Date,
    withdrawnAt: Date,
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  },
  { timestamps: true, autoIndex: false },
);

invitationSchema.index(
  { ideaId: 1, toCandidate: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['Pending', 'Accepted'] } },
    name: 'idea_candidate_active_unique',
  },
);
invitationSchema.index({ ideaId: 1, toCandidate: 1, createdAt: -1 });
invitationSchema.index({ fromFounder: 1, status: 1 });
invitationSchema.index({ toCandidate: 1, status: 1 });
invitationSchema.index({ teamId: 1, status: 1 });

module.exports = mongoose.model('Invitation', invitationSchema);
