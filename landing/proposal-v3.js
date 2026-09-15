(function(){
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var targets = document.querySelectorAll('.reveal');
  if(prefersReduced || !('IntersectionObserver' in window)){
    targets.forEach(function(el){ el.classList.add('is-visible'); });
    return;
  }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  targets.forEach(function(el){ io.observe(el); });

  var steps = document.querySelector('.steps');
  if(steps){
    var stepsIO = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        steps.classList.toggle('is-playing', entry.isIntersecting);
      });
    }, { threshold: 0.3 });
    stepsIO.observe(steps);
  }
})();

(function(){
  /* Tablet mockups: one in the hero (independent tap-to-cycle), one in the
     "topics in action" stage (scroll-driven, synced to the step list). Both
     read their screens from the stage's step blocks — a single source of
     truth for the image/caption data, no duplication in markup or JS. */
  var stepsList = Array.prototype.slice.call(document.querySelectorAll('#topics .screen-step'));
  if(!stepsList.length) return;

  var topics = stepsList.map(function(el){
    return {
      img: el.getAttribute('data-img'),
      alt: el.getAttribute('data-alt'),
      caption: el.getAttribute('data-caption')
    };
  });

  function buildShots(container, activeIndex){
    container.innerHTML = topics.map(function(t, i){
      return '<img class="tablet-shot' + (i === activeIndex ? ' is-active' : '') + '" src="' + t.img + '" alt="' + t.alt + '" loading="lazy">';
    }).join('');
  }

  function setActiveShot(container, index){
    Array.prototype.forEach.call(container.querySelectorAll('.tablet-shot'), function(shot, i){
      shot.classList.toggle('is-active', i === index);
    });
  }

  function makeTappable(frame, onActivate){
    frame.setAttribute('role', 'button');
    frame.setAttribute('tabindex', '0');
    frame.addEventListener('click', onActivate);
    frame.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); onActivate(); }
    });
  }

  /* Hero tablet: independent tap-to-cycle through every topic. */
  var heroScreen = document.getElementById('hero-tablet-screen');
  var heroFrame = document.getElementById('hero-tablet-frame');
  var heroCaption = document.getElementById('hero-tablet-caption');
  var heroHint = document.getElementById('hero-tap-hint');
  if(heroScreen && heroFrame){
    var heroIndex = 0;
    buildShots(heroScreen, heroIndex);
    if(heroCaption) heroCaption.textContent = topics[heroIndex].caption;
    makeTappable(heroFrame, function(){
      heroIndex = (heroIndex + 1) % topics.length;
      setActiveShot(heroScreen, heroIndex);
      if(heroCaption) heroCaption.textContent = topics[heroIndex].caption;
      if(heroHint) heroHint.classList.add('is-gone');
    });
  }

  /* Topics stage: tablet stays sticky, whichever step crosses the viewport's
     centre switches its screen. Tabs above jump straight to a step. On
     narrow screens (matches the .screen-step mobile rules) the scroll
     tracking is skipped — tabs just switch the visible step directly. */
  var stageScreen = document.getElementById('topics-tablet-screen');
  var stageFrame = document.getElementById('topics-tablet-frame');
  var tabsRoot = document.getElementById('topics-tabs');
  if(!stageScreen) return;

  var activeIndex = 0;
  buildShots(stageScreen, activeIndex);

  if(tabsRoot){
    tabsRoot.innerHTML = topics.map(function(t, i){
      return '<button type="button" class="topics-tab' + (i === 0 ? ' is-active' : '') + '" data-tab-index="' + i + '">' + t.caption + '</button>';
    }).join('');
  }
  var tabs = tabsRoot ? Array.prototype.slice.call(tabsRoot.querySelectorAll('.topics-tab')) : [];

  function isTabMode(){ return window.matchMedia('(max-width:780px)').matches; }

  function setActive(index){
    if(index === activeIndex) return;
    activeIndex = index;
    setActiveShot(stageScreen, index);
    tabs.forEach(function(tab, i){ tab.classList.toggle('is-active', i === index); });
    stepsList.forEach(function(el, i){ el.classList.toggle('is-active', i === index); });
  }

  function goStep(i){
    if(isTabMode()){ setActive(i); return; }
    stepsList[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  tabs.forEach(function(tab, i){
    tab.addEventListener('click', function(){ goStep(i); });
  });
  if(stageFrame){
    makeTappable(stageFrame, function(){ goStep((activeIndex + 1) % topics.length); });
  }

  var stepObserver = null;
  function bindSteps(){
    if(stepObserver) stepObserver.disconnect();
    if(isTabMode()) return;
    stepObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting) setActive(+entry.target.getAttribute('data-step'));
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    stepsList.forEach(function(el){ stepObserver.observe(el); });
  }
  bindSteps();

  var resizeTimer;
  window.addEventListener('resize', function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(bindSteps, 200);
  });
})();

(function(){
  var toggle = document.querySelector('.menu-toggle');
  var navigation = document.querySelector('#site-navigation');
  if(!toggle || !navigation) return;
  function closeMenu(){
    navigation.classList.remove('is-open');
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', function(){
    var willOpen = !navigation.classList.contains('is-open');
    navigation.classList.toggle('is-open', willOpen);
    toggle.classList.toggle('is-open', willOpen);
    toggle.setAttribute('aria-expanded', String(willOpen));
  });
  navigation.querySelectorAll('a').forEach(function(link){ link.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function(event){ if(event.key === 'Escape') closeMenu(); });
})();

(function(){
  /* Free materials library: a 3-card teaser on the homepage (one per category,
     picked from the live catalog) plus a full catalog behind an overlay — the
     overlay is where the list actually lives, so adding more PDFs never grows
     the homepage. Email is asked once, remembered in localStorage, then every
     "Получить PDF" button just requests that material for the stored email. */
  var openBtn = document.getElementById('materials-open-catalog');
  var overlay = document.getElementById('materials-overlay');
  if(!openBtn || !overlay) return;

  var MATERIALS_API_BASE = 'https://app.mironium.com/api';
  var EMAIL_KEY = 'mironium_materials_email';
  var CATEGORY_LABELS = { speech: 'Речь', literacy: 'Грамота', math: 'Математика' };

  var closeBtn = document.getElementById('materials-overlay-close');
  var scrim = document.getElementById('materials-overlay-scrim');
  var emailInput = document.getElementById('materials-email');
  var confirmBtn = document.getElementById('materials-email-confirm');
  var emailMsg = document.getElementById('materials-email-msg');
  var tabsRoot = document.getElementById('materials-cat-tabs');
  var catalogGrid = document.getElementById('materials-catalog-grid');
  var teaserGrid = document.getElementById('materials-teaser-grid');

  var materials = [];
  var activeCategory = 'all';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var emailConfirmed = false;

  function setButtonsEnabled(enabled){
    var buttons = document.querySelectorAll('.materials__button');
    Array.prototype.forEach.call(buttons, function(btn){
      if(btn.dataset.state === 'sent' || btn.dataset.state === 'sending') return;
      btn.disabled = !enabled;
    });
  }

  function confirmEmail(silent){
    var email = emailInput.value.trim();
    if(!EMAIL_RE.test(email)){
      emailConfirmed = false;
      setButtonsEnabled(false);
      if(!silent){
        emailInput.classList.add('is-missing');
        emailMsg.textContent = 'Проверьте адрес — похоже, в нём опечатка.';
        emailMsg.className = 'materials-overlay__email-msg is-error';
      }
      return;
    }
    emailConfirmed = true;
    emailInput.classList.remove('is-missing');
    confirmBtn.dataset.state = 'confirmed';
    emailMsg.textContent = 'Email подтверждён ✓';
    emailMsg.className = 'materials-overlay__email-msg is-success';
    try { localStorage.setItem(EMAIL_KEY, email); } catch(e){}
    setButtonsEnabled(true);
  }

  try { emailInput.value = localStorage.getItem(EMAIL_KEY) || ''; } catch(e){}
  if(emailInput.value) confirmEmail(true);
  emailInput.addEventListener('input', function(){
    emailInput.classList.remove('is-missing');
    emailMsg.textContent = '';
    emailMsg.className = 'materials-overlay__email-msg';
    confirmBtn.dataset.state = '';
    emailConfirmed = false;
    setButtonsEnabled(false);
  });
  confirmBtn.addEventListener('click', function(){ confirmEmail(false); });
  emailInput.addEventListener('keydown', function(e){
    if(e.key === 'Enter'){ e.preventDefault(); confirmEmail(false); }
  });

  function escHtml(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ICON_SVG = '<svg viewBox="0 0 32 32" fill="none"><path d="M9 4h10l6 6v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="#FFF9EE" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M19 4v6h6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M11 16h10M11 20h10M11 24h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  function cardHtml(m){
    return '<article class="materials__card">' +
      '<span class="materials__icon" aria-hidden="true">' + ICON_SVG + '</span>' +
      '<h3>' + escHtml(m.title) + '</h3>' +
      '<p>' + escHtml(m.description) + '</p>' +
      '<button type="button" class="button materials__button" data-material-id="' + escHtml(m.id) + '" disabled>Получить PDF</button>' +
      '</article>';
  }

  function renderTeaser(){
    var seenCategory = {};
    var picks = [];
    materials.forEach(function(m){
      if(picks.length >= 3 || seenCategory[m.category]) return;
      seenCategory[m.category] = true;
      picks.push(m);
    });
    for(var i = 0; picks.length < 3 && i < materials.length; i++){
      if(picks.indexOf(materials[i]) === -1) picks.push(materials[i]);
    }
    teaserGrid.innerHTML = picks.map(cardHtml).join('');
    setButtonsEnabled(emailConfirmed);
  }

  function renderTabs(){
    var categories = [];
    materials.forEach(function(m){
      if(categories.indexOf(m.category) === -1) categories.push(m.category);
    });
    var tabs = [{ id: 'all', label: 'Все' }].concat(categories.map(function(c){
      return { id: c, label: CATEGORY_LABELS[c] || c };
    }));
    tabsRoot.innerHTML = tabs.map(function(t){
      return '<button type="button" class="topics-tab' + (t.id === activeCategory ? ' is-active' : '') + '" data-cat="' + t.id + '">' + escHtml(t.label) + '</button>';
    }).join('');
  }

  function renderCatalog(){
    var list = activeCategory === 'all' ? materials : materials.filter(function(m){ return m.category === activeCategory; });
    catalogGrid.innerHTML = list.map(cardHtml).join('');
    setButtonsEnabled(emailConfirmed);
  }

  tabsRoot.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('.topics-tab');
    if(!btn) return;
    activeCategory = btn.getAttribute('data-cat');
    renderTabs();
    renderCatalog();
  });

  function requestMaterial(button, materialId){
    var email = emailInput.value.trim();
    if(!emailConfirmed || !EMAIL_RE.test(email)){
      emailInput.classList.add('is-missing');
      emailInput.focus();
      return;
    }
    button.disabled = true;
    button.dataset.state = 'sending';
    button.textContent = 'Отправляем…';
    fetch(MATERIALS_API_BASE + '/materials/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, materialId: materialId })
    }).then(function(res){
      if(!res.ok) throw new Error('request failed');
      button.dataset.state = 'sent';
      button.textContent = 'Отправлено ✓';
    }).catch(function(){
      button.dataset.state = 'error';
      button.disabled = false;
      button.textContent = 'Ошибка — повторить';
    });
  }

  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('.materials__button');
    if(!btn || btn.dataset.state === 'sent' || btn.dataset.state === 'sending') return;
    var materialId = btn.getAttribute('data-material-id');
    if(materialId) requestMaterial(btn, materialId);
  });

  function openOverlay(){
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    renderTabs();
    renderCatalog();
    emailInput.focus();
  }
  function closeOverlay(){
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  openBtn.addEventListener('click', openOverlay);
  closeBtn.addEventListener('click', closeOverlay);
  scrim.addEventListener('click', closeOverlay);
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && !overlay.hidden) closeOverlay();
  });

  fetch(MATERIALS_API_BASE + '/materials/catalog')
    .then(function(res){ return res.json(); })
    .then(function(data){
      materials = data.materials || [];
      renderTeaser();
    })
    .catch(function(){ /* teaser stays empty — catalog overlay will retry on open */ });
})();