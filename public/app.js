/* =========================================================================
   EYRIES ESPORTS — FRONTEND APP LOGIC
   -------------------------------------------------------------------------
   Talks to the backend API (server/routes/auth.js + content.js + users.js):
     POST /api/auth/login         -> { token, user }
     POST /api/auth/signup        -> { token, user }
     GET  /api/content            -> full content document (any logged-in user)
     PUT  /api/content            -> save edits (admin only, enforced server-side)
     GET  /api/users              -> list all accounts (admin only)
     POST /api/users              -> create a new account directly (admin only)
     PUT  /api/users/:name/role   -> promote/demote a user (admin only)

   Token is stored in localStorage so a refresh keeps you logged in.
   ========================================================================= */

const API_BASE = "/api";
let authToken = localStorage.getItem("eyries_token") || null;
let currentUser = JSON.parse(localStorage.getItem("eyries_user") || "null");
let siteContent = null;
let currentGame = "BGMI";

// Safe to call whether or not anyone is logged in — never throws.
function isAdminUser() {
  return !!(currentUser && currentUser.role === "admin");
}

/* ---------------------------------------------------------------------
   API HELPERS
   --------------------------------------------------------------------- */
async function apiRequest(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}

/* ---------------------------------------------------------------------
   AUTH: LOGIN / SIGNUP / LOGOUT (optional — viewing never requires this)
   --------------------------------------------------------------------- */
const authScreen = document.getElementById("authScreen");
const appEl = document.getElementById("app");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const authSwitchBtn = document.getElementById("authSwitchBtn");
const authSub = document.getElementById("authSub");
const loginError = document.getElementById("loginError");
const signupError = document.getElementById("signupError");
const openAuthBtn = document.getElementById("openAuthBtn");
const authCloseBtn = document.getElementById("authCloseBtn");
const logoutBtn = document.getElementById("logoutBtn");

function openAuthModal() {
  authScreen.classList.remove("hidden");
  closeNav();
}
function closeAuthModal() {
  authScreen.classList.add("hidden");
  loginError.textContent = "";
  signupError.textContent = "";
}

openAuthBtn.addEventListener("click", openAuthModal);
authCloseBtn.addEventListener("click", closeAuthModal);
authScreen.addEventListener("click", (e) => {
  if (e.target === authScreen) closeAuthModal(); // click outside the card closes it
});

let showingSignup = false;
authSwitchBtn.addEventListener("click", () => {
  showingSignup = !showingSignup;
  loginForm.classList.toggle("hidden", showingSignup);
  signupForm.classList.toggle("hidden", !showingSignup);
  authSub.textContent = showingSignup
    ? "Create a fan account to follow Eyries"
    : "Log in to your account";
  authSwitchBtn.textContent = showingSignup
    ? "Already have an account? Log in"
    : "New here? Create a fan account";
  loginError.textContent = "";
  signupError.textContent = "";
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const btn = loginForm.querySelector(".auth-btn");
  btn.disabled = true;

  try {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    onLoginSuccess(data);
  } catch (err) {
    loginError.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupError.textContent = "";
  const username = document.getElementById("signupUsername").value.trim();
  const password = document.getElementById("signupPassword").value;
  const btn = signupForm.querySelector(".auth-btn");
  btn.disabled = true;

  try {
    const data = await apiRequest("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    onLoginSuccess(data);
  } catch (err) {
    signupError.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

function onLoginSuccess(data) {
  authToken = data.token;
  currentUser = data.user;
  localStorage.setItem("eyries_token", authToken);
  localStorage.setItem("eyries_user", JSON.stringify(currentUser));
  closeAuthModal();
  applyAuthState();
  loadContentAndRender();
}

logoutBtn.addEventListener("click", () => {
  authToken = null;
  currentUser = null;
  localStorage.removeItem("eyries_token");
  localStorage.removeItem("eyries_user");
  closeNav();
  applyAuthState();
  loadContentAndRender();
});

/* ---------------------------------------------------------------------
   APPLY AUTH STATE: show/hide login vs logout, admin tools, role badge
   --------------------------------------------------------------------- */
function applyAuthState() {
  const isLoggedIn = !!(authToken && currentUser);
  const isAdmin = isLoggedIn && currentUser.role === "admin";

  const roleBadge = document.getElementById("roleBadge");
  if (isLoggedIn) {
    roleBadge.textContent = isAdmin ? "Admin" : "Fan";
    roleBadge.classList.toggle("admin", isAdmin);
    roleBadge.classList.remove("hidden");
  } else {
    roleBadge.classList.add("hidden");
  }

  document.body.classList.toggle("admin-mode", isAdmin);

  openAuthBtn.classList.toggle("hidden", isLoggedIn);
  logoutBtn.classList.toggle("hidden", !isLoggedIn);

  const manageAdminsNavBtn = document.getElementById("manageAdminsNavBtn");
  const manageAdminsPanel = document.getElementById("manageAdmins");
  manageAdminsNavBtn.classList.toggle("hidden", !isAdmin);
  manageAdminsPanel.classList.toggle("hidden", !isAdmin);

  if (isAdmin) {
    loadUserList();
  }
}

/* ---------------------------------------------------------------------
   LOAD CONTENT + RENDER: runs on every page load, no login required
   --------------------------------------------------------------------- */
async function loadContentAndRender() {
  try {
    siteContent = await apiRequest("/content");
  } catch (err) {
    showToast("Could not load site content. Try refreshing.");
    return;
  }
  renderAll();
}

document.getElementById("yearNow").textContent = new Date().getFullYear();
applyAuthState();
loadContentAndRender();

/* ---------------------------------------------------------------------
   LOGO WATERMARK BLUR — sharp at the top (Home), grows blurrier the
   further down the page is scrolled. Purely decorative; never affects
   real content, which is layered above it (z-index) and stays sharp.

   Note: the page scrolls at the window/document level (no inner
   scrollable container), so we read window.scrollY, not an element's
   scrollTop.
   --------------------------------------------------------------------- */
const MAX_WATERMARK_BLUR = 14; // px, blur ceiling so it doesn't vanish entirely
const WATERMARK_BLUR_DISTANCE = 1800; // px of scroll over which blur ramps up fully

function updateWatermarkBlur() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const ratio = Math.min(scrollTop / WATERMARK_BLUR_DISTANCE, 1);
  const blur = ratio * MAX_WATERMARK_BLUR;
  document.getElementById("app").style.setProperty("--watermark-blur", `${blur}px`);
}

window.addEventListener("scroll", updateWatermarkBlur, { passive: true });
updateWatermarkBlur();

/* ---------------------------------------------------------------------
   HAMBURGER NAV + SCROLL-TO-SECTION
   --------------------------------------------------------------------- */
const hamburgerBtn = document.getElementById("hamburgerBtn");
const navDrawer = document.getElementById("navDrawer");
const navOverlay = document.getElementById("navOverlay");

function openNav() {
  navDrawer.classList.add("open");
  navOverlay.classList.add("open");
  hamburgerBtn.classList.add("open");
  hamburgerBtn.setAttribute("aria-expanded", "true");
}
function closeNav() {
  navDrawer.classList.remove("open");
  navOverlay.classList.remove("open");
  hamburgerBtn.classList.remove("open");
  hamburgerBtn.setAttribute("aria-expanded", "false");
}
hamburgerBtn.addEventListener("click", () => {
  navDrawer.classList.contains("open") ? closeNav() : openNav();
});
navOverlay.addEventListener("click", closeNav);

document.querySelectorAll(".navlink[data-target]").forEach((link) => {
  link.addEventListener("click", () => {
    if (link.dataset.target === "tournaments") {
      openTournamentsOverlay();
      closeNav();
      return;
    }
    if (link.dataset.target === "achievements") {
      openAchievementsOverlay();
      closeNav();
      return;
    }
    const target = document.getElementById(link.dataset.target);
    if (target) target.scrollIntoView({ behavior: "smooth" });
    closeNav();
  });
});

document.querySelectorAll("[data-scrollto]").forEach((el) => {
  el.addEventListener("click", () => {
    const target = document.getElementById(el.dataset.scrollto);
    if (target) target.scrollIntoView({ behavior: "smooth" });
  });
});

document.getElementById("openHighlightsBtn").addEventListener("click", () => {
  openHighlightsOverlay();
  closeNav();
});

/* ---------------------------------------------------------------------
   TOURNAMENTS OVERLAY — separate full-screen view, never part of scroll.
   Reached only via the hamburger "Tournaments" link or the bell button.
   --------------------------------------------------------------------- */
const tournamentsOverlay = document.getElementById("tournamentsOverlay");
const bellBtn = document.getElementById("bellBtn");
const bellDot = document.getElementById("bellDot");
let currentTournamentGame = "BGMI";
let currentStatusFilter = "all";

function openTournamentsOverlay() {
  tournamentsOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  renderTournaments();
}
function closeTournamentsOverlay() {
  tournamentsOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}

bellBtn.addEventListener("click", openTournamentsOverlay);
document.getElementById("tournamentsBackBtn").addEventListener("click", closeTournamentsOverlay);

/* ---------------------------------------------------------------------
   ACHIEVEMENTS OVERLAY — same pattern as Tournaments: a separate
   full-screen view, reachable only via the hamburger nav, never part
   of the normal scroll.
   --------------------------------------------------------------------- */
const achievementsOverlay = document.getElementById("achievementsOverlay");

function openAchievementsOverlay() {
  achievementsOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  renderAchievements();
}
function closeAchievementsOverlay() {
  achievementsOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}
document.getElementById("achievementsBackBtn").addEventListener("click", closeAchievementsOverlay);

function renderAchievements() {
  const c = siteContent;
  document.getElementById("trophyList").innerHTML = (c.achievements || [])
    .map((a, i) => renderTrophyCard(a, i))
    .join("");
  attachEditHandlers();
  document.querySelectorAll('.admin-add-btn[data-add="achievements"]').forEach((btn) => {
    btn.classList.toggle("hidden", !isAdminUser());
  });
}

const highlightsOverlay = document.getElementById("highlightsOverlay");

function openHighlightsOverlay() {
  highlightsOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  renderHighlights();
}
function closeHighlightsOverlay() {
  highlightsOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}
document.getElementById("highlightsBackBtn").addEventListener("click", closeHighlightsOverlay);

// Tracks which highlight cards have been expanded ("Read more" clicked) in
// this session, so re-renders (e.g. after an admin edit) don't collapse a
// card the visitor already opened.
const expandedHighlights = new Set();

function renderHighlightCard(item, index) {
  const prefix = `highlights.${index}`;
  const isExpanded = expandedHighlights.has(index);
  const hasDesc = !!(item.description && item.description.trim());

  const deleteBtn = isAdminUser()
    ? `<button class="highlight-delete-btn" data-delete-highlight="${index}">Delete</button>`
    : "";

  return `
    <div class="highlight-card">
      <div class="highlight-photo" data-edit-field="${prefix}.photoUrl" data-edit-type="photo" ${photoStyle(item.photoUrl)}>
        ${item.photoUrl ? "" : "1080×1350 PHOTO"}
      </div>
      <div class="highlight-info">
        <div class="highlight-title" data-edit-field="${prefix}.title" data-edit-type="text">${item.title || "[Highlight title]"}</div>
        <div class="highlight-desc ${isExpanded ? "" : "collapsed"}" data-edit-field="${prefix}.description" data-edit-type="textarea">${item.description || "[Description]"}</div>
        ${hasDesc ? `<button class="highlight-readmore" data-toggle-highlight="${index}">${isExpanded ? "Show less" : "Read more"}</button>` : ""}
        ${deleteBtn}
      </div>
    </div>
  `;
}

function renderHighlights() {
  const c = siteContent;
  const list = c.highlights || [];

  document.getElementById("highlightList").innerHTML = list.length
    ? list.map((h, i) => renderHighlightCard(h, i)).join("")
    : `<div class="empty-note">No highlights yet.</div>`;

  attachEditHandlers();

  document.querySelectorAll("[data-toggle-highlight]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.toggleHighlight, 10);
      if (expandedHighlights.has(idx)) {
        expandedHighlights.delete(idx);
      } else {
        expandedHighlights.add(idx);
      }
      renderHighlights();
    });
  });

  document.querySelectorAll("[data-delete-highlight]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.deleteHighlight, 10);
      if (!confirm("Delete this highlight? This can't be undone.")) return;
      siteContent.highlights.splice(idx, 1);
      try {
        await apiRequest("/content", { method: "PUT", body: JSON.stringify(siteContent) });
        showToast("Highlight deleted.");
        renderHighlights();
      } catch (err) {
        showToast(err.message || "Could not delete. Try again.");
      }
    });
  });

  document.querySelectorAll('.admin-add-btn[data-add="highlight"]').forEach((btn) => {
    btn.classList.toggle("hidden", !isAdminUser());
  });
}

document.querySelectorAll(".tournament-game-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    // Don't switch games if the click landed on the editable logo itself
    // while in admin mode — let the edit handler take that click instead.
    if (e.target.closest(".tournament-game-logo") && isAdminUser()) return;
    currentTournamentGame = btn.dataset.tgame;
    renderTournaments();
  });
});

document.querySelectorAll("#statusFilterRow .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    currentStatusFilter = chip.dataset.status;
    renderTournaments();
  });
});

function gameLogoSlot(game) {
  const el = document.getElementById(`logo${game}`);
  return el;
}

function renderGameLogos() {
  const logos = (siteContent.tournaments && siteContent.tournaments.gameLogos) || {};
  ["BGMI", "EFOOTBALL", "VALORANT"].forEach((game) => {
    const slot = gameLogoSlot(game);
    if (!slot) return;
    const url = logos[game] || "";
    if (url) {
      slot.style.backgroundImage = `url('${url}')`;
      slot.innerHTML = "";
    } else {
      slot.style.backgroundImage = "";
      const label = game === "EFOOTBALL" ? "EFB" : game === "VALORANT" ? "VAL" : "BGMI";
      slot.innerHTML = `<span class="tournament-game-logo-placeholder">${label}</span>`;
    }
  });
}

function renderTournamentCard(t, index) {
  const prefix = `tournaments.list.${index}`;
  const statusLabel = { upcoming: "Upcoming", ongoing: "Ongoing", past: "Past" }[t.status] || "Upcoming";
  const link = t.registrationLink || "";

  // Admins always see a registration-link control on the card — either the
  // "Register Now" button itself (click to open the editor) when a link is
  // already set, or a dashed "+ Add registration link" placeholder when it
  // isn't. Non-admin visitors only ever see "Register Now", and only once
  // a real link exists — never a dead/broken button.
  let registerArea;
  if (isAdminUser()) {
    registerArea = link
      ? `<a class="tournament-register-btn" href="${link}" target="_blank" rel="noopener" data-edit-field="${prefix}.registrationLink" data-edit-type="text" data-edit-label="Edit this event's registration link">Register Now</a>`
      : `<span class="tournament-add-reglink-btn" data-edit-field="${prefix}.registrationLink" data-edit-type="text" data-edit-label="Add this event's registration link">+ Add registration link</span>`;
  } else {
    registerArea = link
      ? `<a class="tournament-register-btn" href="${link}" target="_blank" rel="noopener">Register Now</a>`
      : "";
  }

  const deleteBtn = isAdminUser()
    ? `<button class="tournament-delete-btn" data-delete-tournament="${index}">Delete</button>`
    : "";

  const bottomRow = (registerArea || deleteBtn)
    ? `<div class="tournament-bottom-row">${deleteBtn}${registerArea}</div>`
    : "";

  return `
    <div class="tournament-card status-${t.status}">
      <div class="tournament-main-row">
        <div class="tournament-photo" data-edit-field="${prefix}.photoUrl" data-edit-type="photo" ${photoStyle(t.photoUrl)}>
          ${t.photoUrl ? "" : `<span class="tournament-photo-placeholder">Event photo</span>`}
        </div>
        <div class="tournament-info-col">
          <div class="tournament-top-row">
            <div>
              <div class="tournament-name" data-edit-field="${prefix}.name" data-edit-type="text">${t.name || "[Tournament name]"}</div>
              <div class="tournament-game-tag">${t.game || "BGMI"}</div>
            </div>
            <span class="tournament-status-badge ${t.status}" data-edit-field="${prefix}.status" data-edit-type="text">${statusLabel}</span>
          </div>
          <div class="tournament-date" data-edit-field="${prefix}.date" data-edit-type="text">${t.date || "[Date]"}</div>
          <div class="tournament-desc" data-edit-field="${prefix}.description" data-edit-type="textarea">${t.description || "[Description]"}</div>
        </div>
      </div>
      ${t.result || isAdminUser()
        ? `<div class="tournament-result" data-edit-field="${prefix}.result" data-edit-type="text">${t.result || "[Add result — optional]"}</div>`
        : ""}
      ${bottomRow}
    </div>
  `;
}

function renderTournaments() {
  renderGameLogos();

  document.querySelectorAll(".tournament-game-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tgame === currentTournamentGame);
  });
  document.querySelectorAll("#statusFilterRow .chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.status === currentStatusFilter);
  });

  const allTournaments = (siteContent.tournaments && siteContent.tournaments.list) || [];

  const filtered = allTournaments
    .map((t, i) => ({ t, i })) // keep original index for correct edit-path / delete targeting
    .filter(({ t }) => t.game === currentTournamentGame)
    .filter(({ t }) => currentStatusFilter === "all" || t.status === currentStatusFilter);

  const listEl = document.getElementById("tournamentList");
  listEl.innerHTML = filtered.length
    ? filtered.map(({ t, i }) => renderTournamentCard(t, i)).join("")
    : `<div class="empty-note">No ${currentStatusFilter === "all" ? "" : currentStatusFilter + " "}tournaments for this game yet.</div>`;

  attachEditHandlers();

  document.querySelectorAll(".tournament-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.deleteTournament, 10);
      if (!confirm("Delete this tournament? This can't be undone.")) return;
      siteContent.tournaments.list.splice(idx, 1);
      try {
        await apiRequest("/content", { method: "PUT", body: JSON.stringify(siteContent) });
        showToast("Tournament deleted.");
        renderTournaments();
      } catch (err) {
        showToast(err.message || "Could not delete. Try again.");
      }
    });
  });

  document.querySelectorAll('.admin-add-btn[data-add="tournament"]').forEach((btn) => {
    btn.classList.toggle("hidden", !isAdminUser());
  });

  updateBellDot();
}

function updateBellDot() {
  const allTournaments = (siteContent.tournaments && siteContent.tournaments.list) || [];
  const hasOngoing = allTournaments.some((t) => t.status === "ongoing");
  bellDot.classList.toggle("hidden", !hasOngoing);
}

/* ---------------------------------------------------------------------
   RENDERING
   --------------------------------------------------------------------- */
function initials(name) {
  if (!name) return "?";
  return name
    .replace(/\[|\]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function photoStyle(photoUrl) {
  return photoUrl ? `style="background-image:url('${photoUrl}')"` : "";
}

function renderPersonCard(person, { editPrefix, deleteKey, size } = {}) {
  const editAttrs = editPrefix
    ? `data-edit-group="${editPrefix}"`
    : "";
  const deleteBtn = deleteKey && isAdminUser()
    ? `<button class="person-delete-btn" data-delete-person="${deleteKey}">Delete</button>`
    : "";
  const photoClass = size ? `person-photo person-photo-${size}` : "person-photo";
  // Founder/Co-Founder (size set) get a stacked, centered profile-card
  // layout — photo on top, name+title centered below. Team (no size)
  // keeps the original compact side-by-side row.
  const rowClass = size ? "person-top-row person-top-row-stacked" : "person-top-row";
  return `
    <div class="person-card" ${editAttrs}>
      <div class="${rowClass}">
        <div class="${photoClass}" data-edit-field="${editPrefix}.photoUrl" data-edit-type="photo" ${photoStyle(person.photoUrl)}>
          ${person.photoUrl ? "" : initials(person.name)}
        </div>
        <div class="person-info">
          <div class="person-name" data-edit-field="${editPrefix}.name" data-edit-type="text">${person.name || "[Name]"}</div>
          <div class="person-title" data-edit-field="${editPrefix}.title" data-edit-type="text">${person.title || "[Title]"}</div>
        </div>
      </div>
      <div class="person-bio" data-edit-field="${editPrefix}.bio" data-edit-type="textarea">${person.bio || "[Bio]"}</div>
      ${deleteBtn}
    </div>
  `;
}

function renderTrophyCard(item, index) {
  const prefix = `achievements.${index}`;
  return `
    <div class="trophy-card">
      <div class="trophy-photo" data-edit-field="${prefix}.photoUrl" data-edit-type="photo" ${photoStyle(item.photoUrl)}>
        ${item.photoUrl ? "" : "TROPHY"}
      </div>
      <div class="trophy-info">
        <div class="trophy-top">
          <div class="trophy-title" data-edit-field="${prefix}.title" data-edit-type="text">${item.title || "[Achievement]"}</div>
          <div class="trophy-year" data-edit-field="${prefix}.year" data-edit-type="text">${item.year || "[Year]"}</div>
        </div>
        <div class="trophy-event" data-edit-field="${prefix}.event" data-edit-type="text">${item.event || "[Event]"}</div>
        <div class="trophy-desc" data-edit-field="${prefix}.description" data-edit-type="textarea">${item.description || "[Description]"}</div>
      </div>
    </div>
  `;
}

function renderPlayerCard(player, prefix, index) {
  const deleteBtn = isAdminUser()
    ? `<button class="player-delete-btn" data-delete-player="${index}">Delete</button>`
    : "";

  const status = player.status === "then" ? "then" : "now"; // default to "now" if missing/invalid

  // Fans see a plain dot + label. Admins instead see a dropdown so they
  // can switch a player between current ("Now") and former ("Then").
  const statusControl = isAdminUser()
    ? `
      <select class="player-status-select status-${status}" data-status-select="${index}">
        <option value="now" ${status === "now" ? "selected" : ""}>Now</option>
        <option value="then" ${status === "then" ? "selected" : ""}>Then</option>
      </select>
    `
    : `<span class="player-status status-${status}"><span class="status-dot"></span>${status === "now" ? "Now" : "Then"}</span>`;

  return `
    <div class="player-card-sq">
      <div class="player-status-badge">${statusControl}</div>
      <div class="player-photo-sq" data-edit-field="${prefix}.photoUrl" data-edit-type="photo" ${photoStyle(player.photoUrl)}>
        ${player.photoUrl ? "" : initials(player.name)}
      </div>
      <div class="player-info-sq">
        <div class="player-name-sq" data-edit-field="${prefix}.name" data-edit-type="text">${player.name || "[Player name]"}</div>
        <div class="player-gamingid-sq" data-edit-field="${prefix}.gamingId" data-edit-type="text">${player.gamingId || "[Gaming ID]"}</div>
        <div class="player-role-sq" data-edit-field="${prefix}.role" data-edit-type="text">${player.role || "[Role]"}</div>
      </div>
      ${deleteBtn}
    </div>
  `;
}

function renderAnnouncementCard(item, prefix) {
  return `
    <div class="announcement-card">
      <div class="announcement-top">
        <div class="announcement-title" data-edit-field="${prefix}.title" data-edit-type="text">${item.title || "[Announcement title]"}</div>
        <div class="announcement-date" data-edit-field="${prefix}.date" data-edit-type="text">${item.date || "[Date]"}</div>
      </div>
      <div class="announcement-body" data-edit-field="${prefix}.body" data-edit-type="textarea">${item.body || "[Details]"}</div>
    </div>
  `;
}

function renderSquads() {
  const squad = (siteContent.squads && siteContent.squads[currentGame]) || { players: [], announcements: [] };
  const squadPrefix = `squads.${currentGame}`;

  document.querySelectorAll(".game-switch-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.game === currentGame);
  });

  const players = squad.players || [];
  document.getElementById("playerGrid").innerHTML = players.length
    ? players.map((p, i) => renderPlayerCard(p, `${squadPrefix}.players.${i}`, i)).join("")
    : `<div class="empty-note">No players added for ${currentGame} yet.</div>`;

  const announcements = squad.announcements || [];
  document.getElementById("announcementList").innerHTML = announcements.length
    ? announcements.map((a, i) => renderAnnouncementCard(a, `${squadPrefix}.announcements.${i}`)).join("")
    : `<div class="empty-note">No announcements for ${currentGame} yet.</div>`;

  attachEditHandlers();

  document.querySelectorAll("[data-delete-player]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.deletePlayer, 10);
      if (!confirm("Delete this player? This can't be undone.")) return;
      siteContent.squads[currentGame].players.splice(idx, 1);
      try {
        await apiRequest("/content", { method: "PUT", body: JSON.stringify(siteContent) });
        showToast("Player deleted.");
        renderSquads();
      } catch (err) {
        showToast(err.message || "Could not delete. Try again.");
      }
    });
  });

  document.querySelectorAll("[data-status-select]").forEach((select) => {
    select.addEventListener("change", async () => {
      const idx = parseInt(select.dataset.statusSelect, 10);
      const newStatus = select.value === "then" ? "then" : "now";
      siteContent.squads[currentGame].players[idx].status = newStatus;
      try {
        await apiRequest("/content", { method: "PUT", body: JSON.stringify(siteContent) });
        showToast(`Marked as ${newStatus === "now" ? "Now" : "Then"}.`);
        renderSquads();
      } catch (err) {
        showToast(err.message || "Could not update. Try again.");
      }
    });
  });

  document.querySelectorAll('.admin-add-btn[data-add="player"], .admin-add-btn[data-add="announcement"]').forEach((btn) => {
    btn.classList.toggle("hidden", !isAdminUser());
  });
}

document.querySelectorAll(".game-switch-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentGame = btn.dataset.game;
    renderSquads();
  });
});

function renderAll() {
  const c = siteContent;

  updateBellDot();

  // Hero
  document.querySelector('[data-edit-field="hero.tagline"]').textContent = c.hero?.tagline || "";
  document.querySelector('[data-edit-field="hero.headline"]').textContent = c.hero?.headline || "";
  document.querySelector('[data-edit-field="hero.subtext"]').textContent = c.hero?.subtext || "";

  // Hero jersey showcase photo
  const heroJersey = document.getElementById("heroJersey");
  const jerseyUrl = c.hero?.jerseyPhotoUrl || "";
  if (jerseyUrl) {
    heroJersey.style.backgroundImage = `url('${jerseyUrl}')`;
    heroJersey.innerHTML = "";
  } else {
    heroJersey.style.backgroundImage = "";
    heroJersey.innerHTML = `<span class="hero-jersey-placeholder">Jersey photo</span>`;
  }

  // 3 stacked photo-only images below the jersey, above About — no text,
  // each admin-editable via the same paste-URL pattern used everywhere else.
  const heroPhotos = (c.hero?.photos && c.hero.photos.length ? c.hero.photos : ["", "", ""]);
  document.getElementById("heroPhotoStack").innerHTML = [0, 1, 2]
    .map((i) => {
      const url = heroPhotos[i] || "";
      return `
        <div class="hero-stack-photo" data-edit-field="hero.photos.${i}" data-edit-type="photo" ${photoStyle(url)}>
          ${url ? "" : `<span class="hero-stack-photo-placeholder">Photo ${i + 1}</span>`}
        </div>
      `;
    })
    .join("");

  // Founder
  document.getElementById("founderCard").innerHTML = renderPersonCard(c.founder || {}, { editPrefix: "founder", size: "founder" });

  // Co-founders
  document.getElementById("coFoundersGrid").innerHTML = (c.coFounders || [])
    .map((p, i) => renderPersonCard(p, { editPrefix: `coFounders.${i}`, deleteKey: `coFounders.${i}`, size: "cofounder" }))
    .join("");

  // Team
  document.getElementById("teamGrid").innerHTML = (c.team || [])
    .map((p, i) => renderPersonCard(p, { editPrefix: `team.${i}`, deleteKey: `team.${i}` }))
    .join("");

  // Achievements
  document.getElementById("trophyList").innerHTML = (c.achievements || [])
    .map((a, i) => renderTrophyCard(a, i))
    .join("");

  // Squads (players + announcements for the currently selected game)
  renderSquads();

  // Contact
  const contact = c.contact || {};
  const contactRows = [
    ["Email", contact.email],
    ["Phone", contact.phone],
    ["Address", contact.address]
  ].filter(([, v]) => v);

  document.getElementById("contactGrid").innerHTML = [
    rowHtml("Email", contact.email, "contact.email"),
    rowHtml("Phone", contact.phone, "contact.phone"),
    rowHtml("Address", contact.address, "contact.address")
  ].join("");

  const socials = [
    ["Instagram", contact.instagram, "contact.instagram"],
    ["Twitter / X", contact.twitter, "contact.twitter"],
    ["YouTube", contact.youtube, "contact.youtube"],
    ["Discord", contact.discord, "contact.discord"]
  ];
  document.getElementById("socialRow").innerHTML = socials
    .map(([label, url, field]) => {
      if (isAdminUser()) {
        return `<a class="social-pill" href="${url || "#"}" target="_blank" rel="noopener" data-edit-field="${field}" data-edit-type="text">${label}</a>`;
      }
      return url ? `<a class="social-pill" href="${url}" target="_blank" rel="noopener">${label}</a>` : "";
    })
    .join("");

  attachEditHandlers();

  document.querySelectorAll("[data-delete-person]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const [arrayName, idxStr] = btn.dataset.deletePerson.split(".");
      const idx = parseInt(idxStr, 10);
      if (!confirm("Delete this person? This can't be undone.")) return;
      siteContent[arrayName].splice(idx, 1);
      try {
        await apiRequest("/content", { method: "PUT", body: JSON.stringify(siteContent) });
        showToast("Deleted.");
        renderAll();
      } catch (err) {
        showToast(err.message || "Could not delete. Try again.");
      }
    });
  });

  // Show admin-only "add" buttons
  document.querySelectorAll(".admin-add-btn").forEach((btn) => {
    btn.classList.toggle("hidden", !isAdminUser());
  });
}

function rowHtml(label, value, field) {
  return `
    <div class="contact-row">
      <span class="contact-label">${label}</span>
      <span class="contact-value" data-edit-field="${field}" data-edit-type="text">${value || "[Add " + label.toLowerCase() + "]"}</span>
    </div>
  `;
}

/* ---------------------------------------------------------------------
   ADMIN "+ ADD" BUTTONS (team, achievements, players, announcements)
   --------------------------------------------------------------------- */
const blankItemFor = {
  team: () => ({ name: "", title: "", bio: "", photoUrl: "" }),
  coFounder: () => ({ name: "", title: "", bio: "", photoUrl: "" }),
  achievements: () => ({ title: "", event: "", year: "", description: "", photoUrl: "" }),
  highlight: () => ({ title: "", description: "", photoUrl: "" }),
  player: () => ({ name: "", gamingId: "", role: "", photoUrl: "", status: "now" }),
  announcement: () => ({ title: "", body: "", date: "" }),
  tournament: () => ({ name: "", game: currentTournamentGame, status: "upcoming", date: "", description: "", result: "", photoUrl: "", registrationLink: "" })
};

document.querySelectorAll(".admin-add-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const kind = btn.dataset.add;
    const makeBlank = blankItemFor[kind];
    if (!makeBlank) return;

    if (kind === "team") {
      siteContent.team = siteContent.team || [];
      siteContent.team.push(makeBlank());
    } else if (kind === "coFounder") {
      siteContent.coFounders = siteContent.coFounders || [];
      siteContent.coFounders.push(makeBlank());
    } else if (kind === "achievements") {
      siteContent.achievements = siteContent.achievements || [];
      siteContent.achievements.push(makeBlank());
    } else if (kind === "highlight") {
      siteContent.highlights = siteContent.highlights || [];
      siteContent.highlights.push(makeBlank());
    } else if (kind === "player") {
      siteContent.squads = siteContent.squads || {};
      siteContent.squads[currentGame] = siteContent.squads[currentGame] || { players: [], announcements: [] };
      siteContent.squads[currentGame].players = siteContent.squads[currentGame].players || [];
      siteContent.squads[currentGame].players.push(makeBlank());
    } else if (kind === "announcement") {
      siteContent.squads = siteContent.squads || {};
      siteContent.squads[currentGame] = siteContent.squads[currentGame] || { players: [], announcements: [] };
      siteContent.squads[currentGame].announcements = siteContent.squads[currentGame].announcements || [];
      siteContent.squads[currentGame].announcements.push(makeBlank());
    } else if (kind === "tournament") {
      siteContent.tournaments = siteContent.tournaments || { gameLogos: {}, list: [] };
      siteContent.tournaments.list = siteContent.tournaments.list || [];
      siteContent.tournaments.list.push(makeBlank());
    }

    try {
      await apiRequest("/content", {
        method: "PUT",
        body: JSON.stringify(siteContent)
      });
      showToast("Added — click its fields to fill them in.");
      if (kind === "tournament") {
        renderTournaments();
      } else if (kind === "highlight") {
        renderHighlights();
      } else {
        renderAll();
      }
    } catch (err) {
      showToast(err.message || "Could not save. Try again.");
    }
  });
});

/* ---------------------------------------------------------------------
   ADMIN INLINE EDITING
   --------------------------------------------------------------------- */
const editModalOverlay = document.getElementById("editModalOverlay");
const editModalTitle = document.getElementById("editModalTitle");
const editModalTextarea = document.getElementById("editModalTextarea");
const editModalCancel = document.getElementById("editModalCancel");
const editModalSave = document.getElementById("editModalSave");

let activeEditField = null;
let activeEditType = null;

function attachEditHandlers() {
  if (!isAdminUser()) return;

  document.querySelectorAll("[data-edit-field]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openEditModal(el);
    });
  });
}

function getValueByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}
function setValueByPath(obj, path, value) {
  const keys = path.split(".");
  let target = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (target[key] == null) target[key] = {};
    target = target[key];
  }
  target[keys[keys.length - 1]] = value;
}

function openEditModal(el) {
  activeEditField = el.dataset.editField;
  activeEditType = el.dataset.editType;

  const currentValue = getValueByPath(siteContent, activeEditField) || "";
  const friendlyLabel = el.dataset.editLabel;
  editModalTitle.textContent = friendlyLabel
    ? friendlyLabel
    : activeEditType === "photo" ? "Paste a photo URL" : `Edit: ${activeEditField}`;
  editModalTextarea.value = currentValue;
  editModalTextarea.placeholder =
    activeEditType === "photo" ? "https://example.com/photo.jpg" : "";
  editModalOverlay.classList.remove("hidden");
  editModalTextarea.focus();
}

editModalCancel.addEventListener("click", () => {
  editModalOverlay.classList.add("hidden");
});

editModalSave.addEventListener("click", async () => {
  const newValue = editModalTextarea.value.trim();
  setValueByPath(siteContent, activeEditField, newValue);
  editModalOverlay.classList.add("hidden");

  try {
    await apiRequest("/content", {
      method: "PUT",
      body: JSON.stringify(siteContent)
    });
    showToast("Saved.");

    // Re-render whichever view is actually visible right now. The main
    // scrollable page, the Tournaments overlay, the Achievements overlay,
    // and the Highlights overlay each have their own render function —
    // renderAll() alone doesn't touch the others, so without this an edit
    // made while an overlay is open would save correctly but not visibly update.
    if (!tournamentsOverlay.classList.contains("hidden")) {
      renderTournaments();
    } else if (!achievementsOverlay.classList.contains("hidden")) {
      renderAchievements();
    } else if (!highlightsOverlay.classList.contains("hidden")) {
      renderHighlights();
    } else {
      renderAll();
    }
  } catch (err) {
    showToast(err.message || "Could not save. Try again.");
  }
});

/* ---------------------------------------------------------------------
   TOAST
   --------------------------------------------------------------------- */
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

/* ---------------------------------------------------------------------
   MANAGE ADMINS (admin only)
   --------------------------------------------------------------------- */
async function loadUserList() {
  try {
    const users = await apiRequest("/users");
    renderUserList(users);
  } catch (err) {
    showToast(err.message || "Could not load accounts.");
  }
}

function renderUserList(users) {
  const listEl = document.getElementById("userList");

  if (!users.length) {
    listEl.innerHTML = `<div class="empty-note">No accounts yet.</div>`;
    return;
  }

  listEl.innerHTML = users
    .map((u) => {
      const isSelf = u.username === currentUser.username;
      const isAdminUser = u.role === "admin";
      const joined = u.createdAt
        ? new Date(u.createdAt).toLocaleDateString()
        : "";

      const actionButton = isAdminUser
        ? `<button class="role-toggle-btn remove-admin" data-username="${u.username}" data-newrole="user" ${isSelf ? "disabled title=\"You can't remove your own admin access\"" : ""}>Remove admin</button>`
        : `<button class="role-toggle-btn make-admin" data-username="${u.username}" data-newrole="admin">Make admin</button>`;

      return `
        <div class="user-row">
          <div class="user-row-info">
            <div class="user-row-name">${u.username}${isSelf ? " (you)" : ""}</div>
            <div class="user-row-meta">Joined ${joined}</div>
          </div>
          <div class="user-row-actions">
            <span class="user-role-pill ${isAdminUser ? "admin" : ""}">${isAdminUser ? "Admin" : "Fan"}</span>
            ${actionButton}
          </div>
        </div>
      `;
    })
    .join("");

  listEl.querySelectorAll(".role-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const username = btn.dataset.username;
      const newRole = btn.dataset.newrole;
      btn.disabled = true;

      try {
        await apiRequest(`/users/${encodeURIComponent(username)}/role`, {
          method: "PUT",
          body: JSON.stringify({ role: newRole })
        });
        showToast(newRole === "admin" ? `${username} is now an admin.` : `${username}'s admin access removed.`);
        loadUserList();
      } catch (err) {
        showToast(err.message || "Could not update that account.");
        btn.disabled = false;
      }
    });
  });
}

const adminCreateForm = document.getElementById("adminCreateForm");
const adminCreateError = document.getElementById("adminCreateError");

adminCreateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  adminCreateError.textContent = "";

  const username = document.getElementById("newAccUsername").value.trim();
  const password = document.getElementById("newAccPassword").value;
  const isAdmin = document.getElementById("newAccIsAdmin").checked;
  const submitBtn = adminCreateForm.querySelector(".auth-btn");
  submitBtn.disabled = true;

  try {
    await apiRequest("/users", {
      method: "POST",
      body: JSON.stringify({ username, password, role: isAdmin ? "admin" : "user" })
    });
    showToast(`Account "${username}" created.`);
    adminCreateForm.reset();
    loadUserList();
  } catch (err) {
    adminCreateError.textContent = err.message || "Could not create account.";
  } finally {
    submitBtn.disabled = false;
  }
});