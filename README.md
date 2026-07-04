# Brand-On website

Statische site voor [brand-on.org](https://brand-on.org), gehost op Cloudflare Pages (free tier). Elke push naar `main` wordt automatisch gedeployed.

## Structuur

```
├── *.html              Alle pagina's staan in de root; de bestandsnaam is de URL
│                       (contact.html → brand-on.org/contact). Niet hernoemen
│                       zonder een 301 in _redirects toe te voegen.
├── _headers            Cloudflare Pages: security headers en cache-instellingen
├── _redirects          Cloudflare Pages: 301-redirects voor verwijderde/samengevoegde pagina's
├── assets/
│   ├── css/style.css       Bronbestand, hierin werken
│   ├── css/style.min.css   Geminificeerde versie die de site serveert (niet handmatig bewerken)
│   ├── fonts/              Zelf-gehoste fonts (latin subset van Google Fonts)
│   ├── img/                Afbeeldingen; steden/ voor de lokale pagina's,
│   │                       Thumbnails/ voor portfolio (met -650 varianten voor mobiel)
│   └── js/main.js          Alle JavaScript (vanilla, geen dependencies)
├── tools/minify-css.mjs    Minifier voor style.css
├── favicon.png / icon-*.png / manifest.json
├── robots.txt / sitemap.xml / llms.txt
```

## Werkwijze

**CSS aanpassen.** Werk in `assets/css/style.css`, draai daarna `node tools/minify-css.mjs` en bump de `?v=`-datum achter `style.min.css` in alle HTML-bestanden (zoek-vervang over `*.html`). Zonder die bump zien terugkerende bezoekers de oude versie, want css/js wordt 7 dagen gecachet.

**JavaScript aanpassen.** Zelfde verhaal: bump `?v=` achter `main.js` in de HTML.

**Pagina toevoegen.** Nieuw HTML-bestand in de root, daarna ook toevoegen aan `sitemap.xml` en waar relevant aan `llms.txt`.

**Pagina verwijderen of hernoemen.** Altijd een 301 toevoegen in `_redirects`, anders verlies je de opgebouwde ranking van die URL.

**Fonts.** Sora en IBM Plex Sans zijn variabele fonts (één bestand per familie dekt alle gewichten), IBM Plex Mono heeft per gewicht een bestand. De `@font-face`-regels staan bovenin `style.css`. Er zijn geen externe font-requests meer; hou dat zo, dat was een flinke LCP-winst.

**Analytics.** gtag.js laadt alleen na cookietoestemming (Consent Mode v2). De loader (`window.loadGtag`) staat inline in de head van elke pagina, de acceptatieknop zit in `main.js`.
