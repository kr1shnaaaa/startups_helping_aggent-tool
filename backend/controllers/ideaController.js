const Idea = require('../models/Idea');
const User = require('../models/User');

// POST /api/ideas — Create new startup idea (founder only)
const createIdea = async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { title, description, category, domain, problemStatement, targetUsers, requiredSkills } = req.body;

    if (!title || title.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Title is required (min 3 characters)' });
    }
    if (!description || description.trim().length < 20) {
      return res.status(400).json({ success: false, message: 'Description is required (min 20 characters)' });
    }

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const idea = await Idea.create({
      createdBy: user._id,
      title: trimmedTitle,
      description: trimmedDescription,
      category: category?.trim() || '',
      domain: domain?.trim() || '',
      problemStatement: problemStatement?.trim() || '',
      targetUsers: targetUsers?.trim() || '',
      requiredSkills: requiredSkills || [],
      status: 'draft',
      original: {
        title: trimmedTitle,
        description: trimmedDescription,
        capturedAt: new Date(),
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Idea created successfully',
      idea,
    });
  } catch (error) {
    console.error('[ERROR] POST /ideas:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to create idea' });
  }
};

// GET /api/ideas — List current user's ideas
const listIdeas = async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { status, limit = 20, skip = 0 } = req.query;
    const query = { createdBy: user._id };
    if (status) query.status = status;

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const safeSkip = Math.max(Number(skip) || 0, 0);

    const [ideas, total] = await Promise.all([
      Idea.find(query)
        .select('title description category domain status original enhanced aiAnalysis.isApproved aiAnalysis.scoring createdAt updatedAt')
        .limit(safeLimit)
        .skip(safeSkip)
        .sort({ createdAt: -1 }),
      Idea.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, ideas, total });
  } catch (error) {
    console.error('[ERROR] GET /ideas:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to list ideas' });
  }
};

// GET /api/ideas/:ideaId — Get single idea
const getIdea = async (req, res) => {
  try {
    const idea = await Idea.findById(req.params.ideaId).populate('createdBy', 'name profileImage');
    if (!idea) {
      return res.status(404).json({ success: false, message: 'Idea not found' });
    }

    return res.status(200).json({ success: true, idea });
  } catch (error) {
    console.error('[ERROR] GET /ideas/:ideaId:', error.message);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid idea ID format' });
    }
    return res.status(500).json({ success: false, message: 'Failed to get idea' });
  }
};

// PUT /api/ideas/:ideaId — Update idea (owner only)
const updateIdea = async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const idea = await Idea.findById(req.params.ideaId);
    if (!idea) {
      return res.status(404).json({ success: false, message: 'Idea not found' });
    }

    if (idea.createdBy.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this idea' });
    }

    const allowedFields = ['title', 'description', 'category', 'domain', 'problemStatement', 'targetUsers', 'requiredSkills', 'enhanced', 'status'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'enhanced') {
          const enhancedInput = req.body.enhanced;
          if (!enhancedInput || typeof enhancedInput !== 'object' || Array.isArray(enhancedInput)) {
            return res.status(400).json({ success: false, message: 'Enhanced idea must be an object' });
          }

          const normalizedEnhanced = {};
          const enhancedKeys = ['title', 'description', 'problem', 'solution', 'targetAudience', 'valueProposition', 'coreWorkflow'];

          for (const key of enhancedKeys) {
            if (enhancedInput[key] !== undefined) {
              normalizedEnhanced[key] = typeof enhancedInput[key] === 'string' ? enhancedInput[key].trim() : enhancedInput[key];
            }
          }

          updates.enhanced = {
            ...(idea.enhanced || {}),
            ...normalizedEnhanced,
            updatedAt: new Date(),
          };

          if (!idea.status || idea.status === 'draft' || idea.status === 'enhancing') {
            updates.status = 'enhanced';
          }
        } else if (field === 'status') {
          const validStatuses = ['draft', 'enhancing', 'enhanced', 'analyzing', 'analyzed', 'matching', 'team-forming', 'complete'];
          if (validStatuses.includes(req.body.status)) {
            updates.status = req.body.status;
          }
        } else {
          updates[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
        }
      }
    }

    // Validate title and description if being updated
    if (updates.title && updates.title.length < 3) {
      return res.status(400).json({ success: false, message: 'Title must be at least 3 characters' });
    }
    if (updates.description && updates.description.length < 20) {
      return res.status(400).json({ success: false, message: 'Description must be at least 20 characters' });
    }

    const updatedIdea = await Idea.findByIdAndUpdate(req.params.ideaId, updates, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: 'Idea updated successfully',
      idea: updatedIdea,
    });
  } catch (error) {
    console.error('[ERROR] PUT /ideas/:ideaId:', error.message);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid idea ID format' });
    }
    return res.status(500).json({ success: false, message: 'Failed to update idea' });
  }
};

// DELETE /api/ideas/:ideaId — Delete idea (owner only, only if no approved analysis)
const deleteIdea = async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const idea = await Idea.findById(req.params.ideaId);
    if (!idea) {
      return res.status(404).json({ success: false, message: 'Idea not found' });
    }

    if (idea.createdBy.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this idea' });
    }

    if (idea.aiAnalysis && idea.aiAnalysis.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete idea with approved analysis. Remove analysis first.',
      });
    }

    await Idea.findByIdAndDelete(req.params.ideaId);

    return res.status(200).json({
      success: true,
      message: 'Idea deleted successfully',
    });
  } catch (error) {
    console.error('[ERROR] DELETE /ideas/:ideaId:', error.message);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid idea ID format' });
    }
    return res.status(500).json({ success: false, message: 'Failed to delete idea' });
  }
};

// GET /api/ideas/discover — Browse open ideas for candidates
const discoverIdeas = async (req, res) => {
  try {
    const { domain, category, limit = 20, skip = 0 } = req.query;

    const query = {
      status: { $in: ['analyzed', 'matching', 'team-forming'] },
      'aiAnalysis.isApproved': true,
    };
    if (domain) query.domain = domain;
    if (category) query.category = category;

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const safeSkip = Math.max(Number(skip) || 0, 0);

    const [ideas, total] = await Promise.all([
      Idea.find(query)
        .populate('createdBy', 'name profileImage college')
        .select('title description category domain aiAnalysis.rolesAndSkills aiAnalysis.teamSize status createdAt')
        .limit(safeLimit)
        .skip(safeSkip)
        .sort({ createdAt: -1 }),
      Idea.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, ideas, total });
  } catch (error) {
    console.error('[ERROR] GET /ideas/discover:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to discover ideas' });
  }
};

module.exports = { createIdea, listIdeas, getIdea, updateIdea, deleteIdea, discoverIdeas };
