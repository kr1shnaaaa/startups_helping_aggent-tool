const express = require('express');
const authenticateUser = require('../middleware/authMiddleware');
const { createTeam, getTeam, listTeams, addTeamMember } = require('../controllers/teamController');

const router = express.Router();

router.use(authenticateUser);
router.post('/', createTeam);
router.get('/', listTeams);
router.post('/:teamId/members', addTeamMember);
router.get('/:teamId', getTeam);

module.exports = router;
