/* =================================================================
   BRAND-ON — Firebase configuratie
   -----------------------------------------------------------------
   EENMALIGE SETUP (ongeveer 10 minuten):

   1. Ga naar  https://console.firebase.google.com  en maak een
      nieuw project aan (bv. "brand-on-crm").

   2. Klik op het web-icoon  </>  om een Web-app toe te voegen.
      Kopieer het "firebaseConfig" object dat je krijgt en plak de
      waarden hieronder in plaats van "VERVANG_MIJ".

   3. Authentication > Sign-in method:
        - Zet "E-mailadres/Wachtwoord" op INGESCHAKELD.
        - (Aanrader) Onder "Geavanceerd": zet "Account-creatie"
          op uit/afgeschermd, zodat niemand zelf een account maakt.

   4. Authentication > Users > "Gebruiker toevoegen":
        - Maak handmatig een account voor Senna en voor Jaimy.
          (Dit zijn de enige twee logins die toegang krijgen.)

   5. Firestore Database > "Database maken" (productie-modus).
        - Ga naar tabblad "Regels" en plak de inhoud van het
          bestand  firestore.rules  (zit in deze map).
        - Zet daarin dezelfde e-mailadressen als hieronder.

   6. Vul hieronder jullie twee e-mailadressen in bij ALLOWED_EMAILS.

   LET OP: de apiKey hieronder is NIET geheim. Bij Firebase is dit
   een publieke identifier; de beveiliging komt volledig van
   Authentication + de Firestore-regels (firestore.rules).
   ================================================================= */

export const firebaseConfig = {
  apiKey: "AIzaSyDVzWNI31ZgjTiK7DcSkQCkOO1jq6cY6oA",
  authDomain: "brand-on-crm.firebaseapp.com",
  projectId: "brand-on-crm",
  storageBucket: "brand-on-crm.firebasestorage.app",
  messagingSenderId: "446647814608",
  appId: "1:446647814608:web:78efb176421dde71b751d5"
};

/* De enige e-mailadressen die mogen inloggen en de leads mogen zien.
   Zet exact dezelfde adressen ook in firestore.rules! */
export const ALLOWED_EMAILS = [
  "sennahogendoorn2005@gmail.com",
  "producedbyjaimy@gmail.com"
];
