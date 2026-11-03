const User = require("../models/user");

// Google IDs are the account identifier. An email match alone must never
// silently attach a Google identity to an existing password account.
async function resolveGoogleAccount(profile, mode) {
  const email = profile.emails?.find((item) => item.verified === true)?.value;
  if (!profile.id || !email) return { error: "unverified_email" };

  const existing = await User.findOne({ where: { googleId: profile.id } });
  if (existing) return { user: existing };

  const emailOwner = await User.findOne({
    where: { email: email.toLowerCase() },
  });
  if (emailOwner) return { error: "email_exists" };
  if (mode !== "signup") return { error: "account_missing" };

  try {
    const [user] = await User.findOrCreate({
      where: { googleId: profile.id },
      defaults: {
        username:
          (profile.displayName || email.split("@")[0]).trim().slice(0, 50) ||
          "Reader",
        email: email.toLowerCase(),
        password: null,
        profilePicture: profile.photos?.[0]?.value || null,
      },
    });
    return { user };
  } catch (error) {
    // A second callback may create the same account while this one is
    // waiting. Reuse that identity, but never reuse an email-only match.
    if (error.name !== "SequelizeUniqueConstraintError") throw error;
    const user = await User.findOne({ where: { googleId: profile.id } });
    return user ? { user } : { error: "email_exists" };
  }
}

module.exports = resolveGoogleAccount;
