const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');
const User = require('./models/User');
const Exhibition = require('./models/Exhibition');
const bcrypt = require('bcryptjs');

dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.use(authenticate);



app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

const authRoutes = require('./routes/authRoutes');
const exhibitionRoutes = require('./routes/exhibitionRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const participantRoutes = require('./routes/participantRoutes');
const contractRoutes = require('./routes/contractRoutes');
const statisticsRoutes = require('./routes/statisticsRoutes');

app.use('/api', authRoutes);
app.use('/api/exhibitions', exhibitionRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/participants', participantRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/statistics', statisticsRoutes);

app.use(errorHandler);

async function initAdmin() {
    try {
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                username: 'admin',
                password: hashedPassword,
                role: 'admin',
                fullName: 'Администратор системы',
                email: 'admin@technopark.ru'
            });
            console.log('Администратор создан: admin / admin123');
        }
        
        const exhibitionsCount = await Exhibition.countDocuments();
        if (exhibitionsCount === 0) {
            await Exhibition.create({
                name: 'Технопром-2024',
                theme: 'Промышленные технологии и инновации',
                startDate: new Date('2024-12-01'),
                endDate: new Date('2024-12-05'),
                director: 'Иванов И.И.',
                status: 'planning',
                concept: 'Международная выставка промышленных технологий'
            });
            console.log('Создана тестовая выставка: Технопром-2024');
        }
        
        console.log(`Статистика БД: ${await Exhibition.countDocuments()} выставок, ${await User.countDocuments()} пользователей`);
    } catch (err) {
        console.error('Ошибка при инициализации:', err.message);
    }
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`\nСервер запущен на http://localhost:${PORT}`);
    console.log(`API доступен по адресу http://localhost:${PORT}/api`);
    console.log(`Откройте в браузере: http://localhost:${PORT}/index.html\n`);
    await initAdmin();
});