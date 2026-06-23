require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Content = require("./models/Content");

/*
  SEED SCRIPT
  -----------
  Run once with: npm run seed

  Creates:
  1. The first admin account, using SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD
     from your .env file. If that admin already exists, it's skipped
     (safe to run more than once).
  2. A starter content document with clearly-labeled placeholder text,
     so the site has something to display before you edit it in the
     admin panel.
*/

const placeholderContent = {
  _id: "site-content",
  hero: {
    tagline: "Multi-front roster // 4 active squads",
    headline: "Fly the Eyries colors",
    subtext: "Live scores, squads, and gear across BGMI, Valorant, PES & Free Fire."
  },
  founder: {
    name: "[Founder name — edit in admin panel]",
    title: "Founder & CEO",
    bio: "[Add the founder's bio here. A few sentences about their background, vision for Eyries Esports, and what led them to start the team.]",
    photoUrl: ""
  },
  coFounders: [
    {
      name: "[Co-founder name]",
      title: "Co-Founder & COO",
      bio: "[Add this co-founder's bio here.]",
      photoUrl: ""
    },
    {
      name: "[Co-founder name]",
      title: "Co-Founder & Head of Operations",
      bio: "[Add this co-founder's bio here.]",
      photoUrl: ""
    }
  ],
  team: [
    { name: "[Team member name]", title: "Team Manager", bio: "[Short bio.]", photoUrl: "" },
    { name: "[Team member name]", title: "Content Lead", bio: "[Short bio.]", photoUrl: "" },
    { name: "[Team member name]", title: "Community Manager", bio: "[Short bio.]", photoUrl: "" }
  ],
  achievements: [
    {
      title: "[Tournament name — e.g. Regional Champions]",
      event: "[Event/league name]",
      year: "2025",
      description: "[A line or two about this achievement.]",
      photoUrl: ""
    },
    {
      title: "[Another achievement]",
      event: "[Event/league name]",
      year: "2024",
      description: "[A line or two about this achievement.]",
      photoUrl: ""
    }
  ],
  squads: {
    BGMI: {
      players: [
        { name: "[Player name]", gamingId: "[In-game ID]", role: "IGL", photoUrl: "" }
      ],
      announcements: [
        { title: "[Announcement title]", body: "[Details here.]", date: "2026" }
      ]
    },
    VALORANT: {
      players: [
        { name: "[Player name]", gamingId: "[In-game ID]", role: "Duelist", photoUrl: "" }
      ],
      announcements: []
    },
    PES: {
      players: [
        { name: "[Player name]", gamingId: "[In-game ID]", role: "Forward", photoUrl: "" }
      ],
      announcements: []
    },
    "FREE FIRE": {
      players: [
        { name: "[Player name]", gamingId: "[In-game ID]", role: "Rusher", photoUrl: "" }
      ],
      announcements: []
    }
  },
  contact: {
    email: "contact@eyriesesports.example",
    phone: "+91 00000 00000",
    address: "[City, State, Country]",
    instagram: "https://instagram.com/eyriesesports",
    twitter: "https://twitter.com/eyriesesports",
    youtube: "https://youtube.com/@eyriesesports",
    discord: "https://discord.gg/eyriesesports"
  }
};

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI not set. Fill in your .env file first.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  // --- Admin user ---
  const adminUsername = (process.env.SEED_ADMIN_USERNAME || "user_admin").trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "your_admin_Password123";

  const existingAdmin = await User.findOne({ username: adminUsername });
  if (existingAdmin) {
    console.log(`ℹ️  Admin "${adminUsername}" already exists — skipping creation.`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await User.create({ username: adminUsername, passwordHash, role: "admin" });
    console.log(`✅ Created admin account: "${adminUsername}" (password as set in .env)`);
  }

  // --- Starter content ---
  const existingContent = await Content.findById("site-content");
  if (existingContent) {
    console.log("ℹ️  Site content already exists — skipping placeholder creation.");
  } else {
    await Content.create(placeholderContent);
    console.log("✅ Created placeholder site content. Edit it via the admin panel.");
  }

  console.log("\nDone. You can now log in with the admin account above.\n");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
