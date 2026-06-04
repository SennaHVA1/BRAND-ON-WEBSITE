/* =================================================================
   BRAND-ON — Leadbeheer (dashboard)
   ================================================================= */
import { auth, db, isAllowedUser } from "./firebase-init.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ---------- Pipeline statussen ---------- */
const STATUSES = [
  { key: "nieuw",              label: "Onbenaderd" },
  { key: "demo_klaar",         label: "Demo website klaar" },
  { key: "benaderd",           label: "Benaderd" },
  { key: "offerte",            label: "Offerte" },
  { key: "klant",              label: "Klant" },
  { key: "verloren",           label: "Verloren" },
  { key: "nietgeinteresseerd", label: "Niet geïnteresseerd" }
];
const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.key, s.label]));

/* ---------- Team (toewijzen aan) ---------- */
const TEAM = [
  { id: "senna", name: "Senna", email: "sennahogendoorn2005@gmail.com" },
  { id: "jaimy", name: "Jaimy", email: "producedbyjaimy@gmail.com" }
];
function ownerName(id) { const m = TEAM.find((t) => t.id === id); return m ? m.name : ""; }
function nameFromEmail(email) {
  const m = TEAM.find((t) => t.email.toLowerCase() === (email || "").toLowerCase());
  return m ? m.name : (email || "Onbekend");
}
function meName() { return nameFromEmail(auth.currentUser && auth.currentUser.email); }
function myDefaultOwner() {
  const m = TEAM.find((t) => t.email.toLowerCase() === ((auth.currentUser && auth.currentUser.email) || "").toLowerCase());
  return m ? m.id : "";
}

/* ---------- Soorten acties (handmatig toe te voegen) ---------- */
const ACTION_TYPES = [
  { key: "notitie",      label: "Notitie" },
  { key: "gebeld",       label: "Gebeld" },
  { key: "bezoek",       label: "Locatie bezoek" },
  { key: "email",        label: "E-mail gestuurd" },
  { key: "afspraak",     label: "Afspraak" },
  { key: "demo_gemaakt", label: "Demo website gemaakt" }
];
/* Labels voor alle activiteitstypes (incl. automatische) */
const ACT_LABEL = {
  aangemaakt: "Aangemaakt", bewerkt: "Bijgewerkt", status: "Status gewijzigd",
  toewijzing: "Toegewezen", notitie: "Notitie", gebeld: "Gebeld",
  bezoek: "Locatie bezoek", email: "E-mail gestuurd", afspraak: "Afspraak",
  demo_gemaakt: "Demo website gemaakt"
};
/* Icoon-paths per type */
const ACT_ICON = {
  aangemaakt: '<path d="M12 5v14M5 12h14"/>',
  bewerkt:    '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  status:     '<path d="M4 4v16"/><path d="M4 5h11l-1.5 3L15 11H4"/>',
  toewijzing: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  notitie:    '<path d="M5 4h11l3 3v13H5z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  gebeld:     '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  bezoek:     '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  email:      '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 7l9 6 9-6"/>',
  afspraak:   '<rect x="3" y="4" width="18" height="17" rx="1"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  demo_gemaakt: '<rect x="2" y="3" width="20" height="14" rx="1"/><path d="M8 21h8M12 17v4"/>'
};

/* ---------- State ---------- */
let leads = [];
let activeFilter = "alles";
let searchTerm = "";
let unsubscribe = null;
let openLeadId = null;   // id van lead die in de modal bewerkt wordt
let editingActId = null; // id van activiteit die bewerkt wordt (of null)

/* ---------- Elements ---------- */
const $ = (id) => document.getElementById(id);
const appLoading = $("appLoading");
const appMain = $("appMain");
const appUser = $("appUser");
const statsEl = $("stats");
const tabsEl = $("tabs");
const leadsEl = $("leads");
const emptyState = $("emptyState");
const emptyText = $("emptyText");
const searchInput = $("searchInput");
const toast = $("toast");

const modal = $("modal");
const leadForm = $("leadForm");
const modalTitle = $("modalTitle");
const deleteLeadBtn = $("deleteLeadBtn");
const activitySection = $("activitySection");
const timelineEl = $("timeline");
const actDateEl = $("actDate");
const actCancelBtn = $("actCancel");

/* ===================================================================
   AUTH GUARD
   =================================================================== */
onAuthStateChanged(auth, (user) => {
  if (!user || !isAllowedUser(user)) {
    window.location.replace("login.html");
    return;
  }
  appUser.textContent = user.email;
  appLoading.classList.add("hide");
  appMain.hidden = false;
  startLeadsListener();
});

$("logoutBtn").addEventListener("click", async () => {
  if (unsubscribe) unsubscribe();
  await signOut(auth);
  window.location.replace("login.html");
});

/* ===================================================================
   FIRESTORE — live leads
   =================================================================== */
function startLeadsListener() {
  const q = query(collection(db, "leads"), orderBy("updatedAt", "desc"));
  unsubscribe = onSnapshot(q, (snap) => {
    leads = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  }, (err) => {
    console.error(err);
    showToast("Kon leads niet laden — check de Firestore-regels.", true);
  });
}

/* ===================================================================
   RENDER
   =================================================================== */
function render() {
  renderStats();
  renderTabs();
  renderLeads();
  // Tijdlijn live bijwerken als de modal openstaat
  if (openLeadId) {
    const lead = leads.find((l) => l.id === openLeadId);
    if (lead) renderTimeline(lead);
  }
}

function renderStats() {
  const cards = [{ label: "Totaal leads", value: leads.length }]
    .concat(STATUSES.map((s) => ({
      label: s.label,
      value: leads.filter((l) => l.status === s.key).length
    })));
  statsEl.innerHTML = cards.map((c) => `
    <div class="stat">
      <div class="stat-val">${c.value}</div>
      <div class="stat-lbl">${c.label}</div>
    </div>`).join("");
}

function renderTabs() {
  const all = [{ key: "alles", label: "Alles", count: leads.length }]
    .concat(STATUSES.map((s) => ({
      key: s.key, label: s.label,
      count: leads.filter((l) => l.status === s.key).length
    })));
  tabsEl.innerHTML = all.map((t) => `
    <button class="tab ${activeFilter === t.key ? "active" : ""}" data-tab="${t.key}" role="tab">
      ${t.label}<span class="tab-count">${t.count}</span>
    </button>`).join("");
}

function filteredLeads() {
  const term = searchTerm.toLowerCase().trim();
  return leads.filter((l) => {
    if (activeFilter !== "alles" && l.status !== activeFilter) return false;
    if (!term) return true;
    return [l.company, l.contactName, l.email, l.phone, l.website, l.notes, ownerName(l.owner)]
      .filter(Boolean).join(" ").toLowerCase().includes(term);
  });
}

function renderLeads() {
  const list = filteredLeads();
  if (!list.length) {
    leadsEl.innerHTML = "";
    emptyState.hidden = false;
    emptyText.textContent = leads.length
      ? "Geen leads gevonden voor deze filter of zoekopdracht."
      : "Nog geen leads. Voeg je eerste lead toe.";
    return;
  }
  emptyState.hidden = true;
  leadsEl.innerHTML = list.map(leadCard).join("");
}

function lastActivity(l) {
  if (Array.isArray(l.activities) && l.activities.length) {
    return l.activities.reduce((a, b) => (b.at > a.at ? b : a));
  }
  return null;
}

function leadCard(l) {
  const status = l.status || "nieuw";
  const contact = [
    contactRow("email", "E-mail", l.email, "mailto:" + (l.email || "")),
    contactRow("phone", "Telefoon", l.phone, "tel:" + ((l.phone || "").replace(/\s/g, ""))),
    contactRow("website", "Website", l.website, websiteHref(l.website))
  ].filter(Boolean).join("");

  const owner = l.owner
    ? `<span class="owner-chip is-${l.owner}"><span class="who-dot"></span>${esc(ownerName(l.owner))}</span>`
    : `<span class="owner-chip is-none"><span class="who-dot"></span>Niet toegewezen</span>`;
  const la = lastActivity(l);
  const footMeta = la
    ? `${ACT_LABEL[la.type] || "Activiteit"} · ${esc(la.by || "")} · ${fmtDateTime(la.at)}`
    : (l.updatedAt ? "Bijgewerkt · " + fmtDateTime(l.updatedAt) : "");

  return `
  <article class="lead-card" data-id="${l.id}">
    <div class="lead-top">
      <div>
        <h3 class="lead-company">${esc(l.company || "Naamloos")}</h3>
        ${l.contactName ? `<div class="lead-contact">${esc(l.contactName)}</div>` : ""}
      </div>
      <select class="badge badge--${status}" data-status-select aria-label="Status wijzigen">
        ${STATUSES.map((s) => `<option value="${s.key}" ${s.key === status ? "selected" : ""}>${s.label}</option>`).join("")}
      </select>
    </div>

    <div class="lead-meta-row">${owner}</div>

    <div class="lead-contacts">${contact || `<div class="lead-empty-row">Geen contactgegevens</div>`}</div>

    ${l.notes ? `<p class="lead-notes">${esc(l.notes)}</p>` : ""}

    <div class="lead-foot">
      <span class="lead-foot-meta">${footMeta}</span>
      <button class="text-btn" data-edit aria-label="Openen">Openen</button>
    </div>
  </article>`;
}

function contactRow(type, label, value, href) {
  if (!value) return "";
  const icons = {
    email: '<path d="M3 7l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="1"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/>'
  };
  const display = type === "website" ? cleanWebsite(value) : value;
  return `
    <div class="c-row">
      <svg class="c-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[type]}</svg>
      <a class="c-value" href="${esc(href)}" ${type === "website" ? 'target="_blank" rel="noopener"' : ""}>${esc(display)}</a>
      <button class="copy-btn" data-copy="${esc(value)}" title="Kopieer ${label.toLowerCase()}" aria-label="Kopieer ${label.toLowerCase()}">
        <svg class="ic-copy" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="1.5"/><path d="M5 15V4a1 1 0 0 1 1-1h11"/></svg>
        <svg class="ic-check" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6.5"/></svg>
      </button>
    </div>`;
}

/* ---------- Tijdlijn (in de modal) ---------- */
function renderTimeline(lead) {
  const acts = Array.isArray(lead.activities) ? lead.activities.slice() : [];
  acts.sort((a, b) => (b.at || 0) - (a.at || 0)); // nieuwste bovenaan
  if (!acts.length) {
    timelineEl.innerHTML = `<li class="tl-empty">Nog geen activiteiten.</li>`;
    return;
  }
  timelineEl.innerHTML = acts.map((a) => `
    <li class="tl-item ${editingActId === a.id ? "is-editing" : ""}" data-act-id="${esc(a.id)}">
      <span class="tl-dot" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ACT_ICON[a.type] || ACT_ICON.notitie}</svg>
      </span>
      <div class="tl-body">
        <span class="tl-type">${esc(ACT_LABEL[a.type] || "Activiteit")}</span>
        ${a.text ? `<div class="tl-text">${esc(a.text)}</div>` : ""}
        <div class="tl-meta">${esc(a.by || "")} · ${fmtDateTime(a.at)}</div>
      </div>
      <div class="tl-actions">
        <button type="button" data-act-edit title="Bewerk" aria-label="Activiteit bewerken">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button type="button" class="del" data-act-del title="Verwijder" aria-label="Activiteit verwijderen">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13"/></svg>
        </button>
      </div>
    </li>`).join("");
}

/* ===================================================================
   EVENTS — tabs, search, card actions (delegation)
   =================================================================== */
tabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tab]");
  if (!btn) return;
  activeFilter = btn.dataset.tab;
  renderTabs();
  renderLeads();
});

searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderLeads();
});

leadsEl.addEventListener("click", (e) => {
  const copyBtn = e.target.closest("[data-copy]");
  if (copyBtn) { copyValue(copyBtn); return; }

  const editBtn = e.target.closest("[data-edit]");
  if (editBtn) {
    const id = editBtn.closest(".lead-card").dataset.id;
    openModal(leads.find((l) => l.id === id));
  }
});

leadsEl.addEventListener("change", async (e) => {
  const sel = e.target.closest("[data-status-select]");
  if (!sel) return;
  const id = sel.closest(".lead-card").dataset.id;
  const lead = leads.find((l) => l.id === id);
  const oldStatus = lead ? lead.status : "";
  try {
    await updateDoc(doc(db, "leads", id), {
      status: sel.value,
      updatedAt: serverTimestamp(),
      activities: arrayUnion(mkActivity("status", `${STATUS_LABEL[oldStatus] || oldStatus || "?"} → ${STATUS_LABEL[sel.value]}`))
    });
    showToast("Status bijgewerkt.");
  } catch (err) {
    console.error(err);
    showToast("Bijwerken mislukt.", true);
  }
});

/* ===================================================================
   COPY met fallback
   =================================================================== */
async function copyValue(btn) {
  const text = btn.dataset.copy;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    btn.classList.add("copied");
    setTimeout(() => btn.classList.remove("copied"), 1200);
    showToast("Gekopieerd: " + text);
  } catch (err) {
    showToast("Kopiëren mislukt.", true);
  }
}

/* ===================================================================
   MODAL — toevoegen / bewerken
   =================================================================== */
(function buildSelects() {
  $("f-status").innerHTML = STATUSES.map((s) => `<option value="${s.key}">${s.label}</option>`).join("");
  $("f-owner").innerHTML = `<option value="">Niet toegewezen</option>` +
    TEAM.map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
  $("actType").innerHTML = ACTION_TYPES.map((a) => `<option value="${a.key}">${a.label}</option>`).join("");
})();

function openModal(lead) {
  const editing = !!lead;
  openLeadId = editing ? lead.id : null;
  modalTitle.textContent = editing ? (lead.company || "Lead bewerken") : "Nieuwe lead";
  $("leadId").value = editing ? lead.id : "";
  $("f-company").value = editing ? (lead.company || "") : "";
  $("f-contact").value = editing ? (lead.contactName || "") : "";
  $("f-email").value = editing ? (lead.email || "") : "";
  $("f-phone").value = editing ? (lead.phone || "") : "";
  $("f-website").value = editing ? (lead.website || "") : "";
  $("f-notes").value = editing ? (lead.notes || "") : "";
  $("f-status").value = editing ? (lead.status || "nieuw") : "nieuw";
  $("f-owner").value = editing ? (lead.owner || "") : myDefaultOwner();
  deleteLeadBtn.hidden = !editing;

  // Activiteiten alleen bij bestaande lead
  activitySection.hidden = !editing;
  if (editing) { resetActionBar(); renderTimeline(lead); }

  modal.hidden = false;
  document.body.classList.add("modal-lock");
  setTimeout(() => $("f-company").focus(), 50);
}

function closeModal() {
  modal.hidden = true;
  openLeadId = null;
  document.body.classList.remove("modal-lock");
  leadForm.reset();
}

$("newLeadBtn").addEventListener("click", () => openModal(null));
modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

leadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("leadId").value;
  const fields = {
    company: $("f-company").value.trim(),
    contactName: $("f-contact").value.trim(),
    email: $("f-email").value.trim(),
    phone: $("f-phone").value.trim(),
    website: $("f-website").value.trim(),
    notes: $("f-notes").value.trim(),
    status: $("f-status").value,
    owner: $("f-owner").value
  };
  if (!fields.company) { showToast("Vul minstens een bedrijfsnaam in.", true); return; }

  const saveBtn = $("saveLeadBtn");
  saveBtn.disabled = true;
  try {
    if (id) {
      const old = leads.find((l) => l.id === id) || {};
      const acts = changeActivities(old, fields);
      const payload = { ...fields, updatedAt: serverTimestamp() };
      if (acts.length) payload.activities = arrayUnion(...acts);
      await updateDoc(doc(db, "leads", id), payload);
      showToast("Opgeslagen.");
    } else {
      await addDoc(collection(db, "leads"), {
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: meName(),
        activities: [mkActivity("aangemaakt", "Lead aangemaakt")]
      });
      showToast("Lead toegevoegd.");
    }
    closeModal();
  } catch (err) {
    console.error(err);
    showToast("Opslaan mislukt.", true);
  } finally {
    saveBtn.disabled = false;
  }
});

/* Bepaalt welke activiteiten een wijziging oplevert. */
function changeActivities(oldL, neu) {
  const acts = [];
  if ((oldL.status || "") !== neu.status) {
    acts.push(mkActivity("status", `${STATUS_LABEL[oldL.status] || oldL.status || "?"} → ${STATUS_LABEL[neu.status]}`));
  }
  if ((oldL.owner || "") !== neu.owner) {
    acts.push(mkActivity("toewijzing", neu.owner ? `Toegewezen aan ${ownerName(neu.owner)}` : "Toewijzing verwijderd"));
  }
  const fieldMap = { company: "bedrijfsnaam", contactName: "contactpersoon", email: "e-mail", phone: "telefoon", website: "website", notes: "notitie" };
  const changed = Object.keys(fieldMap).filter((k) => (oldL[k] || "") !== (neu[k] || ""));
  if (changed.length) {
    acts.push(mkActivity("bewerkt", "Gewijzigd: " + changed.map((k) => fieldMap[k]).join(", ")));
  }
  return acts;
}

deleteLeadBtn.addEventListener("click", async () => {
  const id = $("leadId").value;
  if (!id) return;
  const lead = leads.find((l) => l.id === id);
  if (!confirm(`Lead "${lead ? lead.company : ""}" definitief verwijderen?`)) return;
  try {
    await deleteDoc(doc(db, "leads", id));
    showToast("Lead verwijderd.");
    closeModal();
  } catch (err) {
    console.error(err);
    showToast("Verwijderen mislukt.", true);
  }
});

/* ---------- Activiteiten: toevoegen / bewerken / verwijderen ---------- */
function resetActionBar() {
  editingActId = null;
  $("actType").value = ACTION_TYPES[0].key;
  $("actText").value = "";
  actDateEl.value = toLocalInput(Date.now());
  $("actAdd").querySelector("span").textContent = "Toevoegen";
  actCancelBtn.hidden = true;
}

function startEditActivity(actId) {
  const lead = leads.find((l) => l.id === openLeadId);
  if (!lead) return;
  const a = (lead.activities || []).find((x) => x.id === actId);
  if (!a) return;
  editingActId = actId;
  $("actType").value = a.type;
  $("actText").value = a.text || "";
  actDateEl.value = toLocalInput(a.at);
  $("actAdd").querySelector("span").textContent = "Bijwerken";
  actCancelBtn.hidden = false;
  renderTimeline(lead);
  $("actText").focus();
}

async function deleteActivity(actId) {
  const lead = leads.find((l) => l.id === openLeadId);
  if (!lead) return;
  if (!confirm("Deze activiteit verwijderen?")) return;
  const next = (lead.activities || []).filter((x) => x.id !== actId);
  try {
    await updateDoc(doc(db, "leads", openLeadId), { activities: next, updatedAt: serverTimestamp() });
    if (editingActId === actId) resetActionBar();
    showToast("Activiteit verwijderd.");
  } catch (err) {
    console.error(err);
    showToast("Verwijderen mislukt.", true);
  }
}

$("actAdd").addEventListener("click", async () => {
  const id = openLeadId;
  if (!id) return;
  const lead = leads.find((l) => l.id === id) || {};
  const type = $("actType").value;
  const text = $("actText").value.trim();
  const at = fromLocalInput(actDateEl.value);
  const btn = $("actAdd");
  btn.disabled = true;
  try {
    if (editingActId) {
      const next = (lead.activities || []).map((x) => x.id === editingActId ? { ...x, type, text, at } : x);
      await updateDoc(doc(db, "leads", id), { activities: next, updatedAt: serverTimestamp() });
      showToast("Activiteit bijgewerkt.");
      resetActionBar();
    } else {
      await updateDoc(doc(db, "leads", id), {
        updatedAt: serverTimestamp(),
        activities: arrayUnion(mkActivity(type, text, at))
      });
      showToast("Activiteit toegevoegd.");
      $("actText").value = "";
      actDateEl.value = toLocalInput(Date.now());
    }
  } catch (err) {
    console.error(err);
    showToast(editingActId ? "Bijwerken mislukt." : "Toevoegen mislukt.", true);
  } finally {
    btn.disabled = false;
  }
});
actCancelBtn.addEventListener("click", resetActionBar);
$("actText").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("actAdd").click(); } });

/* Bewerken / verwijderen via de tijdlijn */
timelineEl.addEventListener("click", (e) => {
  const item = e.target.closest("[data-act-id]");
  if (!item) return;
  const actId = item.dataset.actId;
  if (e.target.closest("[data-act-del]")) deleteActivity(actId);
  else if (e.target.closest("[data-act-edit]")) startEditActivity(actId);
});

/* ===================================================================
   HELPERS
   =================================================================== */
function mkActivity(type, text, at) {
  return { id: uid(), type, text: text || "", by: meName(), at: at || Date.now() };
}
function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || (Date.now() + "-" + Math.random().toString(16).slice(2));
}
function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function cleanWebsite(url) { return String(url).replace(/^https?:\/\//i, "").replace(/\/$/, ""); }
function websiteHref(url) {
  if (!url) return "#";
  return /^https?:\/\//i.test(url) ? url : "https://" + url;
}
function fmtDateTime(val) {
  let d;
  if (typeof val === "number") d = new Date(val);
  else if (val && val.toDate) d = val.toDate();
  else return "";
  try {
    return d.toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}
/* Omzetten tussen ms en de waarde van <input type="datetime-local"> (lokale tijd). */
function toLocalInput(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(str) {
  const t = new Date(str).getTime();
  return isNaN(t) ? Date.now() : t;
}

let toastTimer = null;
function showToast(msg, isError) {
  toast.textContent = msg;
  toast.classList.toggle("error", !!isError);
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}
