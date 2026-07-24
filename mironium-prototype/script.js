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
