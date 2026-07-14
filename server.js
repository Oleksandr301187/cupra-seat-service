const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const kyivTime = new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" });
console.log(`[Kyiv Time]: ${kyivTime}`);

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

let state = {
  orders: [],
  settings: {
    naryads: [
      { code: 'TOZ0', desc: 'Технічне обслуговування', time: '30' },
      { code: 'KUZ0', desc: 'Кузовний ремонт', time: '1:30' },
      { code: 'SHIN', desc: 'Шиномонтаж', time: '45' },
      { code: 'DET0', desc: 'Детейлінг', time: '2:00' },
      { code: 'WASH', desc: 'Мийка Premium', time: '40' },
      { code: 'PAIN', desc: 'Малярні роботи', time: '3:00' },
      { code: 'DIAG', desc: 'Компʼютерна діагностика', time: '20' },
      { code: 'ENG0', desc: 'Ремонт двигуна', time: '4:00' },
      { code: 'BRAK', desc: 'Обслуговування гальм', time: '50' },
      { code: 'SUSP', desc: 'Ремонт підвіски', time: '1:10' }
    ],
    posts: [
      { id: 1, name: 'Пост 1', active: true, mechanic: 'Іванов Олександр' },
      { id: 2, name: 'Пост 2', active: true, mechanic: 'Петренко Дмитро' },
      { id: 3, name: 'Пост 3', active: true, mechanic: 'Ковальчук Сергій' },
      { id: 4, name: 'Пост 4', active: false, mechanic: '' },
      { id: 5, name: 'Шиномонтажний', active: true, mechanic: '' },
      { id: 6, name: 'Кузовний цех', active: true, mechanic: '' },
      { id: 7, name: 'Мийка/Детейлінг', active: true, mechanic: '' }
    ]
  }
};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.emit('initialState', state);

  socket.on('updateOrders', (orders) => {
    state.orders = orders;
    io.emit('ordersUpdated', state.orders);
  });

  socket.on('updateSettings', (settings) => {
    state.settings = settings;
    io.emit('settingsUpdated', state.settings);
  });

  socket.on('sendMessage', (payload) => {
    io.emit('messageReceived', payload);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Cupra Service Server running on http://localhost:${PORT}`);
});