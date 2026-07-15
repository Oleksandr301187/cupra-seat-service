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
      { code: 'BSZ0', desc: 'Кузовний ремонт', time: '9:00' },
      { code: 'SHIN', desc: 'Шиномонтаж', time: '45' },
      { code: 'DA00', desc: 'Встановлення додаткового обладнання', time: '1:30' },
      { code: 'SW00', desc: 'Мийка Premium', time: '40' },
      { code: 'WCZ0', desc: 'Гарантійний ремонт', time: '2:00' },
      { code: 'PD00', desc: 'Предпродажна підготовка', time: '20' },
      { code: 'DOZ0', desc: 'Встановлення додат.облад. СТО, time: '1:10' },
      { code: 'RF00', desc: 'Ремонт авто співробітника' , time: '50' },
      { code: 'RZOO', desc: 'Поточний ремонт', time: '1:00' }
    ],
    posts: [
      { id: 1, name: 'Пост 1', active: true, mechanic: 'Коротунов Олександр' },
      { id: 2, name: 'Пост 2', active: true, mechanic: 'Хрунов Денис' },
      { id: 3, name: 'Детейлінг', active: true, mechanic: 'Гук Максим' },
      { id: 4, name: 'Пост 4', active: true, mechanic: 'Тарасенко Андрій' },
      { id: 5, name: 'Малярний цех', active: true, mechanic: '' },
      { id: 6, name: 'Кузовний цех', active: true, mechanic: 'Кирилюк Сергій' },
      { id: 7, name: 'Мийка', active: true, mechanic: 'Юшко Віталій' }
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
