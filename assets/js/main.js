/* =================================================================
   BRAND-ON — main.js  (vanilla, no dependencies)
   ================================================================= */
(function () {
  'use strict';

  /* ---------- Header: scrolled state + mobile menu ---------- */
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  const onScroll = () => {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 40);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const closeMenu = () => {
    document.body.classList.remove('menu-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  };

  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      const open = document.body.classList.toggle('menu-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    navLinks.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  }

  /* ---------- Active nav link per page ---------- */
  (function highlightNav() {
    const norm = (p) => {
      p = p.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/+$/, '$1');
      return p === '' ? '/' : p;
    };
    const path = norm(window.location.pathname);
    document.querySelectorAll('.nav-links a').forEach((a) => {
      if (norm(a.getAttribute('href')) === path) a.classList.add('active');
    });
  })();

  /* ---------- Scroll reveal (IntersectionObserver) ---------- */
  (function reveal() {
    const items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach((el) => io.observe(el));
  })();

  /* ---------- Smooth scroll for in-page anchors ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  /* ---------- Project filter (projecten.html) ---------- */
  (function projectFilter() {
    const bar = document.querySelector('[data-filterbar]');
    if (!bar) return;
    const cards = document.querySelectorAll('[data-project]');
    bar.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        bar.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        cards.forEach((card) => {
          const tags = (card.dataset.tags || '').split(',');
          const show = filter === 'all' || tags.includes(filter);
          card.classList.toggle('is-hidden', !show);
        });
      });
    });
  })();

  /* ---------- Price calculator ---------- */
  (function calculators() {
    const euro = (n) => '€' + n.toLocaleString('nl-NL');

    document.querySelectorAll('[data-calc]').forEach((root) => {
      const pkgInputs = root.querySelectorAll('input[name="pkg"]');
      const pageStepper = root.querySelector('[data-stepper]');
      const addonInputs = root.querySelectorAll('[data-addon]');
      const photoAddon = root.querySelector('[data-addon="photo"]');
      const linesEl = root.querySelector('[data-sum-lines]');
      const totalEl = root.querySelector('[data-total]');

      const PKG = { starter: 750, pro: 1500 };
      const PKG_LABEL = { starter: 'Starter', pro: 'Professioneel' };
      const PKG_PAGES = { starter: 5, pro: 10 };
      const PAGE_PRICE = 75;
      const ADDON_PRICE = { logo: 250, photo: 300, multilang: 200 };
      const ADDON_LABEL = { logo: "Logo & huisstijl", photo: 'Fotografie', multilang: 'Meertalige website' };
      const pagesIncludedEl = root.querySelector('[data-pages-included]');

      let pages = 0;

      // Laatst berekende samenstelling, gedeeld met "Verwerk in mijn bericht"
      let currentLines = [];
      let currentTotal = PKG.starter;
      let currentPkg = 'starter';

      const stepperVal = pageStepper ? pageStepper.querySelector('.val') : null;

      const getPkg = () => {
        const checked = root.querySelector('input[name="pkg"]:checked');
        return checked ? checked.value : 'starter';
      };

      function render() {
        const pkg = getPkg();
        const included = PKG_PAGES[pkg];
        const lines = [];
        let total = PKG[pkg];
        lines.push({ label: 'Pakket — ' + PKG_LABEL[pkg] + ' (' + included + " pagina's)", value: euro(PKG[pkg]) });
        if (pagesIncludedEl) pagesIncludedEl.textContent = '(' + included + ' al inbegrepen)';

        // photography is included in Professioneel
        const photoIncluded = pkg === 'pro';
        if (photoAddon) {
          const row = photoAddon.closest('.addon');
          if (row) {
            row.classList.toggle('is-included', photoIncluded);
            const priceTag = row.querySelector('.a-price');
            if (priceTag) priceTag.textContent = photoIncluded ? 'inbegrepen' : '+€300';
            if (photoIncluded) { photoAddon.checked = false; photoAddon.disabled = true; }
            else { photoAddon.disabled = false; }
          }
        }

        if (pages > 0) {
          const sub = pages * PAGE_PRICE;
          total += sub;
          lines.push({ label: pages + ' extra pagina' + (pages > 1 ? "'s" : '') + ' (bovenop ' + included + ')', value: euro(sub) });
        }

        addonInputs.forEach((inp) => {
          if (inp.checked && !inp.disabled) {
            const key = inp.dataset.addon;
            total += ADDON_PRICE[key];
            lines.push({ label: ADDON_LABEL[key], value: euro(ADDON_PRICE[key]) });
          }
        });

        if (photoIncluded) {
          lines.push({ label: 'Fotografie (inbegrepen)', value: '€0', muted: true });
        }

        if (linesEl) {
          linesEl.innerHTML = lines.map((l) =>
            `<div class="row"><span>${l.label}</span><span class="v">${l.value}</span></div>`
          ).join('');
        }
        if (totalEl) totalEl.textContent = euro(total);

        currentLines = lines;
        currentTotal = total;
        currentPkg = pkg;
      }

      pkgInputs.forEach((i) => i.addEventListener('change', render));
      addonInputs.forEach((i) => i.addEventListener('change', render));

      /* "Verwerk in mijn bericht": samenstelling in het contactformulier zetten */
      const fillBtn = root.querySelector('[data-fill-message]');
      if (fillBtn) {
        let lastBlock = '';
        fillBtn.addEventListener('click', (e) => {
          const form = document.querySelector('[data-contact-form]');
          if (!form) return; // geen formulier op deze pagina → laat anchor gewoon scrollen

          const textarea = form.querySelector('textarea[name="bericht"]');
          const select = form.querySelector('select[name="pakket"]');

          const blockLines = currentLines
            .map((l) => '• ' + l.label + ': ' + l.value)
            .join('\n');
          const block =
            'Mijn samenstelling via de prijscalculator:\n' +
            blockLines +
            '\n\nGeschat totaal: ' + euro(currentTotal) + ' (excl. BTW, indicatie)';

          if (select) {
            const map = { starter: 'starter', pro: 'professioneel' };
            const opt = map[currentPkg];
            if (opt) select.value = opt;
          }

          if (textarea) {
            let val = textarea.value;
            if (lastBlock && val.indexOf(lastBlock) !== -1) {
              val = val.replace(lastBlock, block); // eerdere samenstelling bijwerken
            } else {
              val = block + (val.trim() ? '\n\n' + val : '\n\n');
            }
            textarea.value = val;
            lastBlock = block;
          }

          // scrollen + focus naar het formulier
          e.preventDefault();
          const target = document.querySelector('#naam');
          if (target) {
            const top = target.getBoundingClientRect().top + window.scrollY - 70;
            window.scrollTo({ top, behavior: 'smooth' });
            try { target.focus({ preventScroll: true }); } catch (err) {}
          }
        });
      }

      if (pageStepper && stepperVal) {
        pageStepper.querySelector('[data-step="-"]').addEventListener('click', () => {
          pages = Math.max(0, pages - 1); stepperVal.textContent = pages; render();
        });
        pageStepper.querySelector('[data-step="+"]').addEventListener('click', () => {
          pages = Math.min(20, pages + 1); stepperVal.textContent = pages; render();
        });
      }

      render();
    });
  })();

  /* ---------- Contact form (Web3Forms) ---------- */
  (function contactForm() {
    const form = document.querySelector('[data-contact-form]');
    if (!form) return;
    const success = form.querySelector('[data-success]');
    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn ? submitBtn.querySelector('span') : null;
    const defaultLabel = btnText ? btnText.textContent : '';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;

      if (submitBtn) submitBtn.disabled = true;
      if (btnText) btnText.textContent = 'Versturen…';

      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Versturen mislukt');

        if (success) success.classList.add('show');
        form.querySelectorAll('input, textarea, select').forEach((el) => el.setAttribute('disabled', 'true'));
        if (btnText) btnText.textContent = 'Verzonden';
      } catch (err) {
        if (btnText) btnText.textContent = defaultLabel;
        if (submitBtn) submitBtn.disabled = false;
        alert('Er ging iets mis bij het versturen. Probeer het opnieuw of mail rechtstreeks naar info@brand-on.org.');
      }
    });
  })();

  /* ---------- Cookie consent (AVG / Consent Mode v2) ---------- */
  (function cookieConsent() {
    let stored;
    try { stored = localStorage.getItem('cookie-consent'); } catch (e) { stored = 'declined'; }
    if (stored === 'accepted' || stored === 'declined') return;

    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookietoestemming');
    banner.innerHTML =
      '<p class="cookie-text">We gebruiken anonieme analytische cookies om onze website te verbeteren. ' +
      'Meer weten? Lees ons <a href="/privacy">privacybeleid</a>.</p>' +
      '<div class="cookie-actions">' +
      '<button type="button" class="btn btn--ghost" data-cookie="decline"><span>Weigeren</span></button>' +
      '<button type="button" class="btn" data-cookie="accept"><span>Accepteren</span></button>' +
      '</div>';
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('is-visible'));

    const choose = (value) => {
      try { localStorage.setItem('cookie-consent', value); } catch (e) {}
      if (value === 'accepted' && typeof window.gtag === 'function') {
        window.gtag('consent', 'update', { analytics_storage: 'granted' });
      }
      banner.classList.remove('is-visible');
      setTimeout(() => banner.remove(), 500);
    };

    banner.querySelector('[data-cookie="accept"]').addEventListener('click', () => choose('accepted'));
    banner.querySelector('[data-cookie="decline"]').addEventListener('click', () => choose('declined'));
  })();

  /* ---------- Footer year ---------- */
  const y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();
