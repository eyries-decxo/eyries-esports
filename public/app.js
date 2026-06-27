/* =========================================================================
   EYRIES ESPORTS — FRONTEND APP LOGIC
   ========================================================================= */

const API_BASE = "/api";
let authToken = localStorage.getItem("eyries_token") || null;
let currentUser = JSON.parse(localStorage.getItem("eyries_user") || "null");
let siteContent = null;
let currentGame = "BGMI";

function isAdminUser() {
  return !!(currentUser && currentUser.role === "admin");
}

/* --------------------------------------------------------------------- */
async function apiRequest(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

/* --------------------------------------------------------------------- AUTH */
const authScreen   = document.getElementById("authScreen");
const loginForm    = document.getElementById("loginForm");
const signupForm   = document.getElementById("signupForm");
const authSwitchBtn= document.getElementById("authSwitchBtn");
const authSub      = document.getElementById("authSub");
const loginError   = document.getElementById("loginError");
const signupError  = document.getElementById("signupError");
const openAuthBtn  = document.getElementById("openAuthBtn");
const authCloseBtn = document.getElementById("authCloseBtn");
const logoutBtn    = document.getElementById("logoutBtn");

function openAuthModal(){ authScreen.classList.remove("hidden"); closeNav(); }
function closeAuthModal(){
  authScreen.classList.add("hidden");
  loginError.textContent = "";
  signupError.textContent = "";
}
openAuthBtn.addEventListener("click", openAuthModal);
authCloseBtn.addEventListener("click", closeAuthModal);
authScreen.addEventListener("click", e => { if (e.target === authScreen) closeAuthModal(); });

let showingSignup = false;
authSwitchBtn.addEventListener("click", () => {
  showingSignup = !showingSignup;
  loginForm.classList.toggle("hidden", showingSignup);
  signupForm.classList.toggle("hidden", !showingSignup);
  authSub.textContent = showingSignup ? "Create a fan account to follow Eyries" : "Log in to your account";
  authSwitchBtn.textContent = showingSignup ? "Already have an account? Log in" : "New here? Create a fan account";
  loginError.textContent = "";
  signupError.textContent = "";
});

loginForm.addEventListener("submit", async e => {
  e.preventDefault(); loginError.textContent = "";
  const btn = loginForm.querySelector(".auth-btn"); btn.disabled = true;
  try {
    const data = await apiRequest("/auth/login", { method:"POST", body: JSON.stringify({
      username: document.getElementById("loginUsername").value.trim(),
      password: document.getElementById("loginPassword").value
    })});
    onLoginSuccess(data);
  } catch(err){ loginError.textContent = err.message; }
  finally{ btn.disabled = false; }
});

signupForm.addEventListener("submit", async e => {
  e.preventDefault(); signupError.textContent = "";
  const btn = signupForm.querySelector(".auth-btn"); btn.disabled = true;
  try {
    const data = await apiRequest("/auth/signup", { method:"POST", body: JSON.stringify({
      username: document.getElementById("signupUsername").value.trim(),
      password: document.getElementById("signupPassword").value
    })});
    onLoginSuccess(data);
  } catch(err){ signupError.textContent = err.message; }
  finally{ btn.disabled = false; }
});

function onLoginSuccess(data){
  authToken = data.token; currentUser = data.user;
  localStorage.setItem("eyries_token", authToken);
  localStorage.setItem("eyries_user", JSON.stringify(currentUser));
  closeAuthModal(); applyAuthState(); loadContentAndRender();
}

logoutBtn.addEventListener("click", () => {
  authToken = null; currentUser = null;
  localStorage.removeItem("eyries_token"); localStorage.removeItem("eyries_user");
  closeNav(); applyAuthState(); loadContentAndRender();
});

/* --------------------------------------------------------------------- AUTH STATE */
function applyAuthState(){
  const isLoggedIn = !!(authToken && currentUser);
  const isAdmin = isLoggedIn && currentUser.role === "admin";
  const roleBadge = document.getElementById("roleBadge");
  if(isLoggedIn){ roleBadge.textContent = isAdmin?"Admin":"Fan"; roleBadge.classList.toggle("admin",isAdmin); roleBadge.classList.remove("hidden"); }
  else { roleBadge.classList.add("hidden"); }
  document.body.classList.toggle("admin-mode", isAdmin);
  openAuthBtn.classList.toggle("hidden", isLoggedIn);
  logoutBtn.classList.toggle("hidden", !isLoggedIn);
  const manageAdminsNavBtn = document.getElementById("manageAdminsNavBtn");
  const manageAdminsPanel  = document.getElementById("manageAdmins");
  manageAdminsNavBtn.classList.toggle("hidden", !isAdmin);
  manageAdminsPanel.classList.toggle("hidden", !isAdmin);
  if(isAdmin) loadUserList();
}

/* --------------------------------------------------------------------- LOAD */
async function loadContentAndRender(){
  try { siteContent = await apiRequest("/content"); }
  catch(err){ showToast("Could not load site content. Try refreshing."); return; }
  renderAll();
}
document.getElementById("yearNow").textContent = new Date().getFullYear();
applyAuthState();
loadContentAndRender();

/* --------------------------------------------------------------------- WATERMARK */
function updateWatermarkBlur(){
  const s = Math.min((window.scrollY||0) / 1800, 1);
  document.getElementById("app").style.setProperty("--watermark-blur", `${s*14}px`);
}
window.addEventListener("scroll", updateWatermarkBlur, { passive:true });
updateWatermarkBlur();

/* --------------------------------------------------------------------- NAV */
const hamburgerBtn = document.getElementById("hamburgerBtn");
const navDrawer    = document.getElementById("navDrawer");
const navOverlay   = document.getElementById("navOverlay");

function openNav(){ navDrawer.classList.add("open"); navOverlay.classList.add("open"); hamburgerBtn.classList.add("open"); hamburgerBtn.setAttribute("aria-expanded","true"); }
function closeNav(){ navDrawer.classList.remove("open"); navOverlay.classList.remove("open"); hamburgerBtn.classList.remove("open"); hamburgerBtn.setAttribute("aria-expanded","false"); }
hamburgerBtn.addEventListener("click", () => navDrawer.classList.contains("open") ? closeNav() : openNav());
navOverlay.addEventListener("click", closeNav);

document.querySelectorAll(".navlink[data-target]").forEach(link => {
  link.addEventListener("click", () => {
    if(link.dataset.target === "tournaments"){ openTournamentsOverlay(); closeNav(); return; }
    if(link.dataset.target === "achievements"){ openAchievementsOverlay(); closeNav(); return; }
    const t = document.getElementById(link.dataset.target);
    if(t) t.scrollIntoView({ behavior:"smooth" });
    closeNav();
  });
});
document.querySelectorAll("[data-scrollto]").forEach(el => {
  el.addEventListener("click", () => { const t = document.getElementById(el.dataset.scrollto); if(t) t.scrollIntoView({ behavior:"smooth" }); });
});
document.getElementById("openHighlightsBtn").addEventListener("click", () => { openHighlightsOverlay(); closeNav(); });

/* --------------------------------------------------------------------- TOURNAMENTS OVERLAY
   Key design:
   - siteContent.tournaments.list is a flat array.
   - Every item has a `.game` field ("BGMI" | "EFOOTBALL" | "VALORANT").
   - The game-tab buttons filter by that field.
   - The status chips filter by `.status` on top of the game filter.
   - Admin "+ Add tournament" always stamps the currently active game tab onto the new item.
   - Delete / edit always use the item's TRUE index in the flat array, not the filtered index.
-------------------------------------------------------------------- */
const tournamentsOverlay = document.getElementById("tournamentsOverlay");
const bellBtn = document.getElementById("bellBtn");
const bellDot = document.getElementById("bellDot");
let currentTournamentGame = "BGMI";
let currentStatusFilter   = "all";

function openTournamentsOverlay(){ tournamentsOverlay.classList.remove("hidden"); document.body.style.overflow="hidden"; renderTournaments(); }
function closeTournamentsOverlay(){ tournamentsOverlay.classList.add("hidden"); document.body.style.overflow=""; }
bellBtn.addEventListener("click", openTournamentsOverlay);
document.getElementById("tournamentsBackBtn").addEventListener("click", closeTournamentsOverlay);

/* Game-tab clicks — attached once, at startup */
document.querySelectorAll(".tournament-game-btn").forEach(btn => {
  btn.addEventListener("click", e => {
    if(e.target.closest(".tournament-game-logo") && isAdminUser()) return;
    currentTournamentGame = btn.dataset.tgame;
    currentStatusFilter   = "all";   // reset status when switching game
    renderTournaments();
  });
});

/* Status-chip clicks — attached once, at startup */
document.querySelectorAll("#statusFilterRow .chip").forEach(chip => {
  chip.addEventListener("click", () => { currentStatusFilter = chip.dataset.status; renderTournaments(); });
});

function renderGameLogos(){
  const logos = (siteContent.tournaments && siteContent.tournaments.gameLogos) || {};
  ["BGMI","EFOOTBALL","VALORANT"].forEach(game => {
    const slot = document.getElementById(`logo${game}`); if(!slot) return;
    const url = logos[game] || "";
    if(url){ slot.style.backgroundImage = `url('${url}')`; slot.innerHTML = ""; }
    else {
      slot.style.backgroundImage = "";
      const label = game==="EFOOTBALL"?"EFB":game==="VALORANT"?"VAL":"BGMI";
      slot.innerHTML = `<span class="tournament-game-logo-placeholder">${label}</span>`;
    }
  });
}

/* Render one tournament card.
   `trueIndex` = position in siteContent.tournaments.list (never changes with filtering). */
function renderTournamentCard(t, trueIndex){
  const prefix = `tournaments.list.${trueIndex}`;
  const status = t.status || "upcoming";
  const statusLabel = { upcoming:"Upcoming", ongoing:"Ongoing", past:"Past" }[status] || "Upcoming";
  const link = t.registrationLink || "";

  /* Status control — admins get a <select> so status is always valid;
     fans see the plain badge only. */
  const statusControl = isAdminUser()
    ? `<select class="tournament-status-select status-${status}" data-tournament-status="${trueIndex}">
         <option value="upcoming" ${status==="upcoming"?"selected":""}>Upcoming</option>
         <option value="ongoing"  ${status==="ongoing" ?"selected":""}>Ongoing</option>
         <option value="past"     ${status==="past"    ?"selected":""}>Past</option>
       </select>`
    : `<span class="tournament-status-badge ${status}">${statusLabel}</span>`;

  let registerArea;
  if(isAdminUser()){
    registerArea = link
      ? `<a class="tournament-register-btn" href="${link}" target="_blank" rel="noopener"
            data-edit-field="${prefix}.registrationLink" data-edit-type="text"
            data-edit-label="Edit registration link">Register Now</a>`
      : `<span class="tournament-add-reglink-btn"
              data-edit-field="${prefix}.registrationLink" data-edit-type="text"
              data-edit-label="Add registration link">+ Add registration link</span>`;
  } else {
    registerArea = link ? `<a class="tournament-register-btn" href="${link}" target="_blank" rel="noopener">Register Now</a>` : "";
  }

  const deleteBtn = isAdminUser()
    ? `<button class="tournament-delete-btn" data-delete-tournament="${trueIndex}">Delete</button>`
    : "";

  const bottomRow = (registerArea || deleteBtn)
    ? `<div class="tournament-bottom-row">${deleteBtn}${registerArea}</div>` : "";

  return `
    <div class="tournament-card status-${status}" data-card-index="${trueIndex}">
      <div class="tournament-main-row">
        <div class="tournament-photo" data-edit-field="${prefix}.photoUrl" data-edit-type="photo" ${photoStyle(t.photoUrl)}>
          ${t.photoUrl ? "" : `<span class="tournament-photo-placeholder">Event photo</span>`}
        </div>
        <div class="tournament-info-col">
          <div class="tournament-top-row">
            <div>
              <div class="tournament-name" data-edit-field="${prefix}.name" data-edit-type="text">${t.name || "[Tournament name]"}</div>
              <div class="tournament-game-tag">${t.game || currentTournamentGame}</div>
            </div>
            ${statusControl}
          </div>
          <div class="tournament-date" data-edit-field="${prefix}.date" data-edit-type="text">${t.date || "[Date]"}</div>
          <div class="tournament-desc" data-edit-field="${prefix}.description" data-edit-type="textarea">${t.description || "[Description]"}</div>
        </div>
      </div>
      ${t.result || isAdminUser()
        ? `<div class="tournament-result" data-edit-field="${prefix}.result" data-edit-type="text">${t.result || "[Add result — optional]"}</div>`
        : ""}
      ${bottomRow}
    </div>`;
}

function renderTournaments(){
  if(!siteContent) return;
  renderGameLogos();

  /* sync active states */
  document.querySelectorAll(".tournament-game-btn").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.tgame === currentTournamentGame));
  document.querySelectorAll("#statusFilterRow .chip").forEach(chip =>
    chip.classList.toggle("active", chip.dataset.status === currentStatusFilter));

  const allList = (siteContent.tournaments && siteContent.tournaments.list) || [];

  /* Filter keeping true indexes intact */
  const filtered = allList
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => (t.game || "").toUpperCase() === currentTournamentGame.toUpperCase())
    .filter(({ t }) => currentStatusFilter === "all" || t.status === currentStatusFilter);

  const listEl = document.getElementById("tournamentList");
  listEl.innerHTML = filtered.length
    ? filtered.map(({ t, i }) => renderTournamentCard(t, i)).join("")
    : `<div class="empty-note">No ${currentStatusFilter !== "all" ? currentStatusFilter + " " : ""}tournaments for this game yet.</div>`;

  attachEditHandlers();

  /* Status dropdown change — saves immediately, re-renders so card class updates */
  listEl.querySelectorAll("[data-tournament-status]").forEach(select => {
    select.addEventListener("change", async () => {
      const idx = parseInt(select.dataset.tournamentStatus, 10);
      const newStatus = select.value;
      siteContent.tournaments.list[idx].status = newStatus;
      try {
        await apiRequest("/content", { method:"PUT", body: JSON.stringify(siteContent) });
        showToast("Status updated.");
        renderTournaments();
      } catch(err){ showToast(err.message || "Could not update. Try again."); }
    });
  });

  /* Delete handlers */
  listEl.querySelectorAll(".tournament-delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.deleteTournament, 10);
      if(!confirm("Delete this tournament? This can't be undone.")) return;
      siteContent.tournaments.list.splice(idx, 1);
      try {
        await apiRequest("/content", { method:"PUT", body: JSON.stringify(siteContent) });
        showToast("Tournament deleted.");
        renderTournaments();
      } catch(err){ showToast(err.message || "Could not delete. Try again."); }
    });
  });

  document.querySelectorAll('.admin-add-btn[data-add="tournament"]').forEach(btn =>
    btn.classList.toggle("hidden", !isAdminUser()));

  updateBellDot();
}

function updateBellDot(){
  const list = (siteContent && siteContent.tournaments && siteContent.tournaments.list) || [];
  bellDot.classList.toggle("hidden", !list.some(t => t.status === "ongoing"));
}

/* --------------------------------------------------------------------- ACHIEVEMENTS OVERLAY */
const achievementsOverlay = document.getElementById("achievementsOverlay");
function openAchievementsOverlay(){ achievementsOverlay.classList.remove("hidden"); document.body.style.overflow="hidden"; renderAchievements(); }
function closeAchievementsOverlay(){ achievementsOverlay.classList.add("hidden"); document.body.style.overflow=""; }
document.getElementById("achievementsBackBtn").addEventListener("click", closeAchievementsOverlay);

function renderTrophyCard(item, index){
  const prefix = `achievements.${index}`;
  const deleteBtn = isAdminUser()
    ? `<button class="person-delete-btn" data-delete-achievement="${index}" style="margin-top:10px;">Delete</button>` : "";
  return `
    <div class="trophy-card">
      <div class="trophy-photo" data-edit-field="${prefix}.photoUrl" data-edit-type="photo" ${photoStyle(item.photoUrl)}>
        ${item.photoUrl ? "" : "TROPHY"}
      </div>
      <div class="trophy-info">
        <div class="trophy-top">
          <div class="trophy-title" data-edit-field="${prefix}.title" data-edit-type="text">${item.title || "[Achievement]"}</div>
          <div class="trophy-year"  data-edit-field="${prefix}.year"  data-edit-type="text">${item.year  || "[Year]"}</div>
        </div>
        <div class="trophy-event" data-edit-field="${prefix}.event"       data-edit-type="text">${item.event       || "[Event]"}</div>
        <div class="trophy-desc"  data-edit-field="${prefix}.description" data-edit-type="textarea">${item.description || "[Description]"}</div>
        ${deleteBtn}
      </div>
    </div>`;
}

function renderAchievements(){
  const list = siteContent.achievements || [];
  document.getElementById("trophyList").innerHTML = list.length
    ? list.map((a,i) => renderTrophyCard(a,i)).join("")
    : `<div class="empty-note">No achievements yet.</div>`;
  attachEditHandlers();
  document.querySelectorAll('.admin-add-btn[data-add="achievements"]').forEach(btn =>
    btn.classList.toggle("hidden", !isAdminUser()));
  document.querySelectorAll("[data-delete-achievement]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.deleteAchievement, 10);
      if(!confirm("Delete this achievement? This can't be undone.")) return;
      siteContent.achievements.splice(idx, 1);
      try {
        await apiRequest("/content", { method:"PUT", body: JSON.stringify(siteContent) });
        showToast("Achievement deleted."); renderAchievements();
      } catch(err){ showToast(err.message || "Could not delete. Try again."); }
    });
  });
}

/* --------------------------------------------------------------------- HIGHLIGHTS OVERLAY */
const highlightsOverlay = document.getElementById("highlightsOverlay");
const expandedHighlights = new Set();
function openHighlightsOverlay(){ highlightsOverlay.classList.remove("hidden"); document.body.style.overflow="hidden"; renderHighlights(); }
function closeHighlightsOverlay(){ highlightsOverlay.classList.add("hidden"); document.body.style.overflow=""; }
document.getElementById("highlightsBackBtn").addEventListener("click", closeHighlightsOverlay);

function renderHighlightCard(item, index){
  const prefix = `highlights.${index}`;
  const isExpanded = expandedHighlights.has(index);
  const hasDesc = !!(item.description && item.description.trim());
  const deleteBtn = isAdminUser()
    ? `<button class="highlight-delete-btn" data-delete-highlight="${index}">Delete</button>` : "";
  return `
    <div class="highlight-card">
      <div class="highlight-photo" data-edit-field="${prefix}.photoUrl" data-edit-type="photo" ${photoStyle(item.photoUrl)}>
        ${item.photoUrl ? "" : "1080×1350 PHOTO"}
      </div>
      <div class="highlight-info">
        <div class="highlight-title" data-edit-field="${prefix}.title" data-edit-type="text">${item.title || "[Highlight title]"}</div>
        <div class="highlight-desc ${isExpanded?"":"collapsed"}" data-edit-field="${prefix}.description" data-edit-type="textarea">${item.description || "[Description]"}</div>
        ${hasDesc ? `<button class="highlight-readmore" data-toggle-highlight="${index}">${isExpanded?"Show less":"Read more"}</button>` : ""}
        ${deleteBtn}
      </div>
    </div>`;
}

function renderHighlights(){
  const list = siteContent.highlights || [];
  document.getElementById("highlightList").innerHTML = list.length
    ? list.map((h,i) => renderHighlightCard(h,i)).join("")
    : `<div class="empty-note">No highlights yet.</div>`;
  attachEditHandlers();
  document.querySelectorAll("[data-toggle-highlight]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.toggleHighlight, 10);
      expandedHighlights.has(idx) ? expandedHighlights.delete(idx) : expandedHighlights.add(idx);
      renderHighlights();
    });
  });
  document.querySelectorAll("[data-delete-highlight]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.deleteHighlight, 10);
      if(!confirm("Delete this highlight? This can't be undone.")) return;
      siteContent.highlights.splice(idx, 1);
      try {
        await apiRequest("/content", { method:"PUT", body: JSON.stringify(siteContent) });
        showToast("Highlight deleted."); renderHighlights();
      } catch(err){ showToast(err.message || "Could not delete. Try again."); }
    });
  });
  document.querySelectorAll('.admin-add-btn[data-add="highlight"]').forEach(btn =>
    btn.classList.toggle("hidden", !isAdminUser()));
}

/* --------------------------------------------------------------------- RENDERING HELPERS */
function initials(name){
  if(!name) return "?";
  return name.replace(/\[|\]/g,"").split(" ").filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
}
function photoStyle(url){ return url ? `style="background-image:url('${url}')"` : ""; }

function renderPersonCard(person, { editPrefix, deleteKey, size } = {}){
  const deleteBtn = deleteKey && isAdminUser()
    ? `<button class="person-delete-btn" data-delete-person="${deleteKey}">Delete</button>` : "";
  const photoClass = size ? `person-photo person-photo-${size}` : "person-photo";
  return `
    <div class="person-card" data-edit-group="${editPrefix}">
      <div class="person-top-row">
        <div class="${photoClass}" data-edit-field="${editPrefix}.photoUrl" data-edit-type="photo" ${photoStyle(person.photoUrl)}>
          ${person.photoUrl ? "" : initials(person.name)}
        </div>
        <div class="person-info">
          <div class="person-name"  data-edit-field="${editPrefix}.name"  data-edit-type="text">${person.name  || "[Name]"}</div>
          <div class="person-title" data-edit-field="${editPrefix}.title" data-edit-type="text">${person.title || "[Title]"}</div>
        </div>
      </div>
      <div class="person-bio" data-edit-field="${editPrefix}.bio" data-edit-type="textarea">${person.bio || "[Bio]"}</div>
      ${deleteBtn}
    </div>`;
}

function renderPlayerCard(player, prefix, index){
  const deleteBtn = isAdminUser()
    ? `<button class="player-delete-btn" data-delete-player="${index}">Delete</button>` : "";
  const status = player.status === "then" ? "then" : "now";
  const statusControl = isAdminUser()
    ? `<select class="player-status-select status-${status}" data-status-select="${index}">
         <option value="now"  ${status==="now"  ? "selected":""}>Now</option>
         <option value="then" ${status==="then" ? "selected":""}>Then</option>
       </select>`
    : `<span class="player-status status-${status}"><span class="status-dot"></span>${status==="now"?"Now":"Then"}</span>`;
  return `
    <div class="player-card-sq">
      <div class="player-status-badge">${statusControl}</div>
      <div class="player-top-row">
        <div class="player-photo-sq" data-edit-field="${prefix}.photoUrl" data-edit-type="photo" ${photoStyle(player.photoUrl)}>
          ${player.photoUrl ? "" : initials(player.name)}
        </div>
        <div class="player-info-sq">
          <div class="player-name-sq"    data-edit-field="${prefix}.name"     data-edit-type="text">${player.name     || "[Player name]"}</div>
          <div class="player-gamingid-sq" data-edit-field="${prefix}.gamingId" data-edit-type="text">${player.gamingId || "[Gaming ID]"}</div>
          <div class="player-role-sq"    data-edit-field="${prefix}.role"     data-edit-type="text">${player.role     || "[Role]"}</div>
        </div>
      </div>
      ${deleteBtn}
    </div>`;
}

/* Announcement card — includes delete button for admins */
function renderAnnouncementCard(item, prefix, index){
  const deleteBtn = isAdminUser()
    ? `<button class="announcement-delete-btn" data-delete-announcement="${index}">Delete</button>` : "";
  return `
    <div class="announcement-card">
      <div class="announcement-top">
        <div class="announcement-title" data-edit-field="${prefix}.title" data-edit-type="text">${item.title || "[Announcement title]"}</div>
        <div class="announcement-date"  data-edit-field="${prefix}.date"  data-edit-type="text">${item.date  || "[Date]"}</div>
      </div>
      <div class="announcement-body" data-edit-field="${prefix}.body" data-edit-type="textarea">${item.body || "[Details]"}</div>
      ${deleteBtn}
    </div>`;
}

/* --------------------------------------------------------------------- SQUADS */
function renderSquads(){
  const squad = (siteContent.squads && siteContent.squads[currentGame]) || { players:[], announcements:[] };
  const squadPrefix = `squads.${currentGame}`;

  document.querySelectorAll(".game-switch-btn").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.game === currentGame));

  const players = squad.players || [];
  document.getElementById("playerGrid").innerHTML = players.length
    ? players.map((p,i) => renderPlayerCard(p, `${squadPrefix}.players.${i}`, i)).join("")
    : `<div class="empty-note">No players added for ${currentGame} yet.</div>`;

  const announcements = squad.announcements || [];
  document.getElementById("announcementList").innerHTML = announcements.length
    ? announcements.map((a,i) => renderAnnouncementCard(a, `${squadPrefix}.announcements.${i}`, i)).join("")
    : `<div class="empty-note">No announcements for ${currentGame} yet.</div>`;

  attachEditHandlers();

  /* Player delete */
  document.querySelectorAll("[data-delete-player]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.deletePlayer, 10);
      if(!confirm("Delete this player? This can't be undone.")) return;
      siteContent.squads[currentGame].players.splice(idx, 1);
      try {
        await apiRequest("/content", { method:"PUT", body: JSON.stringify(siteContent) });
        showToast("Player deleted."); renderSquads();
      } catch(err){ showToast(err.message || "Could not delete. Try again."); }
    });
  });

  /* Announcement delete */
  document.querySelectorAll("[data-delete-announcement]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.deleteAnnouncement, 10);
      if(!confirm("Delete this announcement? This can't be undone.")) return;
      siteContent.squads[currentGame].announcements.splice(idx, 1);
      try {
        await apiRequest("/content", { method:"PUT", body: JSON.stringify(siteContent) });
        showToast("Announcement deleted."); renderSquads();
      } catch(err){ showToast(err.message || "Could not delete. Try again."); }
    });
  });

  /* Status select */
  document.querySelectorAll("[data-status-select]").forEach(select => {
    select.addEventListener("change", async () => {
      const idx = parseInt(select.dataset.statusSelect, 10);
      const newStatus = select.value === "then" ? "then" : "now";
      siteContent.squads[currentGame].players[idx].status = newStatus;
      try {
        await apiRequest("/content", { method:"PUT", body: JSON.stringify(siteContent) });
        showToast(`Marked as ${newStatus==="now"?"Now":"Then"}.`); renderSquads();
      } catch(err){ showToast(err.message || "Could not update. Try again."); }
    });
  });

  document.querySelectorAll('.admin-add-btn[data-add="player"],.admin-add-btn[data-add="announcement"]').forEach(btn =>
    btn.classList.toggle("hidden", !isAdminUser()));
}

document.querySelectorAll(".game-switch-btn").forEach(btn => {
  btn.addEventListener("click", () => { currentGame = btn.dataset.game; renderSquads(); });
});

/* --------------------------------------------------------------------- RENDER ALL */
function renderAll(){
  const c = siteContent;
  updateBellDot();

  document.querySelector('[data-edit-field="hero.tagline"]').textContent = c.hero?.tagline || "";
  document.querySelector('[data-edit-field="hero.headline"]').textContent = c.hero?.headline || "";
  document.querySelector('[data-edit-field="hero.subtext"]').textContent  = c.hero?.subtext  || "";

  const heroJersey = document.getElementById("heroJersey");
  const jerseyUrl  = c.hero?.jerseyPhotoUrl || "";
  if(jerseyUrl){ heroJersey.style.backgroundImage = `url('${jerseyUrl}')`; heroJersey.innerHTML = ""; }
  else { heroJersey.style.backgroundImage = ""; heroJersey.innerHTML = `<span class="hero-jersey-placeholder">Jersey photo</span>`; }

  const heroPhotos = (c.hero?.photos && c.hero.photos.length ? c.hero.photos : ["","",""]);
  document.getElementById("heroPhotoStack").innerHTML = [0,1,2].map(i => {
    const url = heroPhotos[i] || "";
    return `<div class="hero-stack-photo" data-edit-field="hero.photos.${i}" data-edit-type="photo" ${photoStyle(url)}>
      ${url ? "" : `<span class="hero-stack-photo-placeholder">Photo ${i+1}</span>`}
    </div>`;
  }).join("");

  document.getElementById("founderCard").innerHTML = renderPersonCard(c.founder || {}, { editPrefix:"founder", size:"founder" });
  document.getElementById("coFoundersGrid").innerHTML = (c.coFounders||[]).map((p,i) =>
    renderPersonCard(p, { editPrefix:`coFounders.${i}`, deleteKey:`coFounders.${i}`, size:"cofounder" })).join("");
  document.getElementById("teamGrid").innerHTML = (c.team||[]).map((p,i) =>
    renderPersonCard(p, { editPrefix:`team.${i}`, deleteKey:`team.${i}` })).join("");

  document.getElementById("trophyList").innerHTML = (c.achievements||[]).map((a,i) => renderTrophyCard(a,i)).join("");

  renderSquads();

  const contact = c.contact || {};
  document.getElementById("contactGrid").innerHTML = [
    rowHtml("Email",   contact.email,   "contact.email"),
    rowHtml("Phone",   contact.phone,   "contact.phone"),
    rowHtml("Address", contact.address, "contact.address")
  ].join("");

  document.getElementById("socialRow").innerHTML = [
    ["Instagram","contact.instagram"],["Twitter / X","contact.twitter"],
    ["YouTube","contact.youtube"],["Discord","contact.discord"]
  ].map(([label, field]) => {
    const url = contact[field.split(".")[1]] || "";
    if(isAdminUser()) return `<a class="social-pill" href="${url||"#"}" target="_blank" rel="noopener" data-edit-field="${field}" data-edit-type="text">${label}</a>`;
    return url ? `<a class="social-pill" href="${url}" target="_blank" rel="noopener">${label}</a>` : "";
  }).join("");

  attachEditHandlers();

  document.querySelectorAll("[data-delete-person]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const [arrayName, idxStr] = btn.dataset.deletePerson.split(".");
      const idx = parseInt(idxStr, 10);
      if(!confirm("Delete this person? This can't be undone.")) return;
      siteContent[arrayName].splice(idx, 1);
      try {
        await apiRequest("/content", { method:"PUT", body: JSON.stringify(siteContent) });
        showToast("Deleted."); renderAll();
      } catch(err){ showToast(err.message || "Could not delete. Try again."); }
    });
  });

  document.querySelectorAll(".admin-add-btn").forEach(btn =>
    btn.classList.toggle("hidden", !isAdminUser()));
}

function rowHtml(label, value, field){
  return `
    <div class="contact-row">
      <span class="contact-label">${label}</span>
      <span class="contact-value" data-edit-field="${field}" data-edit-type="text">${value || "[Add "+label.toLowerCase()+"]"}</span>
    </div>`;
}

/* --------------------------------------------------------------------- ADD BUTTONS */
const blankItemFor = {
  team:         () => ({ name:"", title:"", bio:"", photoUrl:"" }),
  coFounder:    () => ({ name:"", title:"", bio:"", photoUrl:"" }),
  achievements: () => ({ title:"", event:"", year:"", description:"", photoUrl:"" }),
  highlight:    () => ({ title:"", description:"", photoUrl:"" }),
  player:       () => ({ name:"", gamingId:"", role:"", photoUrl:"", status:"now" }),
  announcement: () => ({ title:"", body:"", date:"" }),
  /* new tournaments are tagged with the currently visible game tab AND status chip */
  tournament:   () => ({
    name:"", game: currentTournamentGame,
    status: (currentStatusFilter !== "all" ? currentStatusFilter : "upcoming"),
    date:"", description:"", result:"", photoUrl:"", registrationLink:""
  })
};

document.querySelectorAll(".admin-add-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const kind = btn.dataset.add;
    const makeBlank = blankItemFor[kind];
    if(!makeBlank) return;

    if(kind==="team")         { siteContent.team = siteContent.team||[]; siteContent.team.push(makeBlank()); }
    else if(kind==="coFounder"){ siteContent.coFounders = siteContent.coFounders||[]; siteContent.coFounders.push(makeBlank()); }
    else if(kind==="achievements"){ siteContent.achievements = siteContent.achievements||[]; siteContent.achievements.push(makeBlank()); }
    else if(kind==="highlight"){ siteContent.highlights = siteContent.highlights||[]; siteContent.highlights.push(makeBlank()); }
    else if(kind==="player"){
      siteContent.squads = siteContent.squads||{};
      siteContent.squads[currentGame] = siteContent.squads[currentGame]||{ players:[], announcements:[] };
      siteContent.squads[currentGame].players.push(makeBlank());
    } else if(kind==="announcement"){
      siteContent.squads = siteContent.squads||{};
      siteContent.squads[currentGame] = siteContent.squads[currentGame]||{ players:[], announcements:[] };
      siteContent.squads[currentGame].announcements.push(makeBlank());
    } else if(kind==="tournament"){
      siteContent.tournaments = siteContent.tournaments||{ gameLogos:{}, list:[] };
      siteContent.tournaments.list.push(makeBlank());
    }

    try {
      await apiRequest("/content", { method:"PUT", body: JSON.stringify(siteContent) });
      showToast("Added — click its fields to fill them in.");
      if(kind==="tournament")    renderTournaments();
      else if(kind==="highlight") renderHighlights();
      else if(kind==="achievements") renderAchievements();
      else renderAll();
    } catch(err){ showToast(err.message || "Could not save. Try again."); }
  });
});

/* --------------------------------------------------------------------- EDIT MODAL */
const editModalOverlay  = document.getElementById("editModalOverlay");
const editModalTitle    = document.getElementById("editModalTitle");
const editModalTextarea = document.getElementById("editModalTextarea");
const editModalCancel   = document.getElementById("editModalCancel");
const editModalSave     = document.getElementById("editModalSave");
let activeEditField = null;
let activeEditType  = null;

function attachEditHandlers(){
  if(!isAdminUser()) return;
  document.querySelectorAll("[data-edit-field]").forEach(el => {
    el.addEventListener("click", e => { e.preventDefault(); openEditModal(el); });
  });
}

function getValueByPath(obj, path){ return path.split(".").reduce((a,k) => a==null?a:a[k], obj); }
function setValueByPath(obj, path, value){
  const keys = path.split(".");
  let t = obj;
  for(let i=0;i<keys.length-1;i++){ if(t[keys[i]]==null) t[keys[i]]= {}; t=t[keys[i]]; }
  t[keys[keys.length-1]] = value;
}

function openEditModal(el){
  activeEditField = el.dataset.editField;
  activeEditType  = el.dataset.editType;
  editModalTitle.textContent = el.dataset.editLabel || (activeEditType==="photo" ? "Paste a photo URL" : `Edit: ${activeEditField}`);
  editModalTextarea.value = getValueByPath(siteContent, activeEditField) || "";
  editModalTextarea.placeholder = activeEditType==="photo" ? "https://example.com/photo.jpg" : "";
  editModalOverlay.classList.remove("hidden");
  editModalTextarea.focus();
}

editModalCancel.addEventListener("click", () => editModalOverlay.classList.add("hidden"));

editModalSave.addEventListener("click", async () => {
  setValueByPath(siteContent, activeEditField, editModalTextarea.value.trim());
  editModalOverlay.classList.add("hidden");
  try {
    await apiRequest("/content", { method:"PUT", body: JSON.stringify(siteContent) });
    showToast("Saved.");
    if(!tournamentsOverlay.classList.contains("hidden"))  renderTournaments();
    else if(!achievementsOverlay.classList.contains("hidden")) renderAchievements();
    else if(!highlightsOverlay.classList.contains("hidden"))   renderHighlights();
    else renderAll();
  } catch(err){ showToast(err.message || "Could not save. Try again."); }
});

/* --------------------------------------------------------------------- TOAST */
let toastTimer = null;
function showToast(msg){
  const toast = document.getElementById("toast");
  toast.textContent = msg; toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

/* --------------------------------------------------------------------- MANAGE ADMINS */
async function loadUserList(){
  try { renderUserList(await apiRequest("/users")); }
  catch(err){ showToast(err.message || "Could not load accounts."); }
}

function renderUserList(users){
  const listEl = document.getElementById("userList");
  if(!users.length){ listEl.innerHTML=`<div class="empty-note">No accounts yet.</div>`; return; }
  listEl.innerHTML = users.map(u => {
    const isSelf   = u.username === currentUser.username;
    const isAdmin  = u.role === "admin";
    const joined   = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "";
    const actionBtn = isAdmin
      ? `<button class="role-toggle-btn remove-admin" data-username="${u.username}" data-newrole="user" ${isSelf?`disabled title="You can't remove your own admin access"`:""}>Remove admin</button>`
      : `<button class="role-toggle-btn make-admin" data-username="${u.username}" data-newrole="admin">Make admin</button>`;
    return `
      <div class="user-row">
        <div class="user-row-info">
          <div class="user-row-name">${u.username}${isSelf?" (you)":""}</div>
          <div class="user-row-meta">Joined ${joined}</div>
        </div>
        <div class="user-row-actions">
          <span class="user-role-pill ${isAdmin?"admin":""}">${isAdmin?"Admin":"Fan"}</span>
          ${actionBtn}
        </div>
      </div>`;
  }).join("");

  listEl.querySelectorAll(".role-toggle-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const username = btn.dataset.username;
      const newRole  = btn.dataset.newrole;
      btn.disabled = true;
      try {
        await apiRequest(`/users/${encodeURIComponent(username)}/role`, { method:"PUT", body: JSON.stringify({ role: newRole }) });
        showToast(newRole==="admin" ? `${username} is now an admin.` : `${username}'s admin access removed.`);
        loadUserList();
      } catch(err){ showToast(err.message || "Could not update that account."); btn.disabled=false; }
    });
  });
}

const adminCreateForm  = document.getElementById("adminCreateForm");
const adminCreateError = document.getElementById("adminCreateError");
adminCreateForm.addEventListener("submit", async e => {
  e.preventDefault(); adminCreateError.textContent = "";
  const username = document.getElementById("newAccUsername").value.trim();
  const password = document.getElementById("newAccPassword").value;
  const isAdmin  = document.getElementById("newAccIsAdmin").checked;
  const submitBtn = adminCreateForm.querySelector(".auth-btn"); submitBtn.disabled = true;
  try {
    await apiRequest("/users", { method:"POST", body: JSON.stringify({ username, password, role: isAdmin?"admin":"user" }) });
    showToast(`Account "${username}" created.`); adminCreateForm.reset(); loadUserList();
  } catch(err){ adminCreateError.textContent = err.message || "Could not create account."; }
  finally{ submitBtn.disabled = false; }
});
