const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
module.exports = sequelize.define(
  "RecommendationFeedback",
  {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
    },
    bookId: { type: DataTypes.STRING(100), primaryKey: true, allowNull: false },
    value: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      validate: { isIn: [[-1, 1]] },
    },
  },
  { tableName: "recommendation_feedback", timestamps: true },
);
