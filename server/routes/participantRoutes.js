const express = require('express');
const router = express.Router();
const { getAll, create, setAsLaureate, getByExhibition, remove } = require('../controllers/participantController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, getAll);
router.get('/exhibition/:exhibitionId', authenticate, getByExhibition);
router.post('/', authenticate, requireAdmin, create);
router.put('/:id/laureate', authenticate, requireAdmin, setAsLaureate);
router.delete('/:id', authenticate, requireAdmin, remove);

module.exports = router;