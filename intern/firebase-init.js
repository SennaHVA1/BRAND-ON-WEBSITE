/* =================================================================
   BRAND-ON — Firebase initialisatie (gedeeld)
   Initialiseert de app één keer en exporteert auth + db.
   ================================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, ALLOWED_EMAILS } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { ALLOWED_EMAILS };

/* Helper: is deze ingelogde gebruiker toegestaan? */
export function isAllowedUser(user) {
  return !!user && ALLOWED_EMAILS
    .map((e) => e.toLowerCase())
    .includes((user.email || "").toLowerCase());
}
