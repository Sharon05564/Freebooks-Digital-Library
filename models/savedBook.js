// models/SavedBook.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class SavedBook extends Model {}

SavedBook.init({
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    bookId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    authors: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    imageUrl: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    bookLink: { // Add this to save the link
        type: DataTypes.STRING,
        allowNull: true,
    }
}, {
    sequelize,
    modelName: 'SavedBook',
    tableName: 'saved_books',
    timestamps: true,
});

module.exports = SavedBook;
