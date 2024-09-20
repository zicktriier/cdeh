const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const YooKassa = require('yookassa');  // Добавляем импорт ЮKassa

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Настройка API ЮKassa
const yookassa = new YooKassa({
    shopId: 'ВАШ_SHOP_ID', // Замените на ваш shopId
    secretKey: 'ВАШ_СЕКРЕТНЫЙ_КЛЮЧ' // Замените на ваш секретный ключ
});

// Подключение к базе данных
const db = new sqlite3.Database('./db/products.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err.message);
    } else {
        console.log('Подключение к базе данных SQLite успешно');
    }
});

// Маршрут главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Маршрут каталога товаров
app.get('/catalog', (req, res) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Ошибка сервера');
        } else {
            res.render('catalog.ejs', { products: rows });
        }
    });
});

// Маршрут товара по ID
app.get('/product/:id', (req, res) => {
    const productId = req.params.id;
    db.get('SELECT * FROM products WHERE id = ?', [productId], (err, row) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Ошибка сервера');
        } else {
            res.render('product.ejs', { product: row });
        }
    });
});

// Обработка платежей через ЮKassa (вставляем сюда)
app.post('/pay', async (req, res) => {
    const { productId } = req.body;

    // Получение товара из базы данных
    db.get('SELECT * FROM products WHERE id = ?', [productId], async (err, product) => {
        if (err || !product) {
            return res.status(500).send('Ошибка при получении товара');
        }

        try {
            // Создание платежа через ЮKassa API
            const payment = await yookassa.createPayment({
                amount: {
                    value: product.price.replace(' руб.', ''), // Убираем "руб." из цены
                    currency: 'RUB'
                },
                payment_method_data: {
                    type: 'bank_card'
                },
                confirmation: {
                    type: 'redirect',
                    return_url: `http://localhost:${PORT}/success`
                },
                description: `Покупка товара: ${product.name}`
            });

            // Перенаправление на страницу оплаты
            res.redirect(payment.confirmation.confirmation_url);
        } catch (error) {
            console.error('Ошибка при создании платежа:', error);
            res.status(500).send('Ошибка при создании платежа');
        }
    });
});

// Страница успешной оплаты
app.get('/success', (req, res) => {
    res.send('Оплата успешно завершена!');
});

// Админ-панель
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/admin.html'));
});

// Добавление товара в базу данных
app.post('/admin/add', (req, res) => {
    const { name, price, description, image } = req.body;
    db.run('INSERT INTO products (name, price, description, image) VALUES (?, ?, ?, ?)',
        [name, price, description, image], (err) => {
            if (err) {
                console.error(err.message);
                res.status(500).send('Ошибка при добавлении товара');
            } else {
                res.redirect('/admin');
            }
        });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
