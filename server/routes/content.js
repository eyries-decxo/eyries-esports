const express = require("express");
const Content = require("../models/Content");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

/*
  GET /api/content
  -----------------
  Returns the full site content (hero text, founder, co-founders, team,
  achievements, squads, contact info). PUBLIC — no login required, so any
  visitor can view the site immediately when they open the link.
*/
router.get("/", async (req, res) => {
  try {
    let content = await Content.findById("site-content");
    if (!content) {
      // First run: create an empty content document with placeholder text.
      content = await Content.create({ _id: "site-content" });
    }

    // Safe backfill: older documents created before the "squads" feature
    // existed won't have that field. Add empty defaults for any missing
    // game so the frontend never crashes on undefined — this does NOT
    // touch or overwrite any existing real content, only fills gaps.
    const emptySquad = () => ({ players: [], announcements: [] });
    const games = ["BGMI", "VALORANT", "PES", "FREE FIRE"];
    let needsSave = false;

    if (!content.squads) {
      content.squads = {};
      needsSave = true;
    }
    for (const game of games) {
      if (!content.squads[game]) {
        content.squads[game] = emptySquad();
        needsSave = true;
      } else {
        if (!Array.isArray(content.squads[game].players)) {
          content.squads[game].players = [];
          needsSave = true;
        }
        if (!Array.isArray(content.squads[game].announcements)) {
          content.squads[game].announcements = [];
          needsSave = true;
        }
      }
    }

    // Same safe backfill for the hero.jerseyPhotoUrl field — older
    // documents won't have this yet.
    if (content.hero && content.hero.jerseyPhotoUrl === undefined) {
      content.hero.jerseyPhotoUrl = "";
      needsSave = true;
    }

    // Same safe backfill for the 3 stacked hero.photos — older documents
    // won't have this yet.
    if (!content.hero || !Array.isArray(content.hero.photos)) {
      content.hero.photos = ["", "", ""];
      needsSave = true;
    } else if (content.hero.photos.length < 3) {
      while (content.hero.photos.length < 3) {
        content.hero.photos.push("");
      }
      needsSave = true;
    }

    // Same safe backfill for highlights — older documents won't have this.
    if (!Array.isArray(content.highlights)) {
      content.highlights = [];
      needsSave = true;
    }

    // Same safe backfill for tournaments — older documents won't have this.
    if (!content.tournaments) {
      content.tournaments = { gameLogos: { BGMI: "", EFOOTBALL: "", VALORANT: "" }, registrationLink: "", list: [] };
      needsSave = true;
    } else {
      if (!content.tournaments.gameLogos) {
        content.tournaments.gameLogos = { BGMI: "", EFOOTBALL: "", VALORANT: "" };
        needsSave = true;
      }
      if (content.tournaments.registrationLink === undefined) {
        content.tournaments.registrationLink = "";
        needsSave = true;
      }
      if (!Array.isArray(content.tournaments.list)) {
        content.tournaments.list = [];
        needsSave = true;
      }
    }

    if (needsSave) {
      content.markModified("squads");
      content.markModified("hero");
      content.markModified("tournaments");
      content.markModified("highlights");
      await content.save();
    }

    res.json(content);
  } catch (err) {
    console.error("Fetch content error:", err);
    res.status(500).json({ error: "Could not load site content." });
  }
});

/*
  PUT /api/content
  -----------------
  Replaces the editable fields of the content document.
  Admin-only — requireAdmin runs after requireAuth, so a regular user
  token is rejected with 403 even if they call this endpoint directly.
  Body shape matches the Content model (hero, founder, coFounders, team,
  achievements, contact) — partial updates are merged in.
*/
router.put("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const allowedFields = ["hero", "founder", "coFounders", "team", "achievements", "highlights", "squads", "tournaments", "contact"];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const content = await Content.findByIdAndUpdate(
      "site-content",
      { $set: updates },
      { new: true, upsert: true }
    );

    res.json(content);
  } catch (err) {
    console.error("Update content error:", err);
    res.status(500).json({ error: "Could not save changes. Try again." });
  }
});

module.exports = router;