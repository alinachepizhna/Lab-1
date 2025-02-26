const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const port = 3000;

// Налаштування для збереження файлів
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Вкажіть директорію для збереження файлів
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Генерація унікального імені файлу
    }
});
const upload = multer({ storage: storage });

// Підключення статичних файлів (для доступу до фото)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const clientsFile = path.join(__dirname, 'clients.json');

// Функція для зчитування даних клієнтів з файлу
function getClients() {
    try {
        const data = fs.readFileSync(clientsFile, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return []; // Повертаємо порожній масив, якщо файл не знайдений або порожній
    }
}

// Функція для запису даних клієнтів у файл
function saveClients(clients) {
    fs.writeFileSync(clientsFile, JSON.stringify(clients, null, 2), 'utf-8');
}

// Обробка GET-запиту для головної сторінки
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Обробка POST-запиту для реєстрації клієнта
app.post('/register', upload.single('photo'), (req, res) => {
    const clientData = req.body;
    const photo = req.file ? req.file.filename : null; // Отримуємо ім'я файлу фото

    if (!clientData) {
        return res.status(400).send('Invalid client data');
    }

    const clients = getClients();
    clientData.id = clients.length + 1;
    clientData.photo = photo;

    clients.push(clientData);
    saveClients(clients);

    res.status(200).send('Client registered successfully');
});

// Обробка GET-запиту для панелі адміністратора
app.get('/admin', (req, res) => {
    const clients = getClients();
    res.send(`
        <h2>Панель адміністратора</h2>
        <div id="clients-list" style="display: flex; flex-direction: column;">
            ${clients.map(client => `
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p><strong>${client.fullname}</strong></p>
                        <button onclick="deleteClient(${client.id})">Видалити</button>
                    </div>
                    <div>
                        <p>Email: ${client.email}</p>
                        <p>Номер телефону: ${client.phone}</p>
                        <p>Дата народження: ${client.dob}</p>
                        <p>Стать: ${client.gender}</p>
                        <p>Країна: ${client.country}</p>
                        ${client.photo ? `<img src="/uploads/${client.photo}" alt="Фото профілю" width="100" height="100" />` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        <script>
            function deleteClient(id) {
                if (!confirm('Ви дійсно хочете видалити цього клієнта?')) {
                    return;
                }
                fetch('/delete/' + id, {
                    method: 'DELETE',
                }).then(response => {
                    if (response.ok) {
                        alert('Клієнта видалено');
                        location.reload(); // Перезавантажує сторінку для оновлення списку
                    } else {
                        response.text().then(text => {
                            alert('Не вдалося видалити клієнта: ' + text); // Виводимо помилку
                        });
                    }
                }).catch(error => {
                    console.error('Error deleting client:', error);
                    alert('Сталася помилка при видаленні клієнта');
                });
            }
        </script>
    `);
});

// Обробка DELETE-запиту для видалення клієнта
app.delete('/delete/:id', (req, res) => {
    const clientId = parseInt(req.params.id);
    const clients = getClients();

    const clientIndex = clients.findIndex(client => client.id === clientId);
    if (clientIndex === -1) {
        return res.status(404).send('Client not found');
    }

    const clientToDelete = clients[clientIndex];

    // Видаляємо файл фото, якщо він існує
    if (clientToDelete.photo) {
        const photoPath = path.join(__dirname, 'uploads', clientToDelete.photo);

        // Перевірка на існування файлу перед видаленням
        fs.access(photoPath, fs.constants.F_OK, (err) => {
            if (err) {
                console.error('File does not exist:', photoPath);
                return res.status(404).send('Photo not found');
            }

            // Видалення файлу
            fs.unlink(photoPath, (err) => {
                if (err) {
                    console.error('Error deleting photo:', err);
                    return res.status(500).send('Error deleting photo');
                }
                console.log('Photo deleted successfully');
            });
        });
    }

    const updatedClients = clients.filter(client => client.id !== clientId);
    saveClients(updatedClients);

    res.status(200).send('Client deleted successfully');
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
