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
  listRemarkFields,
  listAllRemarkFields,
  createRemarkField,
  updateRemarkField,
  deleteRemarkField,
  getMemberRemarkFields,
  updateMemberRemarkFields,
} = require('../controllers/remarkOptionsController');

router.get('/', requireAuth, listRemarkOptions);
router.get('/all', requireAdminAuth, listAllRemarkOptions);
router.post('/', requireAdminAuth, createRemarkOption);
router.get('/fields', requireAuth, listRemarkFields);
router.get('/fields/all', requireAdminAuth, listAllRemarkFields);
router.post('/fields', requireAdminAuth, createRemarkField);
router.put('/fields/:id', requireAdminAuth, updateRemarkField);
router.delete('/fields/:id', requireAdminAuth, deleteRemarkField);
router.get('/members/:id/fields', requireAdminAuth, getMemberRemarkFields);
router.put('/members/:id/fields', requireAdminAuth, updateMemberRemarkFields);
router.get('/members/:id', requireAdminAuth, getMemberRemarkOptions);
router.put('/members/:id', requireAdminAuth, updateMemberRemarkOptions);
router.put('/:id', requireAdminAuth, updateRemarkOption);
router.delete('/:id', requireAdminAuth, deleteRemarkOption);

module.exports = router;
