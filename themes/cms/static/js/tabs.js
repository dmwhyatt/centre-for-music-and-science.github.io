document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.tabs').forEach(function (tabGroup) {
    var buttons = tabGroup.querySelectorAll('.tab-btn');
    var panels = tabGroup.querySelectorAll('.tab-panel');

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-tab');

        buttons.forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        panels.forEach(function (p) {
          p.classList.remove('active');
          p.setAttribute('aria-hidden', 'true');
        });

        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        var panel = document.getElementById('panel-' + target);
        if (panel) {
          panel.classList.add('active');
          panel.setAttribute('aria-hidden', 'false');
        }
      });
    });
  });

  // Show nav logo only after the hero banner logo scrolls out of view.
  // On pages without a hero, the logo is always visible.
  var siteLogo = document.querySelector('.site-logo');
  var heroLogo = document.querySelector('.hero-lab-logo-watermark');
  if (siteLogo) {
    if (heroLogo && typeof IntersectionObserver !== 'undefined') {
      new IntersectionObserver(function (entries) {
        siteLogo.classList.toggle('site-logo--visible', !entries[0].isIntersecting);
      }).observe(heroLogo);
    } else {
      siteLogo.classList.add('site-logo--visible');
    }
  }

  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  var navLinks = document.querySelector('.nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', function () {
      navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
      });
    });
  }
});
