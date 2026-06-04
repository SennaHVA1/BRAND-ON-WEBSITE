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

form.addEventListener("submit", async (e) => {
  e.preventDefault();
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
    window.location.replace("dashboard.html");
  } catch (err) {
    setLoading(false);
    showError(friendlyError(err));
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
