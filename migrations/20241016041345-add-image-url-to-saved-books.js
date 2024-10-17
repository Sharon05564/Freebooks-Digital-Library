'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add the `imageUrl` column to the `saved_books` table
    await queryInterface.addColumn('saved_books', 'imageUrl', {
      type: Sequelize.STRING,
      allowNull: true, // Allow it to be nullable, in case some books don't have an image URL
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the `imageUrl` column from the `saved_books` table if the migration is rolled back
    await queryInterface.removeColumn('saved_books', 'imageUrl');
  }
};
