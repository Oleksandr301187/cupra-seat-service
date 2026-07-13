const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const DB_FILE = path.join(__dirname, 'database.json');

// Дефолтна база даних
let db = {
  queue: [],
  settings: {
    posts: [
      { id: 1, name: "Пост 1", mechanic: "Гончаренко Олександр", zone: "service", active: true },
      { id: 2, name: "Пост 2", mechanic: "Кулик Олександр", zone: "service", active: true },
      { id: 3, name: "Кузовний пост 1", mechanic: "Петренко Дмитро", zone: "body", active: true },
      { id: 4, name: "Пост Гарантії 1", mechanic: "Іваненко Іван", zone: "warranty", active: true }
    ],
    repairTypes: [
      { code: "TOZ0", name: "Технічне обслуговування", duration: 30 },
      { code: "DIAG", name: "Комп'ютерна діагностика", duration: 15 },
      { code: "BODY", name: "Кузовні роботи", duration: 120 }
    ]
  }
};

// Завантаження бази
if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error("Помилка зчитування бази даних, створено нову:", e);
  }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

app.use(express.static(path.join(__dirname, 'public')));

// Ендпоінт для отримання URL сервера (для генерації QR клієнта)
app.get('/api/server-url', (req, res) => {
  const host = req.headers.host;
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  res.json({ url: `${protocol}://${host}` });
});

io.on('connection', (socket) => {
  console.log(`Клієнт підключився: ${socket.id}`);

  // Відправляємо початкові дані
  socket.emit('updateQueue', db.queue);
  socket.emit('updateSettings', db.settings);

  // Створення нового авто/заявки
  socket.on('createVehicle', (data) => {
    // Автовизначення типу ремонту за першими літерами номера заявки (наприклад, TOZ0)
    let detectedType = "Сервіс";
    let detectedDuration = 30;
    const prefix = data.ticketNumber ? data.ticketNumber.substring(0, 4).toUpperCase() : "";
    const matchedType = db.settings.repairTypes.find(t => t.code.toUpperCase() === prefix);
    
    if (matchedType) {
      detectedType = matchedType.name;
      detectedDuration = matchedType.duration;
    }

    const newVehicle = {
      id: Date.now().toString(),
      time: data.time || "12:00",
      plateNumber: data.plateNumber.toUpperCase(),
      brand: data.brand || "CUPRA",
      ticketNumber: data.ticketNumber ? data.ticketNumber.toUpperCase() : "",
      repairType: detectedType,
      duration: detectedDuration,
      status: 'in_queue', // in_queue, called, completed, declined
      partsStatus: 'pending', // pending, gathering, ready, completed
      post: 'Не призначено',
      mechanicName: 'Не призначено',
      createdAt: Date.now(),
      arrivedAt: null,
      completedAt: null,
      declinedAt: null,
      partsGatheredAt: null,
      isNew: true
    };

    db.queue.push(newVehicle);
    saveDB();
    io.emit('updateQueue', db.queue);
    io.emit('notifyNewVehicle', newVehicle);
  });

  // Зміна статусу авто (В роботу, Відмова тощо)
  socket.on('updateVehicleStatus', ({ id, status, postName, mechanicName }) => {
    const vehicle = db.queue.find(v => v.id === id);
    if (vehicle) {
      vehicle.status = status;
      if (status === 'called') {
        vehicle.arrivedAt = Date.now();
        if (postName) vehicle.post = postName;
        if (mechanicName) vehicle.mechanicName = mechanicName;
      } else if (status === 'completed') {
        vehicle.completedAt = Date.now();
      } else if (status === 'declined') {
        vehicle.declinedAt = Date.now();
      }
      saveDB();
      io.emit('updateQueue', db.queue);
    }
  });

  // Зміна статусу деталей на складі (pending -> gathering -> ready)
  socket.on('updatePartsStatus', ({ id, status }) => {
    const vehicle = db.queue.find(v => v.id === id);
    if (vehicle) {
      vehicle.partsStatus = status;
      if (status === 'ready') {
        vehicle.partsGatheredAt = Date.now();
      }
      saveDB();
      io.emit('updateQueue', db.queue);
      io.emit('notifyPartsStatus', { id, status, plateNumber: vehicle.plateNumber });
    }
  });

  // Надсилання повідомлень по відділах (чати)
  socket.on('sendMessage', (messageData) => {
    // messageData: { sender: 'service', targets: ['warehouse', 'mechanic'], text: 'Запчастини на пост 1!' }
    io.emit('receiveMessage', {
      id: Date.now().toString(),
      ...messageData,
      timestamp: Date.now()
    });
  });

  // Адмін-налаштування
  socket.on('saveAdminSettings', (newSettings) => {
    db.settings = newSettings;
    saveDB();
    io.emit('updateSettings', db.settings);
  });

  socket.on('disconnect', () => {
    console.log(`Клієнт відключився: ${socket.id}`);
  });
});

// Автоматичне видалення авто зі статусом "declined" через 2 хвилини
// та видалення зі складу зі статусом "completed" через 5 хвилин
setInterval(() => {
  let changed = false;
  const now = Date.now();

  db.queue = db.queue.filter(vehicle => {
    if (vehicle.status === 'declined' && vehicle.declinedAt && (now - vehicle.declinedAt >= 120000)) {
      changed = true;
      return false;
    }
    if (vehicle.partsStatus === 'ready' && vehicle.partsGatheredAt && (now - vehicle.partsGatheredAt >= 300000)) {
      vehicle.partsStatus = 'completed'; // Переводимо в архів на складі
      changed = true;
    }
    // Автовидалення з інфо-монітора завершених авто через 5 хвилин
    if (vehicle.status === 'completed' && vehicle.completedAt && (now - vehicle.completedAt >= 300000)) {
      changed = true;
      return false;
    }
    return true;
  });

  if (changed) {
    saveDB();
    io.emit('updateQueue', db.queue);
  }
}, 5000);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});