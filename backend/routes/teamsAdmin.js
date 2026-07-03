const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const { requireAdminAuth } = require('../middleware/auth');

// PUT /api/admin/teams/:teamId/webhook
// Body: { teamsWebhookUrl: "https://..." }
router.put('/teams/:teamId/webhook', requireAdminAuth, async (req, res) => {
  try {
    const { teamsWebhookUrl } = req.body;

    if (!teamsWebhookUrl) {
      return res.status(400).json({
        success: false,
        message: 'teamsWebhookUrl is required'
      });
    }

    const team = await Team.findByIdAndUpdate(
      req.params.teamId,
      { teamsWebhookUrl },
      { new: true }
    );

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    res.json({ success: true, team });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
