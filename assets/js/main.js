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
    let path = window.location.pathname.split('/').pop();
    if (!path) path = 'index.html';
    document.querySelectorAll('.nav-links a').forEach((a) => {
      const href = a.getAttribute('href');
      if (href === path) a.classList.add('active');
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
        lines.push({ label: 'Pakket — ' + PKG_LABEL[pkg] + ' (' + included + ' pag.)', value: euro(PKG[pkg]) });
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
      }

      pkgInputs.forEach((i) => i.addEventListener('change', render));
      addonInputs.forEach((i) => i.addEventListener('change', render));

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

  /* ---------- Contact form (front-end only demo) ---------- */
  (function contactForm() {
    const form = document.querySelector('[data-contact-form]');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const success = form.querySelector('[data-success]');
      if (success) success.classList.add('show');
      form.querySelectorAll('input, textarea, select, button').forEach((el) => {
        if (el.type !== 'button') el.setAttribute('disabled', 'true');
      });
    });
  })();

  /* ---------- Footer year ---------- */
  const y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();
