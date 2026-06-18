const express = require('express');
const router = express.Router();
const { getAll, create, markAsPaid, updateStatus, remove, cleanOldApplications } = require('../controllers/applicationController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, getAll);
router.post('/', authenticate, create);
router.put('/:id/pay', authenticate, requireAdmin, markAsPaid);
router.put('/:id/status', authenticate, requireAdmin, updateStatus);
router.delete('/:id', authenticate, requireAdmin, remove);
router.post('/clean', authenticate, requireAdmin, cleanOldApplications);

module.exports = router;