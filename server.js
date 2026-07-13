const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

// Початковий стан постів та конфігурації механіків
let systemState = {
    posts: {
        "Пост 1": { id: 1, type: "сервіс", active: true, mechanic: "Іван Сердюк", currentCar: null, nextCar: null },
        "Пост 2": { id: 2, type: "сервіс", active: true, mechanic: "Олег Петроченко", currentCar: null, nextCar: null },
        "Малярка 1": { id: 3, type: "кузовний", active: true, mechanic: "Андрій Коваль", currentCar: null, nextCar: null },
        "Шиномонтаж": { id: 4, type: "шиномонтаж", active: true, mechanic: "Дмитро Гриць", currentCar: null, nextCar: null }
    },
    storageQueue: [],
    notifications: []
};

io.on('connection', (socket) => {
    console.log('Клієнт підключився:', socket.id);
    socket.emit('init_state', systemState);

    // Створення запису (Автоматичне визначення типу ремонту за першими 4 символами заявки)
    socket.on('create_order', (data) => {
        let orderId = data.orderId ? data.orderId.trim() : "";
        if (!orderId) return;

        let carNumber = data.carNumber ? data.carNumber.toUpperCase().trim() : "N/O";
        let repairType = "сервіс";

        if (orderId.startsWith("SRV-")) repairType = "сервіс";
        else if (orderId.startsWith("KUZ-")) repairType = "кузовний";
        else if (orderId.startsWith("TIRE")) repairType = "шиномонтаж";

        const newCar = {
            orderId,
            carNumber,
            repairType,
            masterName: data.masterName || "Черговий Майстер",
            startTime: Date.now(),
            estimatedTime: data.estimatedTime || 120, // у хвилинах
            status: "очікує"
        };

        // Логіка призначення на пост
        if (systemState.posts[data.postName]) {
            const post = systemState.posts[data.postName];
            if (!post.currentCar) {
                post.currentCar = newCar;
            } else {
                post.nextCar = newCar;
            }
            io.emit('car_added_alert', { postName: data.postName, car: newCar });
        }
        io.emit('state_updated', systemState);
    });

    // Запит на склад (Запуск звукового сповіщення)
    socket.on('storage_request', (data) => {
        const request = {
            id: Date.now(),
            orderId: data.orderId,
            description: data.description,
            status: "нове",
            timestamp: Date.now()
        };
        systemState.storageQueue.push(request);
        io.emit('storage_alert', request);
        io.emit('state_updated', systemState);
    });

    // Надсилання сповіщення на Інфо-монітор
    socket.on('send_notification', (data) => {
        const notification = {
            id: Date.now(),
            message: data.message, // Наприклад: "Власник авто підійдіть на сервіс..."
            duration: data.type === 'docs' ? 180000 : 300000, // 3 хв або 5 хв
            createdAt: Date.now()
        };
        systemState.notifications.push(notification);
        io.emit('new_notification_alert', notification);
        io.emit('state_updated', systemState);

        // Таймер автовидалення сповіщення
        setTimeout(() => {
            systemState.notifications = systemState.notifications.filter(n => n.id !== notification.id);
            io.emit('state_updated', systemState);
        }, notification.duration);
    });

    socket.on('disconnect', () => {
        console.log('Клієнт відключився');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер працює на порту ${PORT}`);
});