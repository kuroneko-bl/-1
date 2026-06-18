const express = require('express');
const router = express.Router();
const { getAll, create, getByExhibition, remove, cleanOldContracts } = require('../controllers/contractController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, getAll);
router.get('/exhibition/:exhibitionId', authenticate, getByExhibition);
router.post('/', authenticate, create);
router.delete('/:id', authenticate, requireAdmin, remove);
router.post('/clean', authenticate, requireAdmin, cleanOldContracts);

module.exports = router;