const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'bills.db');
const db = new Database(dbPath);

// Initialize Tables
db.exec(`
    CREATE TABLE IF NOT EXISTS distributors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        credit_days INTEGER DEFAULT 5,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        distributor_id INTEGER,
        bill_number TEXT NOT NULL,
        bill_date DATE NOT NULL,
        due_date DATE NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'Unpaid',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (distributor_id) REFERENCES distributors(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER,
        payment_date DATE NOT NULL,
        amount REAL NOT NULL,
        mode TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bill_id) REFERENCES bills(id)
    );
`);

module.exports = {
    getDatabasePath: () => dbPath,

    // Distributor CRUD
    addDistributor: (data) => {
        const stmt = db.prepare('INSERT INTO distributors (name, phone, credit_days, notes) VALUES (?, ?, ?, ?)');
        return stmt.run(data.name, data.phone, data.credit_days, data.notes);
    },
    getDistributors: () => {
        return db.prepare('SELECT * FROM distributors ORDER BY name ASC').all();
    },
    updateDistributor: (id, data) => {
        const stmt = db.prepare('UPDATE distributors SET name = ?, phone = ?, credit_days = ?, notes = ? WHERE id = ?');
        return stmt.run(data.name, data.phone, data.credit_days, data.notes, id);
    },

    // Bill CRUD
    addBill: (data) => {
        const stmt = db.prepare(`
            INSERT INTO bills (distributor_id, bill_number, bill_date, due_date, total_amount)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(data.distributor_id, data.bill_number, data.bill_date, data.due_date, data.total_amount);
    },
    getBills: (filters = {}) => {
        let query = `
            SELECT b.*, d.name as distributor_name,
            (SELECT IFNULL(SUM(amount), 0) FROM payments WHERE bill_id = b.id) as total_paid,
            (b.total_amount - (SELECT IFNULL(SUM(amount), 0) FROM payments WHERE bill_id = b.id)) as remaining_balance
            FROM bills b 
            JOIN distributors d ON b.distributor_id = d.id
        `;
        const params = [];
        const where = [];

        if (filters.status) {
            where.push('b.status = ?');
            params.push(filters.status);
        }
        if (filters.distributor_id) {
            where.push('b.distributor_id = ?');
            params.push(filters.distributor_id);
        }
        if (filters.startDate && filters.endDate) {
            where.push('b.bill_date BETWEEN ? AND ?');
            params.push(filters.startDate, filters.endDate);
        }

        if (where.length > 0) {
            query += ' WHERE ' + where.join(' AND ');
        }
        query += ' ORDER BY b.bill_date DESC';

        return db.prepare(query).all(...params);
    },
    updateBillStatus: (id) => {
        const bill = db.prepare('SELECT total_amount FROM bills WHERE id = ?').get(id);
        const payments = db.prepare('SELECT SUM(amount) as total_paid FROM payments WHERE bill_id = ?').get(id);
        const totalPaid = payments.total_paid || 0;

        let status = 'Unpaid';
        if (totalPaid >= bill.total_amount) {
            status = 'Paid';
        } else if (totalPaid > 0) {
            status = 'Partially Paid';
        }

        db.prepare('UPDATE bills SET status = ? WHERE id = ?').run(status, id);
    },

    // Payment CRUD
    addPayment: (data) => {
        const stmt = db.prepare('INSERT INTO payments (bill_id, payment_date, amount, mode, notes) VALUES (?, ?, ?, ?, ?)');
        const result = stmt.run(data.bill_id, data.payment_date, data.amount, data.mode, data.notes);
        module.exports.updateBillStatus(data.bill_id);
        return result;
    },
    getPaymentsForBill: (billId) => {
        return db.prepare('SELECT * FROM payments WHERE bill_id = ? ORDER BY payment_date DESC').all(billId);
    },

    // Dashboard Stats
    getDashboardStats: () => {
        const today = new Date().toISOString().split('T')[0];
        const next2Days = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        return {
            totalOutstanding: db.prepare("SELECT SUM(total_amount - (SELECT IFNULL(SUM(amount), 0) FROM payments WHERE bill_id = bills.id)) as balance FROM bills WHERE status != 'Paid'").get().balance || 0,
            totalOverdue: db.prepare("SELECT SUM(total_amount - (SELECT IFNULL(SUM(amount), 0) FROM payments WHERE bill_id = bills.id)) as balance FROM bills WHERE status != 'Paid' AND due_date < ?").get(today).balance || 0,
            dueToday: db.prepare("SELECT COUNT(*) as count FROM bills WHERE status != 'Paid' AND due_date = ?").get(today).count,
            dueSoon: db.prepare("SELECT COUNT(*) as count FROM bills WHERE status != 'Paid' AND due_date > ? AND due_date <= ?").get(today, next2Days).count
        };
    },

    getUpcomingBills: (limit = 10) => {
        return db.prepare(`
            SELECT b.*, d.name as distributor_name,
            (SELECT IFNULL(SUM(amount), 0) FROM payments WHERE bill_id = b.id) as total_paid,
            (b.total_amount - (SELECT IFNULL(SUM(amount), 0) FROM payments WHERE bill_id = b.id)) as remaining_balance
            FROM bills b 
            JOIN distributors d ON b.distributor_id = d.id
            WHERE b.status != 'Paid'
            ORDER BY b.due_date ASC
            LIMIT ?
        `).all(limit);
    }
};
