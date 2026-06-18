const Contract = require('../models/Contract');

const getAll = async (req, res) => {
    try {
        let filter = {};
        
        if (req.user && req.user.role !== 'admin') {
            filter = { userId: req.user.id };
        }
        
        const contracts = await Contract.find(filter)
            .populate('exhibitionId', 'name startDate endDate')
            .sort({ signedAt: -1 });
        
        res.json(contracts);
    } catch (err) {
        console.error('Ошибка в getAll contracts:', err);
        res.status(500).json({ error: err.message });
    }
};

const create = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Требуется авторизация' });
        }
        
        const { exhibitionId, buyer, seller, product, quantity, amount } = req.body;
        
        if (!exhibitionId) {
            return res.status(400).json({ error: 'Не указана выставка' });
        }
        if (!buyer || !buyer.trim()) {
            return res.status(400).json({ error: 'Введите покупателя' });
        }
        if (!seller || !seller.trim()) {
            return res.status(400).json({ error: 'Введите продавца' });
        }
        if (!product || !product.trim()) {
            return res.status(400).json({ error: 'Введите товар' });
        }
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Укажите сумму контракта' });
        }
        
        const contractData = {
            exhibitionId: exhibitionId,
            buyer: buyer.trim(),
            seller: seller.trim(),
            product: product.trim(),
            quantity: parseInt(quantity) || 0,
            amount: parseInt(amount) || 0,
            userId: req.user.id
        };
        
        const contract = new Contract(contractData);
        await contract.save();
        
        const populatedContract = await Contract.findById(contract._id)
            .populate('exhibitionId', 'name');
        
        res.json(populatedContract);
    } catch (err) {
        console.error('Ошибка в create contract:', err);
        res.status(400).json({ error: err.message });
    }
};

const getByExhibition = async (req, res) => {
    try {
        let filter = { exhibitionId: req.params.exhibitionId };
        
        if (req.user && req.user.role !== 'admin') {
            filter = {
                ...filter,
                userId: req.user.id
            };
        }
        
        const contracts = await Contract.find(filter).populate('exhibitionId', 'name');
        res.json(contracts);
    } catch (err) {
        console.error('Ошибка в getByExhibition:', err);
        res.status(500).json({ error: err.message });
    }
};

const remove = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }
        
        const contract = await Contract.findByIdAndDelete(req.params.id);
        if (!contract) {
            return res.status(404).json({ error: 'Контракт не найден' });
        }
        
        res.json({ message: 'Контракт удален' });
    } catch (err) {
        console.error('Ошибка в remove contract:', err);
        res.status(500).json({ error: err.message });
    }
};

const cleanOldContracts = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }
        
        const allContracts = await Contract.find().populate('exhibitionId');
        let deletedCount = 0;
        let orphanedContracts = [];
        
        for (const contract of allContracts) {
            if (!contract.exhibitionId) {
                orphanedContracts.push(contract._id);
            }
        }
        
        if (orphanedContracts.length > 0) {
            const result = await Contract.deleteMany({ _id: { $in: orphanedContracts } });
            deletedCount = result.deletedCount;
        }
        
        res.json({
            message: 'Очистка завершена',
            deletedCount: deletedCount
        });
    } catch (err) {
        console.error('Ошибка в cleanOldContracts:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getAll, create, getByExhibition, remove, cleanOldContracts };