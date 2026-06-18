const express = require('express');
const router = express.Router();
const { uploadSingle, uploadMultiple } = require('../middleware/upload');
const { getAll, getById, create, update, remove } = require('../controllers/exhibitionController');
const { authenticate, requireAuth } = require('../middleware/auth');

router.get('/', authenticate, getAll);
router.get('/:id', authenticate, getById);

router.post('/', authenticate, requireAuth, uploadMultiple, create);

router.put('/:id', authenticate, requireAuth, uploadMultiple, update);

router.delete('/:id', authenticate, requireAuth, remove);

module.exports = router;