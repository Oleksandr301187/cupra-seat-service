const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// База даних нарядів за замовчуванням
let naryadDatabase = [
    { code: "TOZ0", desc: "Технічне обслуговування", duration: 30 },
    { code: "KUZ0", desc: "Кузовний ремонт", duration: 120 },
    { code: "GAR0", desc: "Гарантійна діагностика", duration: 45 },
    { code: "SHI0", desc: "Шиномонтаж та балансування", duration: 25 },
    { code: "", desc: "", duration: "" },
    { code: "", desc: "", duration: "" },
    { code: "", desc: "", duration: "" },
    { code: "", desc: "", duration: "" },
    { code: "", desc: "", duration: "" },
    { code: "", desc: "", duration: "" }
];

// Автомобілі в процесі обслуговування
let activeJobs = [
    {
        id: 1,
        carNumber: "KA2345AA",
        carModel: "Volkswagen Tiguan",
        code: "TOZ0",
        desc: "Технічне обслуговування",
        duration: 30,
        bookedTime: "11:30",
        skladStatus: "Заявка",
        workStatus: "В роботі",
        timeLeft: 30 * 60
    }
];

io.on('connection', (socket) => {
    console.log('🔌 Підключено пристрій:', socket.id);

    // Первинна передача даних пристрою
    socket.emit('init-data', { naryadDatabase, activeJobs });

    // Оновлення словника з Адмінки
    socket.on('update-naryads', (updatedDb) => {
        naryadDatabase = updatedDb;
        io.emit('naryads-updated', naryadDatabase);
    });

    // Нове замовлення через Сервіс
    socket.on('create-job', (newJob) => {
        activeJobs.push(newJob);
        io.emit('jobs-updated', activeJobs);
    });

    // Крок статусів Складу
    socket.on('update-sklad-status', (jobId) => {
        const job = activeJobs.find(j => j.id === jobId);
        if (job) {
            if (job.skladStatus === 'Заявка') {
                job.skladStatus = 'В роботі';
            } else if (job.skladStatus === 'В роботі') {
                job.skladStatus = 'Завершено';
            }
            io.emit('jobs-updated', activeJobs);
        }
    });

    // Сценарій механіка "Ремонт завершено"
    socket.on('complete-repair', (jobId) => {
        const job = activeJobs.find(j => j.id === jobId);
        if (job) {
            job.workStatus = 'Завершено';
            job.timeLeft = 180; // 3 хвилини (зворотний відлік для видачі авто)

            // Спрацьовує івент на всіх підключених моніторах та екранах приймальників
            io.emit('repair-completed-event', { jobId, job });
            io.emit('jobs-updated', activeJobs);

            // Рівно через 4 хвилини (240 сек) видаляємо авто з табло
            setTimeout(() => {
                activeJobs = activeJobs.filter(j => j.id !== jobId);
                io.emit('jobs-updated', activeJobs);
            }, 240000);
        }
    });
});

// Глобальний серверний таймер для всіх тайлапсів зворотного відліку
setInterval(() => {
    let hasChanged = false;
    activeJobs.forEach(job => {
        if (job.timeLeft > 0) {
            job.timeLeft--;
            hasChanged = true;
        }
    });
    if (hasChanged) {
        io.emit('timer-tick', activeJobs);
    }
}, 1000);

server.listen(PORT, () => {
    console.log(`🚀 Сервер SEAT&CUPRA Центр Київ запущено на http://localhost:${PORT}`);
});