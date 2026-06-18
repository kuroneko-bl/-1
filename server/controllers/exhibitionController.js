const Exhibition = require('../models/Exhibition');
const Application = require('../models/Application');
const Contract = require('../models/Contract');
const Participant = require('../models/Participant');
const fs = require('fs');
const path = require('path');

const getAll = async (req, res) => {
    try {
        console.log('GET /api/exhibitions - Запрос списка выставок');
        let filter = {};
        
        if (req.user && req.user.role !== 'admin') {
            filter = { userId: req.user.id };
        }
        
        const exhibitions = await Exhibition.find(filter).sort({ startDate: -1 });
        console.log(`Найдено выставок: ${exhibitions.length}`);
        res.json(exhibitions);
    } catch (err) {
        console.error('Ошибка в getAll:', err);
        res.status(500).json({ error: err.message });
    }
};

const getById = async (req, res) => {
    try {
        const exhibition = await Exhibition.findById(req.params.id);
        if (!exhibition) {
            return res.status(404).json({ error: 'Выставка не найдена' });
        }
        
        if (req.user && req.user.role !== 'admin' && exhibition.userId?.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }
        
        res.json(exhibition);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const create = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Требуется авторизация' });
        }
        
        const exhibitionData = {
            name: req.body.name,
            theme: req.body.theme || '',
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            director: req.body.director || req.user.fullName || req.user.username,
            concept: req.body.concept || '',
            businessProgram: req.body.businessProgram || '',
            location: req.body.location || 'Выставочный павильон Технопарк',
            userId: req.user.id,
            status: req.body.status || 'planning'
        };
        
        if (req.files && req.files.length > 0) {
            const imagePaths = req.files.map(file => '/uploads/' + file.filename);
            exhibitionData.images = imagePaths;
            exhibitionData.image = imagePaths[0];
        }
        
        const exhibition = new Exhibition(exhibitionData);
        await exhibition.save();
        res.json(exhibition);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

const update = async (req, res) => {
    try {
        const exhibition = await Exhibition.findById(req.params.id);
        if (!exhibition) {
            return res.status(404).json({ error: 'Выставка не найдена' });
        }
        
        if (req.user.role !== 'admin' && exhibition.userId?.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }
        
        const updateData = req.body;
        
        if (req.files && req.files.length > 0) {
            if (exhibition.images && exhibition.images.length > 0) {
                exhibition.images.forEach(imgPath => {
                    const filePath = path.join(__dirname, '../../public', imgPath);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                });
            }
            
            const imagePaths = req.files.map(file => '/uploads/' + file.filename);
            updateData.images = imagePaths;
            updateData.image = imagePaths[0];
        }
        
        const updated = await Exhibition.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

const remove = async (req, res) => {
    try {
        const exhibition = await Exhibition.findById(req.params.id);
        if (!exhibition) {
            return res.status(404).json({ error: 'Выставка не найдена' });
        }
        
        if (req.user.role !== 'admin' && exhibition.userId?.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }
        
        if (exhibition.images && exhibition.images.length > 0) {
            exhibition.images.forEach(imgPath => {
                const filePath = path.join(__dirname, '../../public', imgPath);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
        }
        
        const appsResult = await Application.deleteMany({ exhibitionId: req.params.id });
        console.log(`Удалено заявок: ${appsResult.deletedCount}`);
        
        const contractsResult = await Contract.deleteMany({ exhibitionId: req.params.id });
        console.log(`Удалено контрактов: ${contractsResult.deletedCount}`);
        
        const participantsResult = await Participant.deleteMany({ exhibitionId: req.params.id });
        console.log(`Удалено участников: ${participantsResult.deletedCount}`);
        
        await Exhibition.findByIdAndDelete(req.params.id);
        
        res.json({ 
            message: 'Выставка и все связанные данные удалены',
            deleted: {
                applications: appsResult.deletedCount,
                contracts: contractsResult.deletedCount,
                participants: participantsResult.deletedCount
            }
        });
    } catch (err) {
        console.error('Ошибка при удалении выставки:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getAll, getById, create, update, remove };