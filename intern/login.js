/* =================================================================
   BRAND-ON — Login logica
   ================================================================= */
import { auth, isAllowedUser } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const form = document.getElementById("loginForm");
const errorBox = document.getElementById("loginError");
const btn = document.getElementById("loginBtn");
const btnText = document.getElementById("loginBtnText");

/* Al ingelogd? Stuur direct door naar het dashboard. */
onAuthStateChanged(auth, (user) => {
  if (user && isAllowedUser(user)) {
    window.location.replace("dashboard.html");
  }
});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add("show");
}
function clearError() {
  errorBox.textContent = "";
  errorBox.classList.remove("show");
}
function setLoading(on) {
  btn.disabled = on;
  btnText.textContent = on ? "Bezig met inloggen…" : "Inloggen";
}

/* ---------- Bescherming tegen brute-force: max. inlogpogingen ----------
   Na MAX_ATTEMPTS mislukte pogingen wordt het formulier LOCK_MS vergrendeld.
   Dit is een UX-laag bovenop Firebase's eigen 'too-many-requests'. */
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000; // 5 minuten
const LS_KEY = "brandon_login_lock";
let lockTimer = null;

function readLock() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || { count: 0, until: 0 }; }
  catch { return { count: 0, until: 0 }; }
}
function writeLock(v) { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch {} }
function clearLock() { try { localStorage.removeItem(LS_KEY); } catch {} clearInterval(lockTimer); }
function attemptsLeft() { return Math.max(0, MAX_ATTEMPTS - (readLock().count || 0)); }

function recordFailure() {
  const data = readLock();
  data.count = (data.count || 0) + 1;
  if (data.count >= MAX_ATTEMPTS) { data.until = Date.now() + LOCK_MS; data.count = 0; }
  writeLock(data);
}

function isCredentialError(err) {
  const c = (err && err.code) || "";
  return c === "auth/invalid-credential" || c === "auth/wrong-password"
      || c === "auth/user-not-found" || c === "auth/invalid-email";
}

/* Toont/handhaaft de vergrendeling. Retourneert true als (nog) vergrendeld. */
function enforceLock() {
  const rem = readLock().until - Date.now();
  if (rem <= 0) {
    clearInterval(lockTimer);
    btn.disabled = false;
    btnText.textContent = "Inloggen";
    return false;
  }
  btn.disabled = true;
  const mins = Math.floor(rem / 60000);
  const secs = Math.ceil((rem % 60000) / 1000);
  showError(`Te veel mislukte pogingen. Probeer het over ${mins}:${String(secs).padStart(2, "0")} opnieuw.`);
  clearInterval(lockTimer);
  lockTimer = setInterval(enforceLock, 1000);
  return true;
}

// Bij laden meteen controleren of er nog een vergrendeling actief is.
enforceLock();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (enforceLock()) return;          // geblokkeerd door te veel pogingen
  clearError();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showError("Vul je e-mailadres en wachtwoord in.");
    return;
  }

  setLoading(true);
  try {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await signInWithEmailAndPassword(auth, email, password);

    // Extra controle: alleen toegestane accounts mogen door.
    if (!isAllowedUser(cred.user)) {
      await signOut(auth);
      showError("Dit account heeft geen toegang tot het leadbeheer.");
      setLoading(false);
      return;
    }
    clearLock();
    window.location.replace("dashboard.html");
  } catch (err) {
    setLoading(false);
    if (isCredentialError(err)) {
      recordFailure();
      if (enforceLock()) return;       // zojuist vergrendeld geraakt
      const left = attemptsLeft();
      showError(`${friendlyError(err)} Nog ${left} poging${left === 1 ? "" : "en"} over.`);
    } else {
      showError(friendlyError(err));
    }
  }
});

function friendlyError(err) {
  const code = (err && err.code) || "";
  switch (code) {
    case "auth/invalid-email":
      return "Dat is geen geldig e-mailadres.";
    case "auth/user-disabled":
      return "Dit account is uitgeschakeld.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "E-mailadres of wachtwoord klopt niet.";
    case "auth/too-many-requests":
      return "Te veel pogingen. Probeer het later opnieuw.";
    case "auth/network-request-failed":
      return "Geen verbinding. Controleer je internet.";
    case "auth/configuration-not-found":
    case "auth/invalid-api-key":
      return "Firebase is nog niet ingesteld (zie firebase-config.js).";
    default:
      return "Inloggen mislukt. Probeer het opnieuw.";
  }
}
