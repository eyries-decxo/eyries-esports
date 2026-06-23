const mongoose = require("mongoose");

/*
  CONTENT MODEL
  -------------
  A single document holds all editable site content: founders, co-founders,
  team members, achievements, and contact/social info. Admins edit this
  through the admin panel; the public page reads it read-only.

  We use one fixed document (singleton pattern, _id: "site-content") rather
  than many small documents, since the whole site reads it together on load.
*/

const personSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    title: { type: String, default: "" }, // e.g. "Founder & CEO"
    bio: { type: String, default: "" },
    photoUrl: { type: String, default: "" } // empty = show placeholder silhouette
  },
  { _id: false }
);

const achievementSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },     // e.g. "Regional Valorant Champions"
    event: { type: String, default: "" },     // e.g. "VCT Challengers South Asia"
    year: { type: String, default: "" },
    description: { type: String, default: "" },
    photoUrl: { type: String, default: "" }
  },
  { _id: false }
);

const highlightSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    description: { type: String, default: "" }, // full text; fan view truncates to one line with "Read more"
    photoUrl: { type: String, default: "" }      // admin-pasted URL, displayed at a 1080x1350 (4:5) ratio
  },
  { _id: false }
);

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    gamingId: { type: String, default: "" }, // in-game ID / IGN, distinct from real name
    role: { type: String, default: "" },     // e.g. "IGL", "Sniper", "Support"
    photoUrl: { type: String, default: "" }
  },
  { _id: false }
);

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    date: { type: String, default: "" }
  },
  { _id: false }
);

const squadSchema = new mongoose.Schema(
  {
    players: { type: [playerSchema], default: [] },
    announcements: { type: [announcementSchema], default: [] }
  },
  { _id: false }
);

const tournamentSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    game: { type: String, enum: ["BGMI", "EFOOTBALL", "VALORANT"], default: "BGMI" },
    status: { type: String, enum: ["upcoming", "ongoing", "past"], default: "upcoming" },
    date: { type: String, default: "" },        // free text, e.g. "12 July 2026" or "12-15 July"
    description: { type: String, default: "" },
    result: { type: String, default: "" },       // optional, e.g. "Eyries finished 2nd" — mainly for past events
    photoUrl: { type: String, default: "" },     // event preview image, admin-pasted URL
    registrationLink: { type: String, default: "" } // this event's own Google Form (or any) URL — each tournament has its own, set independently by admin
  },
  { _id: false }
);

const contentSchema = new mongoose.Schema({
  _id: { type: String, default: "site-content" },

  hero: {
    tagline: { type: String, default: "Multi-front roster // 4 active squads" },
    headline: { type: String, default: "Fly the Eyries colors" },
    subtext: { type: String, default: "Live scores, squads, and gear across BGMI, Valorant, PES & Free Fire." },
    jerseyPhotoUrl: { type: String, default: "" }, // showcase image beside the hero text
    photos: { type: [String], default: ["", "", ""] } // 3 stacked photo-only images, below the jersey, above About
  },

  founder: { type: personSchema, default: () => ({}) },
  coFounders: { type: [personSchema], default: [] },
  team: { type: [personSchema], default: [] },
  achievements: { type: [achievementSchema], default: [] },

  /*
    HIGHLIGHTS
    ----------
    Only reachable via the hamburger nav (same pattern as Achievements),
    never part of normal home-page scrolling. Each entry is a large
    1080x1350 (4:5 portrait) photo with a title and description. Fans see
    one line of the description with a "Read more" link that expands it.
  */
  highlights: { type: [highlightSchema], default: [] },

  /*
    SQUADS
    ------
    Keyed by game name. Each game has its own player roster and its own
    announcements feed. Using a plain Mixed-style map (Schema.Types.Mixed)
    keeps this flexible — admin can add players/announcements freely per
    game without needing a fixed count.
  */
  squads: {
    BGMI: { type: squadSchema, default: () => ({}) },
    VALORANT: { type: squadSchema, default: () => ({}) },
    PES: { type: squadSchema, default: () => ({}) },
    "FREE FIRE": { type: squadSchema, default: () => ({}) }
  },

  contact: {
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    instagram: { type: String, default: "" },
    twitter: { type: String, default: "" },
    youtube: { type: String, default: "" },
    discord: { type: String, default: "" }
  },

  /*
    TOURNAMENTS
    -----------
    gameLogos: official game logo image URLs, pasted in by admin (we can't
    generate or supply copyrighted game logos ourselves — same paste-a-link
    pattern used for every other photo on this site).
    list: every tournament entry, each tagged with one game + one status.
  */
  tournaments: {
    gameLogos: {
      BGMI: { type: String, default: "https://img.sanishtech.com/u/3a5663f71064c78daf121427debcba8c.jpg" },
      EFOOTBALL: { type: String, default: "https://img.sanishtech.com/u/b1f6e81455cae4813574a8bf583d8779.jpg" },
      VALORANT: { type: String, default: "https://img.sanishtech.com/u/a3013629ee618bd7db00f8dff82d288d.jpg" }
    },
    registrationLink: { type: String, default: "" }, // single Google Form (or any) URL, applies to every tournament's Register button
    list: { type: [tournamentSchema], default: [] }
  }
});

module.exports = mongoose.model("Content", contentSchema);