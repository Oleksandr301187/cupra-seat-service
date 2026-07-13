const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

let queue = [];
let permanentMechanics = [
    { lastName: "Гончаренко", firstName: "Олександр" },
    { lastName: "Петренко", firstName: "Дмитро" }
]; 

let repairCodes = [
    { name: "TOZ1", description: "Сервіс" },
    { name: "KUZ1", description: "Кузовний ремонт" },
    { name: "MYI1", description: "Мийка" }
];

let carBrands = ["Cupra & Seat", "Volkswagen", "Audi", "Skoda"];

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

io.on('connection', (socket) => {
    socket.emit('updateQueue', queue);
    socket.emit('updateMechanics', permanentMechanics);
    socket.emit('updateRepairCodes', repairCodes);
    socket.emit('updateCarBrands', carBrands);

    socket.on('registerUser', (data) => {
        if (data.role === 'Admin') {
            if (data.lastName === 'Admin' && data.password === '12345') {
                socket.emit('loginSuccess', { role: 'Admin', lastName: 'Адміністратор', firstName: 'СТО' });
            } else { socket.emit('loginError', 'Невірний логін або пароль!'); }
            return;
        }
        if (data.role === 'Mechanic') {
            const exists = permanentMechanics.some(m => m.lastName.toLowerCase() === data.lastName.toLowerCase() && m.firstName.toLowerCase() === data.firstName.toLowerCase());
            if (!exists) {
                permanentMechanics.push({ lastName: data.lastName, firstName: data.firstName });
                io.emit('updateMechanics', permanentMechanics);
            }
        }
        socket.emit('loginSuccess', { role: data.role, lastName: data.lastName, firstName: data.firstName });
    });

    socket.on('adminAddRepairCode', (data) => {
        const cleanName = data.name.trim().toUpperCase().substring(0, 4);
        const exists = repairCodes.some(c => c.name === cleanName);
        if (!exists && cleanName.length === 4) {
            repairCodes.push({ name: cleanName, description: data.description });
            io.emit('updateRepairCodes', repairCodes);
        }
    });

    socket.on('adminDeleteRepairCode', (index) => {
        if (index >= 0 && index < repairCodes.length) {
            repairCodes.splice(index, 1);
            io.emit('updateRepairCodes', repairCodes);
        }
    });

    socket.on('adminAddBrand', (brandName) => {
        const cleanBrand = brandName.trim();
        if (cleanBrand && !carBrands.includes(cleanBrand)) {
            carBrands.push(cleanBrand);
            io.emit('updateCarBrands', carBrands);
        }
    });

    socket.on('adminDeleteBrand', (index) => {
        if (index >= 0 && index < carBrands.length) {
            carBrands.splice(index, 1);
            io.emit('updateCarBrands', carBrands);
        }
    });

    socket.on('adminAddMechanic', (data) => {
        const exists = permanentMechanics.some(m => m.lastName.toLowerCase() === data.lastName.toLowerCase() && m.firstName.toLowerCase() === data.firstName.toLowerCase());
        if (!exists) {
            permanentMechanics.push({ lastName: data.lastName, firstName: data.firstName });
            io.emit('updateMechanics', permanentMechanics);
        }
    });

    socket.on('adminDeleteMechanic', (index) => {
        if (index >= 0 && index < permanentMechanics.length) {
            permanentMechanics.splice(index, 1);
            io.emit('updateMechanics', permanentMechanics);
        }
    });

    socket.on('adminUpdateVehicleFull', (data) => {
        queue = queue.map(item => {
            if (item.id === data.id) {
                return {
                    ...item,
                    plateNumber: data.plateNumber.toUpperCase(),
                    brand: data.brand,
                    ticketNumber: data.ticketNumber,
                    status: data.status,
                    partsStatus: data.partsStatus,
                    repairType: data.repairType,
                    post: data.post,
                    mechanicName: data.mechanicName
                };
            }
            return item;
        });
        sortQueue();
        io.emit('updateQueue', queue);
    });

    socket.on('addVehicle', (data) => {
        let appointmentTime = data.appointmentTime;
        let status = 'in_queue';
        if (data.isUrgent) {
            const now = new Date();
            appointmentTime = now.toLocaleTimeString('uk-UA', { 
        timeZone: 'Europe/Kyiv', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    status = 'called';
        }

        let detectedType = 'Сервіс';
        const ticketPrefix = data.ticketNumber.trim().toUpperCase().substring(0, 4);
        const matchCode = repairCodes.find(c => c.name === ticketPrefix);
        if (matchCode) { detectedType = matchCode.description; }

        const newVehicle = {
            id: Date.now(),
            plateNumber: data.plateNumber.toUpperCase(),
            ticketNumber: data.ticketNumber,
            brand: data.brand,
            status: status, 
            partsStatus: 'waiting_parts',
            repairType: detectedType,       
            post: 'Не призначено',
            mechanicName: 'Не призначено',
            time: appointmentTime
        };
        queue.push(newVehicle);
        sortQueue();
        io.emit('updateQueue', queue);
    });

    socket.on('updateVehicle', (data) => {
        queue = queue.map(item => {
            if (item.id === data.id) {
                let shouldStart = data.repairType === 'Мийка' || data.repairType === 'Кузовний ремонт' || (data.repairType === 'Сервіс' && data.post !== 'Не призначено');
                return { ...item, repairType: data.repairType, post: data.post, mechanicName: data.mechanicName, status: shouldStart ? 'called' : item.status };
            }
            return item;
        });
        sortQueue();
        io.emit('updateQueue', queue);
    });

    socket.on('startAssembling', (id) => {
        queue = queue.map(item => item.id === id ? { ...item, partsStatus: 'assembling' } : item);
        io.emit('updateQueue', queue);
    });

    socket.on('completeAssembling', (id) => {
        queue = queue.map(item => item.id === id ? { ...item, partsStatus: 'assembled', status: 'completed' } : item);
        io.emit('updateQueue', queue);
        setTimeout(() => {
            queue = queue.filter(item => item.id !== id);
            io.emit('updateQueue', queue);
        }, 10 * 60 * 1000); 
    });

    socket.on('logoutUser', () => {
        socket.emit('logoutSuccess');
    });
});

function sortQueue() {
    queue.sort((a, b) => {
        if (a.status === 'called' && b.status !== 'called') return -1;
        if (a.status !== 'called' && b.status === 'called') return 1;
        return a.time.localeCompare(b.time);
    });
}

server.listen(PORT, () => console.log(`Сервер працює на порту ${PORT}`));
