const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
module.exports = sequelize.define(
  "RecommendationPreference",
  {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onDelete: "CASCADE",
    },
    genres: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  },
  { tableName: "recommendation_preferences", timestamps: true },
);
