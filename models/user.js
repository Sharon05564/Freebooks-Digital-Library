const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database.js'); // Adjust this path as necessary

class User extends Model {}

User.init({
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true, // Ensure username is not empty
        },
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true, // Validate email format
        },
    },
    password: {
        type: DataTypes.STRING,
        allowNull: true, // Allow null for users who sign up via Google
        validate: {
            len: [6, 100], // Password length between 6 and 100
        },
    },
    googleId: { // Add this field to store Google ID
        type: DataTypes.STRING,
        allowNull: true,
        unique: true // Optional, ensures no duplicate Google IDs
    },
    profilePicture: {
        type: DataTypes.STRING,
        allowNull: true, // Optional field
    },
}, {
    sequelize,
    modelName: 'User',
    timestamps: true, // Automatically add createdAt and updatedAt
});

module.exports = User;
