const Application = require('../models/Application');

const getAll = async (req, res) => {
    try {
        let filter = {};
        
        if (req.user && req.user.role !== 'admin') {
            filter = { userId: req.user.id };
        }
        
        const applications = await Application.find(filter)
            .populate('exhibitionId', 'name startDate endDate')
            .populate('userId', 'username fullName email')
            .sort({ createdAt: -1 });
        
        res.json(applications);
    } catch (err) {
        console.error('Ошибка в getAll applications:', err);
        res.status(500).json({ error: err.message });
    }
};

const create = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Для подачи заявки необходимо авторизоваться' });
        }
        
        const { exhibitionId, companyName, contactPerson, phone, email, services } = req.body;
        
        if (!exhibitionId) {
            return res.status(400).json({ error: 'Выберите выставку' });
        }
        if (!companyName || !companyName.trim()) {
            return res.status(400).json({ error: 'Введите название компании' });
        }
        
        const applicationData = {
            exhibitionId: exhibitionId,
            userId: req.user.id,
            companyName: companyName.trim(),
            contactPerson: contactPerson ? contactPerson.trim() : '',
            phone: phone ? phone.trim() : '',
            email: email ? email.trim() : '',
            services: services ? services.trim() : '',
            status: 'pending'
        };
        
        const application = new Application(applicationData);
        await application.save();
        
        const populatedApp = await Application.findById(application._id)
            .populate('exhibitionId', 'name')
            .populate('userId', 'username fullName');
        
        res.json(populatedApp);
    } catch (err) {
        console.error('Ошибка в create application:', err);
        res.status(400).json({ error: err.message });
    }
};

const markAsPaid = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }
        
        const application = await Application.findByIdAndUpdate(
            req.params.id,
            { status: 'paid', paidAt: new Date() },
            { new: true }
        ).populate('exhibitionId', 'name').populate('userId', 'username fullName');
        
        if (!application) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }
        res.json(application);
    } catch (err) {
        console.error('Ошибка в markAsPaid:', err);
        res.status(500).json({ error: err.message });
    }
};

const updateStatus = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }
        
        const { status } = req.body;
        const validStatuses = ['pending', 'paid', 'confirmed', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Неверный статус' });
        }
        
        const application = await Application.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).populate('exhibitionId', 'name').populate('userId', 'username fullName');
        
        if (!application) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }
        res.json(application);
    } catch (err) {
        console.error('Ошибка в updateStatus:', err);
        res.status(400).json({ error: err.message });
    }
};

const remove = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }
        
        const application = await Application.findByIdAndDelete(req.params.id);
        if (!application) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }
        
        res.json({ message: 'Заявка удалена' });
    } catch (err) {
        console.error('Ошибка в remove application:', err);
        res.status(500).json({ error: err.message });
    }
};

const cleanOldApplications = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }
        
        const allApps = await Application.find().populate('exhibitionId');
        let deletedCount = 0;
        let orphanedApps = [];
        
        for (const app of allApps) {
            if (!app.exhibitionId) {
                orphanedApps.push(app._id);
            }
        }
        
        if (orphanedApps.length > 0) {
            const result = await Application.deleteMany({ _id: { $in: orphanedApps } });
            deletedCount = result.deletedCount;
        }
        
        const duplicateGroups = {};
        const apps = await Application.find().populate('exhibitionId', 'name');
        
        for (const app of apps) {
            const key = app.companyName + '|' + (app.exhibitionId ? app.exhibitionId._id.toString() : 'null');
            if (!duplicateGroups[key]) {
                duplicateGroups[key] = [];
            }
            duplicateGroups[key].push(app);
        }
        
        let duplicateDeleted = 0;
        for (const key in duplicateGroups) {
            const group = duplicateGroups[key];
            if (group.length > 1) {
                group.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
           
                const toDelete = group.slice(1);
                for (const app of toDelete) {
                    await Application.findByIdAndDelete(app._id);
                    duplicateDeleted++;
                }
            }
        }
        
        res.json({
            message: 'Очистка завершена',
            orphanedDeleted: deletedCount,
            duplicatesDeleted: duplicateDeleted,
            totalDeleted: deletedCount + duplicateDeleted
        });
    } catch (err) {
        console.error('Ошибка в cleanOldApplications:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getAll, create, markAsPaid, updateStatus, remove, cleanOldApplications };