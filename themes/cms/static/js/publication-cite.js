document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.project-pub-cite-wrap').forEach(function (wrap) {
    var btn = wrap.querySelector('.project-pub-cite-btn');
    var panel = wrap.querySelector('.project-pub-cite-panel');
    if (!btn || !panel) return;

    function open() {
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    }

    function close() {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }

    function toggle() {
      if (panel.hidden) {
        open();
      } else {
        close();
      }
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggle();
    });

    wrap.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    document.addEventListener('click', function () {
      if (!panel.hidden) {
        close();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) {
        close();
        btn.focus();
      }
    });
  });
});
