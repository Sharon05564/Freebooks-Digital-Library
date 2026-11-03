const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const baseOptions = { dialect: 'postgres', logging: false };

// Hosted Postgres (Neon, Render) provides one DATABASE_URL and requires TLS.
// Local development falls back to the individual POSTGRES_* variables.
const sequelize = process.env.DATABASE_URL
    ? new Sequelize(process.env.DATABASE_URL, {
        ...baseOptions,
        dialectOptions: isProduction ? { ssl: { require: true, rejectUnauthorized: true } } : {},
    })
    : new Sequelize(process.env.POSTGRES_DB, process.env.POSTGRES_USER, process.env.POSTGRES_PASSWORD, {
        ...baseOptions,
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
    });

module.exports = sequelize;
