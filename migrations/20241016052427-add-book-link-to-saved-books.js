'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('saved_books', 'bookLink', {
      type: Sequelize.STRING,
      allowNull: true, // Optional: Adjust as needed
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('saved_books', 'bookLink');
  }
};
