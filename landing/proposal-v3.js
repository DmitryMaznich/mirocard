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
  var root = document.querySelector('[data-topics-carousel]');
  if(!root) return;

  var DURATION = 4000;
  var stage = root.querySelector('[data-stage]');
  var slides = Array.prototype.slice.call(root.querySelectorAll('[data-slide]'));
  var thumbs = Array.prototype.slice.call(root.querySelectorAll('[data-thumb]'));
  var caption = root.querySelector('[data-caption]');
  var prefersReducedCarousel = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var index = 0;
  var timerId = null;
  var startedAt = 0;
  var remaining = DURATION;
  var paused = false;

  function setActive(newIndex){
    newIndex = ((newIndex % slides.length) + slides.length) % slides.length;
    index = newIndex;
    slides.forEach(function(slide, i){ slide.classList.toggle('is-active', i === index); });
    thumbs.forEach(function(thumb, i){
      var isActive = i === index;
      thumb.classList.toggle('is-active', isActive);
      thumb.setAttribute('aria-current', isActive ? 'true' : 'false');
      var progress = thumb.querySelector('[data-progress]');
      progress.classList.remove('is-filling');
      if(isActive && !prefersReducedCarousel){
        void progress.offsetWidth;
        progress.classList.add('is-filling');
      }
    });
    caption.textContent = thumbs[index].getAttribute('data-caption-text');
    restartTimer();
  }

  function restartTimer(){
    remaining = DURATION;
    startedAt = Date.now();
    clearTimeout(timerId);
    if(prefersReducedCarousel || paused) return;
    timerId = setTimeout(advance, remaining);
  }

  function advance(){
    setActive(index + 1);
  }

  function pause(){
    if(paused) return;
    paused = true;
    root.classList.add('is-paused');
    remaining -= (Date.now() - startedAt);
    if(remaining < 0) remaining = 0;
    clearTimeout(timerId);
  }

  function resume(){
    if(!paused) return;
    paused = false;
    root.classList.remove('is-paused');
    if(prefersReducedCarousel) return;
    startedAt = Date.now();
    timerId = setTimeout(advance, remaining);
  }

  thumbs.forEach(function(thumb, i){
    thumb.addEventListener('click', function(){ setActive(i); });
  });

  root.addEventListener('pointerenter', pause);
  root.addEventListener('pointerleave', resume);
  root.addEventListener('focusin', pause);
  root.addEventListener('focusout', resume);

  root.addEventListener('keydown', function(e){
    if(e.key === 'ArrowRight'){ setActive(index + 1); e.preventDefault(); }
    if(e.key === 'ArrowLeft'){ setActive(index - 1); e.preventDefault(); }
  });

  var touchStartX = null;
  stage.addEventListener('touchstart', function(e){
    touchStartX = e.touches[0].clientX;
    pause();
  }, { passive: true });
  stage.addEventListener('touchend', function(e){
    if(touchStartX === null) return;
    var deltaX = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    resume();
    if(Math.abs(deltaX) > 40){
      setActive(index + (deltaX < 0 ? 1 : -1));
    }
  });

  if(!prefersReducedCarousel) restartTimer();
})();

(function(){
  var list = document.querySelector('[data-faq]');
  if(!list) return;
  list.querySelectorAll('.faq__item').forEach(function(item){
    var button = item.querySelector('.faq__question');
    button.addEventListener('click', function(){
      var isOpen = item.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(isOpen));
    });
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