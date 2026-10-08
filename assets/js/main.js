const b=document.querySelector('.menu'),n=document.querySelector('.navlinks');b?.addEventListener('click',()=>n?.classList.toggle('open'));

/* ---------- Dinamismo (leve, sem bibliotecas) ---------- */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* cabeçalho: sombra + encolhe ao descer */
  var header = document.querySelector('header');
  if (header) {
    var ticking = false;
    var update = function () {
      header.classList.toggle('scrolled', window.scrollY > 10);
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* botão flutuante de WhatsApp — reutiliza o link que já está no rodapé */
  var waLink = document.querySelector('footer a[href^="https://wa.me/"]');
  if (waLink && !document.querySelector('.wa-float')) {
    var wa = document.createElement('a');
    wa.className = 'wa-float';
    wa.href = waLink.href;
    wa.target = '_blank';
    wa.rel = 'noopener noreferrer';
    wa.setAttribute('aria-label', 'Falar no WhatsApp');
    wa.innerHTML = '<i class="fab fa-whatsapp" aria-hidden="true"></i>';
    document.body.appendChild(wa);
  }

  /* sem IntersectionObserver ou com animações reduzidas: fica tudo visível */
  if (reduce || !('IntersectionObserver' in window)) return;

  document.documentElement.classList.add('js-anim');

  var SELECTOR = [
    '.section h2', '.section p.lead', '.stat', '.diffcard', '.card',
    '.service', '.service-card', '.project', '.formbox', '.two > div',
    '.cta .wrap > *', '.foot > div'
  ].join(',');

  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      revealIO.unobserve(el);
      el.classList.add('visible');
      var d = parseFloat(el.style.transitionDelay) || 0;
      setTimeout(function () {
        el.classList.remove('reveal', 'visible');
        el.style.transitionDelay = '';
      }, 900 + d * 1000);
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });

  function prepare(el, force) {
    if (el.classList.contains('reveal') || el.dataset.revealed) return;
    el.dataset.revealed = '1';
    // o que já está visível ao carregar a página não precisa de animar
    if (!force && el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    var i = 0, s = el.previousElementSibling;
    while (s && i < 4) { if (s.dataset.revealed) i++; s = s.previousElementSibling; }
    el.style.transitionDelay = (Math.min(i, 4) * 0.08) + 's';
    el.classList.add('reveal');
    revealIO.observe(el);
  }

  document.querySelectorAll(SELECTOR).forEach(function (el) { prepare(el, false); });

  /* conteúdo desenhado por JS (ex.: grelha de projectos) */
  var grid = document.querySelector('.project-grid');
  if (grid) {
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === 1 && node.matches('.project')) prepare(node, true);
        });
      });
    }).observe(grid, { childList: true });
  }

  /* contadores: "5+" conta de 0 a 5, "360°" de 0 a 360 (o texto final já está no HTML) */
  var countIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      countIO.unobserve(el);
      var target = +el.dataset.countTo, suffix = el.dataset.countSuffix, t0 = null, dur = 1200;
      (function step(t) {
        if (t0 === null) t0 = t;
        var p = Math.min((t - t0) / dur, 1), eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
      })(performance.now());
    });
  }, { threshold: 0.4 });

  document.querySelectorAll('.stat strong').forEach(function (el) {
    var m = /^(\d+)(.*)$/.exec(el.textContent.trim());
    if (!m || +m[1] <= 1) return;
    el.dataset.countTo = m[1];
    el.dataset.countSuffix = m[2];
    el.textContent = '0' + m[2];
    countIO.observe(el);
  });
})();
