/* ========================================
   Seora.ai — Shared JS (trysoro-style animations)
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

  /* ---- Hero rotating logo ---- */
  var rotatingLogo = document.querySelector('.rotating-logo');
  if (rotatingLogo) {
    var logos = [
      { src: 'logo/chatgpt.png', alt: 'ChatGPT' },
      { src: 'logo/perplexity.png', alt: 'Perplexity' },
      { src: 'logo/gemini.png', alt: 'Gemini' },
      { src: 'logo/claude.png', alt: 'Claude' },
      { src: 'logo/google.png', alt: 'Google' },
      { src: 'logo/googlemaps.png', alt: 'Google Maps' }
    ];
    var lIdx = 0;
    // Preload
    logos.forEach(function(l) { var i = new Image(); i.src = l.src; });
    setInterval(function() {
      rotatingLogo.style.opacity = '0';
      rotatingLogo.style.transform = 'translateY(10px) scale(0.95)';
      setTimeout(function() {
        lIdx = (lIdx + 1) % logos.length;
        rotatingLogo.querySelector('img').src = logos[lIdx].src;
        rotatingLogo.querySelector('img').alt = logos[lIdx].alt;
        rotatingLogo.style.opacity = '1';
        rotatingLogo.style.transform = 'translateY(0) scale(1)';
      }, 300);
    }, 2500);
  }

  /* ---- Duo mockups: rotating AI logos in both hero + GEO section ---- */
  var aiLogos = [
    { src: 'logo/chatgpt.png', name: 'ChatGPT' },
    { src: 'logo/perplexity.png', name: 'Perplexity' },
    { src: 'logo/gemini.png', name: 'Gemini' },
    { src: 'logo/claude.png', name: 'Claude' }
  ];
  aiLogos.forEach(function(l) { var i = new Image(); i.src = l.src; });

  // Hero duo
  var duoAiLogo = document.querySelector('.hero-duo-ai-logo:not(.geo-duo-ai-logo)');
  var duoAiName = document.querySelector('.hero-duo-ai-name:not(.geo-duo-ai-name)');
  var duoAiIcon = document.querySelector('.hd-ai-icon:not(.geo-duo-ai-icon)');
  if (duoAiLogo && duoAiName) {
    var aiIdx = 0;
    setInterval(function() {
      duoAiLogo.style.opacity = '0';
      setTimeout(function() {
        aiIdx = (aiIdx + 1) % aiLogos.length;
        duoAiLogo.src = aiLogos[aiIdx].src;
        duoAiName.textContent = aiLogos[aiIdx].name;
        if (duoAiIcon) duoAiIcon.src = aiLogos[aiIdx].src;
        duoAiLogo.style.opacity = '1';
      }, 250);
    }, 3000);
  }

  // GEO section duo
  var geoAiLogo = document.querySelector('.geo-duo-ai-logo');
  var geoAiName = document.querySelector('.geo-duo-ai-name');
  var geoAiIcon = document.querySelector('.geo-duo-ai-icon');
  if (geoAiLogo && geoAiName) {
    var geoIdx = 0;
    setInterval(function() {
      geoAiLogo.style.opacity = '0';
      setTimeout(function() {
        geoIdx = (geoIdx + 1) % aiLogos.length;
        geoAiLogo.src = aiLogos[geoIdx].src;
        geoAiName.textContent = aiLogos[geoIdx].name;
        if (geoAiIcon) geoAiIcon.src = aiLogos[geoIdx].src;
        geoAiLogo.style.opacity = '1';
      }, 250);
    }, 3500);
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

// ========== DEMO TAB SWITCHING (click + auto-rotate every 4s) ==========
(function() {
  var tabs = document.querySelectorAll('.demo-tab');
  var panels = document.querySelectorAll('.demo-panel');
  if (!tabs.length) return;

  var currentIdx = 0;
  var autoInterval = null;

  function switchTo(idx) {
    currentIdx = idx % tabs.length;
    var target = tabs[currentIdx].getAttribute('data-tab');
    tabs.forEach(function(t) { t.classList.remove('active'); });
    tabs[currentIdx].classList.add('active');
    panels.forEach(function(p) { p.classList.remove('active'); });
    var targetPanel = document.querySelector('.demo-panel[data-panel="' + target + '"]');
    if (targetPanel) targetPanel.classList.add('active');
  }

  function startAuto() {
    stopAuto();
    autoInterval = setInterval(function() {
      switchTo(currentIdx + 1);
    }, 4000);
  }

  function stopAuto() {
    if (autoInterval) { clearInterval(autoInterval); autoInterval = null; }
  }

  // Click handler — switch + restart timer
  tabs.forEach(function(tab, i) {
    tab.addEventListener('click', function() {
      switchTo(i);
      startAuto();
    });
  });

  // Start auto-rotation
  startAuto();
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

// ========== NOWORRY WORDS — staggered pop ==========
(function() {
  var words = document.querySelectorAll('.nw-word');
  if (!words.length) return;
  var container = document.querySelector('.noworry-words');
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        words.forEach(function(w, i) {
          setTimeout(function() { w.classList.add('nw-word-visible'); }, i * 180);
        });
        obs.unobserve(container);
      }
    });
  }, { threshold: 0.3 });
  obs.observe(container);
})();

// ========== NOWORRY CARDS — staggered reveal ==========
(function() {
  var cards = document.querySelectorAll('.noworry-card');
  if (!cards.length) return;
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var idx = Array.prototype.indexOf.call(cards, entry.target);
        setTimeout(function() {
          entry.target.classList.add('nw-visible');
        }, idx * 120);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  cards.forEach(function(c) { obs.observe(c); });
})();

// ========== ANIMATED GOOGLE MOCKUP (LOOP) ==========
(function() {
  var googleMockup = document.querySelector('[data-mockup="google"]');
  if (!googleMockup) return;

  var query = googleMockup.querySelector('.mg-query');
  var cursor = googleMockup.querySelector('.mg-cursor');
  var results = googleMockup.querySelectorAll('.mg-result');
  var missing = googleMockup.querySelector('.mg-missing');
  var text = query.getAttribute('data-text');

  function resetGoogle() {
    query.textContent = '';
    cursor.style.display = '';
    results.forEach(function(r) { r.classList.remove('visible'); });
    if (missing) missing.classList.remove('visible');
  }

  function animateGoogle() {
    resetGoogle();
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
        var totalTime = 300 + results.length * 400 + 400;
        setTimeout(function() { if (missing) missing.classList.add('visible'); }, totalTime);
        setTimeout(animateGoogle, totalTime + 3000);
      }
    }
    setTimeout(typeChar, 600);
  }

  var mockupObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        animateGoogle();
        mockupObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });

  mockupObserver.observe(googleMockup);
})();

// ========== ANIMATED CHATGPT MOCKUP (LOOP) ==========
(function() {
  var chatMockup = document.querySelector('[data-mockup="chatgpt"]');
  if (!chatMockup) return;

  var userMsg = chatMockup.querySelector('.mc-user');
  var aiMsg = chatMockup.querySelector('.mc-ai');
  var userBubble = chatMockup.querySelector('.mc-bubble-user');
  var intro = chatMockup.querySelector('.mc-ai-intro');
  var items = chatMockup.querySelectorAll('.mc-ai-item');
  var missing = chatMockup.querySelector('.mc-missing-gpt');
  var text = userBubble.getAttribute('data-text');

  function resetChat() {
    userBubble.textContent = '';
    userMsg.classList.remove('mc-visible');
    userMsg.classList.add('mc-hidden');
    aiMsg.classList.remove('mc-visible');
    aiMsg.classList.add('mc-hidden');
    intro.classList.remove('mc-type-visible');
    intro.classList.add('mc-type-hidden');
    items.forEach(function(item) {
      item.classList.remove('mc-type-visible');
      item.classList.add('mc-type-hidden');
    });
    if (missing) missing.classList.remove('visible');
  }

  function animateChat() {
    resetChat();
    setTimeout(function() {
      userMsg.classList.remove('mc-hidden');
      userMsg.classList.add('mc-visible');
      var i = 0;
      function typeChar() {
        if (i < text.length) {
          userBubble.textContent += text[i];
          i++;
          setTimeout(typeChar, 40 + Math.random() * 30);
        } else {
          setTimeout(function() {
            aiMsg.classList.remove('mc-hidden');
            aiMsg.classList.add('mc-visible');
            setTimeout(function() {
              intro.classList.remove('mc-type-hidden');
              intro.classList.add('mc-type-visible');
              items.forEach(function(item, idx) {
                setTimeout(function() {
                  item.classList.remove('mc-type-hidden');
                  item.classList.add('mc-type-visible');
                }, 300 + idx * 350);
              });
              var totalItems = 300 + items.length * 350 + 400;
              setTimeout(function() {
                if (missing) missing.classList.add('visible');
              }, totalItems);
              setTimeout(animateChat, totalItems + 3000);
            }, 300);
          }, 600);
        }
      }
      typeChar();
    }, 800);
  }

  var chatObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        animateChat();
        chatObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });

  chatObserver.observe(chatMockup);
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
