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
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ---------- Pipeline statussen ---------- */
const STATUSES = [
  { key: "nieuw",     label: "Nieuw" },
  { key: "benaderd",  label: "Benaderd" },
  { key: "offerte",   label: "Offerte" },
  { key: "klant",     label: "Klant" },
  { key: "verloren",  label: "Verloren" }
];
const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.key, s.label]));

/* ---------- State ---------- */
let leads = [];
let activeFilter = "alles";
let searchTerm = "";
let unsubscribe = null;

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
}

function renderStats() {
  const counts = { totaal: leads.length };
  STATUSES.forEach((s) => { counts[s.key] = leads.filter((l) => l.status === s.key).length; });
  // Pijplijn-waarde = alles wat nog open staat (niet klant/verloren)
  const pipeline = leads
    .filter((l) => l.status !== "klant" && l.status !== "verloren")
    .reduce((sum, l) => sum + (Number(l.value) || 0), 0);
  const klantWaarde = leads
    .filter((l) => l.status === "klant")
    .reduce((sum, l) => sum + (Number(l.value) || 0), 0);

  const cards = [
    { label: "Totaal leads", value: counts.totaal },
    { label: "Open pijplijn", value: euro(pipeline) },
    { label: "Klanten", value: counts.klant },
    { label: "Omzet uit klanten", value: euro(klantWaarde) }
  ];
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
    return [l.company, l.contactName, l.email, l.phone, l.website, l.notes]
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

function leadCard(l) {
  const status = l.status || "nieuw";
  const contact = [
    contactRow("email", "E-mail", l.email, "mailto:" + (l.email || "")),
    contactRow("phone", "Telefoon", l.phone, "tel:" + ((l.phone || "").replace(/\s/g, ""))),
    contactRow("website", "Website", l.website, websiteHref(l.website))
  ].filter(Boolean).join("");

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

    <div class="lead-contacts">${contact || `<div class="lead-empty-row">Geen contactgegevens</div>`}</div>

    ${l.notes ? `<p class="lead-notes">${esc(l.notes)}</p>` : ""}

    <div class="lead-foot">
      <span class="lead-value">${(Number(l.value) > 0) ? euro(Number(l.value)) : "—"}</span>
      <div class="lead-foot-right">
        <span class="lead-date">${fmtDate(l.updatedAt)}</span>
        <button class="text-btn" data-edit aria-label="Bewerken">Bewerk</button>
      </div>
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
  try {
    await updateDoc(doc(db, "leads", id), { status: sel.value, updatedAt: serverTimestamp() });
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
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
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
function buildStatusSelect() {
  const sel = $("f-status");
  sel.innerHTML = STATUSES.map((s) => `<option value="${s.key}">${s.label}</option>`).join("");
}
buildStatusSelect();

function openModal(lead) {
  const editing = !!lead;
  modalTitle.textContent = editing ? "Lead bewerken" : "Nieuwe lead";
  $("leadId").value = editing ? lead.id : "";
  $("f-company").value = editing ? (lead.company || "") : "";
  $("f-contact").value = editing ? (lead.contactName || "") : "";
  $("f-email").value = editing ? (lead.email || "") : "";
  $("f-phone").value = editing ? (lead.phone || "") : "";
  $("f-website").value = editing ? (lead.website || "") : "";
  $("f-value").value = editing && lead.value ? lead.value : "";
  $("f-notes").value = editing ? (lead.notes || "") : "";
  $("f-status").value = editing ? (lead.status || "nieuw") : "nieuw";
  deleteLeadBtn.hidden = !editing;

  modal.hidden = false;
  document.body.classList.add("modal-lock");
  setTimeout(() => $("f-company").focus(), 50);
}

function closeModal() {
  modal.hidden = true;
  document.body.classList.remove("modal-lock");
  leadForm.reset();
}

$("newLeadBtn").addEventListener("click", () => openModal(null));
modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

leadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("leadId").value;
  const data = {
    company: $("f-company").value.trim(),
    contactName: $("f-contact").value.trim(),
    email: $("f-email").value.trim(),
    phone: $("f-phone").value.trim(),
    website: $("f-website").value.trim(),
    value: Number($("f-value").value) || 0,
    notes: $("f-notes").value.trim(),
    status: $("f-status").value,
    updatedAt: serverTimestamp()
  };
  if (!data.company) { showToast("Vul minstens een bedrijfsnaam in.", true); return; }

  const saveBtn = $("saveLeadBtn");
  saveBtn.disabled = true;
  try {
    if (id) {
      await updateDoc(doc(db, "leads", id), data);
      showToast("Lead bijgewerkt.");
    } else {
      data.createdAt = serverTimestamp();
      data.createdBy = auth.currentUser ? auth.currentUser.email : "";
      await addDoc(collection(db, "leads"), data);
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

/* ===================================================================
   HELPERS
   =================================================================== */
function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function euro(n) { return "€" + (Number(n) || 0).toLocaleString("nl-NL"); }
function cleanWebsite(url) { return String(url).replace(/^https?:\/\//i, "").replace(/\/$/, ""); }
function websiteHref(url) {
  if (!url) return "#";
  return /^https?:\/\//i.test(url) ? url : "https://" + url;
}
function fmtDate(ts) {
  if (!ts || !ts.toDate) return "";
  try {
    return ts.toDate().toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}

let toastTimer = null;
function showToast(msg, isError) {
  toast.textContent = msg;
  toast.classList.toggle("error", !!isError);
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}
