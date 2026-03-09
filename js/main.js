/* ========================================
   Nexora.ai — Shared JS (trysoro-style animations)
   ======================================== */

document.addEventListener('DOMContentLoaded', function () {

  /* ---- Navbar scroll shadow ---- */
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  /* ---- Mobile burger menu ---- */
  const burger = document.querySelector('.burger');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('active');
      mobileMenu.classList.toggle('active');
      document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        burger.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  /* ---- Hero rotating text ---- */
  const rotatingEl = document.querySelector('.rotating-text');
  const rotatingIcon = document.querySelector('.rotating-icon');
  if (rotatingEl) {
    // Real Google SVG logos
    var svgGoogle = '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.77-4.59l-7.98-6.19A23.99 23.99 0 000 24c0 3.77.9 7.34 2.49 10.5l8.04-5.91z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
    var svgMaps = '<svg width="18" height="18" viewBox="0 0 92 132"><path d="M46 2C22.4 2 3 21.4 3 45c0 31.5 43 85 43 85s43-53.5 43-85C89 21.4 69.6 2 46 2z" fill="#34A853"/><path d="M46 2v43h43C89 21.4 69.6 2 46 2z" fill="#4285F4"/><path d="M46 2C22.4 2 3 21.4 3 45h43V2z" fill="#EA4335"/><path d="M3 45c0 31.5 43 85 43 85V45H3z" fill="#FBBC04"/><circle cx="46" cy="45" r="13" fill="#fff"/></svg>';
    var svgDiscover = '<svg width="18" height="18" viewBox="0 0 48 48"><path d="M20 2h8L36 10 24 22 20 14z" fill="#EA4335"/><path d="M46 20v8L38 36 26 24 34 20z" fill="#4285F4"/><path d="M28 46h-8L12 38 24 26 28 34z" fill="#34A853"/><path d="M2 28v-8L10 12 22 24 14 28z" fill="#FBBC04"/></svg>';

    var items = [
      { text: 'Google', icon: svgGoogle, bg: '#4285F41a' },
      { text: 'Google Maps', icon: svgMaps, bg: '#34A8531a' },
      { text: 'Google Discover', icon: svgDiscover, bg: '#FBBC041a' }
    ];
    var idx = 0;
    setInterval(function() {
      idx = (idx + 1) % items.length;
      rotatingEl.style.opacity = '0';
      rotatingEl.style.transform = 'translateY(10px) scale(0.95)';
      if (rotatingIcon) {
        rotatingIcon.style.opacity = '0';
        rotatingIcon.style.transform = 'scale(0.8)';
      }
      setTimeout(function() {
        rotatingEl.textContent = items[idx].text;
        if (rotatingIcon) {
          rotatingIcon.innerHTML = items[idx].icon;
          rotatingIcon.style.background = items[idx].bg;
          rotatingIcon.style.opacity = '1';
          rotatingIcon.style.transform = 'scale(1)';
        }
        rotatingEl.style.opacity = '1';
        rotatingEl.style.transform = 'translateY(0) scale(1)';
      }, 250);
    }, 2500);
  }

  /* ---- Accordions ---- */
  document.querySelectorAll('.accordion-item').forEach(item => {
    const header = item.querySelector('.accordion-header');
    if (header) {
      header.addEventListener('click', () => {
        const wasActive = item.classList.contains('active');
        item.parentElement.querySelectorAll('.accordion-item').forEach(sib => sib.classList.remove('active'));
        if (!wasActive) item.classList.add('active');
      });
    }
  });

  /* ---- Step accordions ---- */
  document.querySelectorAll('.step-item').forEach(item => {
    item.addEventListener('click', () => {
      const wasActive = item.classList.contains('active');
      item.parentElement.querySelectorAll('.step-item').forEach(sib => sib.classList.remove('active'));
      if (!wasActive) item.classList.add('active');
    });
  });

  /* ---- Counter animation ---- */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    const animateCounter = (el) => {
      const target = el.getAttribute('data-count');
      const suffix = el.getAttribute('data-suffix') || '';
      const prefix = el.getAttribute('data-prefix') || '';
      const isFloat = target.includes('.');
      const end = parseFloat(target);
      const duration = 2000;
      const start = performance.now();

      const tick = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = isFloat ? (eased * end).toFixed(1) : Math.floor(eased * end);
        el.textContent = prefix + current + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    counters.forEach(c => counterObserver.observe(c));
  }

  /* ---- Password eye toggle ---- */
  document.querySelectorAll('.eye-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const input = toggle.previousElementSibling || toggle.parentElement.querySelector('input');
      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        toggle.textContent = isPassword ? '🙈' : '👁';
      }
    });
  });

  /* ---- Smooth scroll for anchor links ---- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ============================================
     TRYSORO-STYLE SCROLL ANIMATIONS
     ============================================ */

  // Main reveal observer — triggers fade-in/scale when elements enter viewport
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });

  // Auto-apply staggered reveal to card grids
  const cardSelectors = [
    '.feature-card', '.testimonial-card', '.story-card', '.blog-card',
    '.backlink-card', '.core-card', '.hiw-card', '.challenge-card',
    '.who-card', '.aff-how-card', '.impact-item', '.pf-item',
    '.strategy-step', '.result-item', '.hiw-step-card',
    '.pricing-card', '.faq-section .accordion-item'
  ];

  cardSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach((el, i) => {
      if (!el.classList.contains('reveal') && !el.classList.contains('reveal-scale')) {
        el.classList.add('reveal');
        // Stagger within groups of visible cards (max 8 stagger)
        const delay = Math.min(i % 4, 7);
        el.style.transitionDelay = (delay * 0.08) + 's';
      }
    });
  });

  // Apply reveal to section titles and subtitles
  document.querySelectorAll('.section-title, .section-subtitle, .label, .label-badge').forEach(el => {
    if (!el.closest('.hero') && !el.classList.contains('reveal')) {
      el.classList.add('reveal');
    }
  });

  // Apply reveal-scale to specific large elements
  document.querySelectorAll('.pricing-card, .feature-visual, .story-hero-img, .aff-dashboard').forEach(el => {
    if (!el.classList.contains('reveal-scale')) {
      el.classList.add('reveal-scale');
    }
  });

  // Apply reveal to full sections for a clean appearance
  document.querySelectorAll('section > .container, section > .container-lg').forEach(container => {
    const section = container.parentElement;
    if (!section.classList.contains('hero') && !section.classList.contains('navbar')) {
      // Don't double-apply
      if (!container.classList.contains('reveal') && !container.querySelector('.reveal')) {
        // Skip — children already have reveals
      }
    }
  });

  // Observe all reveal elements
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => {
    revealObserver.observe(el);
  });

  /* ---- Hero entrance animations ---- */
  const heroContent = document.querySelector('.hero');
  if (heroContent) {
    // Add staggered entrance classes to hero children
    const heroTitle = heroContent.querySelector('h1, .hero-title');
    const heroRotating = heroContent.querySelector('.rotating-wrapper, .hero-platforms');
    const heroSubtitle = heroContent.querySelector('.hero-subtitle, .hero p');
    const heroCTA = heroContent.querySelector('.hero-cta, .hero-actions');
    const heroTrust = heroContent.querySelector('.hero-trust, .hero-stars');

    [heroTitle, heroRotating, heroSubtitle, heroCTA, heroTrust].forEach((el, i) => {
      if (el && !el.classList.contains('hero-anim')) {
        el.classList.add('hero-anim', `hero-anim-${i + 1}`);
      }
    });
  }

  /* ---- Parallax effect on hero (subtle) ---- */
  const hero = document.querySelector('.hero');
  if (hero) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrolled = window.scrollY;
          if (scrolled < 800) {
            const opacity = Math.max(0, 1 - scrolled / 600);
            const translateY = scrolled * 0.2;
            hero.style.setProperty('--hero-opacity', opacity);
            hero.style.setProperty('--hero-translate', translateY + 'px');
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ---- Quality tabs interaction ---- */
  document.querySelectorAll('.quality-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.quality-tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* ---- Smooth hover tilt on cards (subtle) ---- */
  document.querySelectorAll('.feature-card, .hiw-step-card, .testimonial-card').forEach(card => {
    card.addEventListener('mouseenter', function () {
      this.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease';
    });
  });

  /* ---- Number counting animation for stat elements ---- */
  document.querySelectorAll('.story-metric, .stat-value, .result-value, .result-box-value').forEach(el => {
    if (!el.classList.contains('reveal')) {
      el.classList.add('reveal');
      revealObserver.observe(el);
    }
  });

  /* ---- Marquee pause on hover ---- */
  document.querySelectorAll('.marquee-track').forEach(track => {
    const parent = track.closest('.marquee-wrap');
    if (parent) {
      parent.addEventListener('mouseenter', () => {
        track.style.animationPlayState = 'paused';
      });
      parent.addEventListener('mouseleave', () => {
        track.style.animationPlayState = 'running';
      });
    }
  });

});

// ========== SCROLL PROGRESS BAR ==========
(function() {
  const bar = document.querySelector('.navbar-progress');
  if (!bar) return;
  window.addEventListener('scroll', function() {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const p = (window.scrollY / h) * 100;
    bar.style.width = p + '%';
  }, { passive: true });
})();

// ========== HERO GAUGE ANIMATION ==========
(function() {
  const gaugeFill = document.querySelector('.hero-dashboard .gauge-fill');
  const chartLine = document.querySelector('.hero-dashboard .chart-line');
  const chartArea = document.querySelector('.hero-dashboard .chart-area');
  const chartDot = document.querySelector('.hero-dashboard .chart-dot');
  const gaugeNum = document.querySelector('.hero-dashboard .gauge-number');
  if (gaugeFill) {
    setTimeout(function() {
      var target = 96;
      var dashTarget = (target / 100) * 314;
      gaugeFill.style.strokeDasharray = dashTarget + ' 314';
      if (chartLine) chartLine.classList.add('animated');
      if (chartArea) chartArea.classList.add('animated');
      if (chartDot) chartDot.classList.add('animated');
      if (gaugeNum) {
        var end = parseInt(gaugeNum.getAttribute('data-count')) || 96;
        var duration = 2000;
        var startTime = performance.now();
        function animateGauge(now) {
          var elapsed = now - startTime;
          var progress = Math.min(elapsed / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          gaugeNum.textContent = Math.round(eased * end);
          if (progress < 1) requestAnimationFrame(animateGauge);
        }
        requestAnimationFrame(animateGauge);
      }
    }, 500);
  }
})();

// ========== STATS BANNER COUNTER ==========
(function() {
  var statNums = document.querySelectorAll('.stat-number[data-count]');
  if (!statNums.length) return;
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var el = entry.target;
        obs.unobserve(el);
        var end = parseFloat(el.getAttribute('data-count'));
        var prefix = el.getAttribute('data-prefix') || '';
        var suffix = el.getAttribute('data-suffix') || '';
        var duration = 2000;
        var startTime = performance.now();
        function animate(now) {
          var elapsed = now - startTime;
          var progress = Math.min(elapsed / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          var current = Math.round(eased * end);
          el.textContent = prefix + current.toLocaleString('fr-FR') + suffix;
          if (progress < 1) requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);
      }
    });
  }, { threshold: 0.3 });
  statNums.forEach(function(el) { obs.observe(el); });
})();

// ========== DEMO TAB SWITCHING ==========
(function() {
  var tabs = document.querySelectorAll('.demo-tab');
  var panels = document.querySelectorAll('.demo-panel');
  if (!tabs.length) return;
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var target = this.getAttribute('data-tab');
      tabs.forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      panels.forEach(function(p) { p.classList.remove('active'); });
      var targetPanel = document.querySelector('.demo-panel[data-panel="' + target + '"]');
      if (targetPanel) targetPanel.classList.add('active');
    });
  });
})();

// ========== TESTIMONIALS MARQUEE — duplicate cards for seamless loop ==========
(function() {
  var tracks = document.querySelectorAll('.testi-track');
  tracks.forEach(function(track) {
    // Clone all children and append for seamless infinite scroll
    var children = Array.from(track.children);
    children.forEach(function(child) {
      var clone = child.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  });
})();

// ========== REVEAL NEW ELEMENTS ==========
(function() {
  ['.stat-item','.demo-wrapper','.comparison-table .comp-row','.pricing-badge','.footer-rocket'].forEach(function(sel) {
    document.querySelectorAll(sel).forEach(function(el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = (i % 4) * 0.08 + 's';
    });
  });
})();

// ========== TIMELINE V2 — progress bar + step reveal ==========
(function() {
  var tl = document.querySelector('.tl-v2');
  if (!tl) return;
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        tl.classList.add('animated');
        obs.unobserve(tl);
      }
    });
  }, { threshold: 0.2 });
  obs.observe(tl);
})();

// ========== EVO CARDS — sequential reveal ==========
(function() {
  var grid = document.querySelector('.evo-grid');
  if (!grid) return;
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        grid.classList.add('evo-revealed');
        obs.unobserve(grid);
      }
    });
  }, { threshold: 0.2 });
  obs.observe(grid);
})();

// ========== REVEAL-UP SCROLL ANIMATION ==========
(function() {
  var revealEls = document.querySelectorAll('.reveal-up');
  if (!revealEls.length) return;
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(function(el, i) {
    el.style.transitionDelay = (i % 3) * 0.12 + 's';
    observer.observe(el);
  });
})();

// ========== ANIMATED GOOGLE MOCKUP ==========
(function() {
  var googleMockup = document.querySelector('[data-mockup="google"]');
  if (!googleMockup) return;

  function animateGoogle(el) {
    var query = el.querySelector('.mg-query');
    var cursor = el.querySelector('.mg-cursor');
    var results = el.querySelectorAll('.mg-result');
    var missing = el.querySelector('.mg-missing');
    var text = query.getAttribute('data-text');
    var i = 0;
    function typeChar() {
      if (i < text.length) {
        query.textContent += text[i];
        i++;
        setTimeout(typeChar, 55 + Math.random() * 45);
      } else {
        cursor.style.display = 'none';
        results.forEach(function(r, idx) {
          setTimeout(function() { r.classList.add('visible'); }, 300 + idx * 400);
        });
        setTimeout(function() { if (missing) missing.classList.add('visible'); }, 300 + results.length * 400 + 400);
      }
    }
    setTimeout(typeChar, 600);
  }

  var mockupObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        animateGoogle(entry.target);
        mockupObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });

  mockupObserver.observe(googleMockup);
})();

// ========== EVO CARD SCROLL ANIMATION ==========
(function() {
  var evoCards = document.querySelectorAll('.evo-card');
  if (!evoCards.length) return;

  // Animate timeline progress
  var timelineBar = document.querySelector('.evo-timeline-progress');

  var evoObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var card = entry.target;
        var idx = Array.prototype.indexOf.call(evoCards, card);
        setTimeout(function() {
          card.classList.add('evo-visible');
          var bar = card.querySelector('.evo-bar-fill');
          if (bar) {
            setTimeout(function() {
              bar.style.width = bar.getAttribute('data-width') + '%';
            }, 400);
          }
          // Animate timeline to match progress
          if (timelineBar) {
            var pct = ((idx + 1) / evoCards.length) * 100;
            timelineBar.style.width = pct + '%';
          }
        }, idx * 150);
        evoObserver.unobserve(card);
      }
    });
  }, { threshold: 0.2 });

  evoCards.forEach(function(card) { evoObserver.observe(card); });
})();
