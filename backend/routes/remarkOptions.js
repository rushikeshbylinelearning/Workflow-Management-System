const express = require('express');
const router = express.Router();
const { requireAuth, requireAdminAuth } = require('../middleware/auth');
const {
  listRemarkOptions,
  listAllRemarkOptions,
  createRemarkOption,
  updateRemarkOption,
  deleteRemarkOption,
  getMemberRemarkOptions,
  updateMemberRemarkOptions,
} = require('../controllers/remarkOptionsController');

router.get('/', requireAuth, listRemarkOptions);
router.get('/all', requireAdminAuth, listAllRemarkOptions);
router.post('/', requireAdminAuth, createRemarkOption);
router.put('/:id', requireAdminAuth, updateRemarkOption);
router.delete('/:id', requireAdminAuth, deleteRemarkOption);
router.get('/members/:id', requireAdminAuth, getMemberRemarkOptions);
router.put('/members/:id', requireAdminAuth, updateMemberRemarkOptions);

module.exports = router;
