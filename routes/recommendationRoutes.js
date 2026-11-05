const createRouter = require("./recommendationRouter");
module.exports = createRouter({
  SavedBook: require("../models/savedBook"),
  Preference: require("../models/recommendationPreference"),
  Feedback: require("../models/recommendationFeedback"),
  resolveSeed: require("../services/recommendationSeeds"),
  transaction: (work) => require("../config/database").transaction(work),
});
