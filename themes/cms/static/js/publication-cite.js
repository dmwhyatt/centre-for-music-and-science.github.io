document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.project-pub-cite-wrap').forEach(function (wrap) {
    var btn = wrap.querySelector('.project-pub-cite-btn');
    var panel = wrap.querySelector('.project-pub-cite-panel');
    var copyBtn = wrap.querySelector('.project-pub-cite-copy');
    var copyLabel = copyBtn ? copyBtn.querySelector('.project-pub-cite-copy-label') : null;
    if (!btn || !panel) return;
    var resetCopyStateTimeout;

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

    function activeCitationText() {
      var activePanel = panel.querySelector('.project-pub-cite-tabs .tab-panel.active');
      if (!activePanel) {
        return '';
      }

      var bibtexCode = activePanel.querySelector('pre code');
      if (bibtexCode) {
        return bibtexCode.textContent.trim();
      }

      return activePanel.textContent.replace(/\s+/g, ' ').trim();
    }

    function fallbackCopyText(text) {
      return new Promise(function (resolve, reject) {
        var fallback = document.createElement('textarea');
        fallback.value = text;
        fallback.setAttribute('readonly', '');
        fallback.style.position = 'fixed';
        fallback.style.top = '-1000px';
        document.body.appendChild(fallback);
        fallback.select();
        try {
          var copied = document.execCommand('copy');
          document.body.removeChild(fallback);
          if (copied) {
            resolve();
          } else {
            reject(new Error('Copy command failed.'));
          }
        } catch (err) {
          document.body.removeChild(fallback);
          reject(err);
        }
      });
    }

    function copyCitationText(text) {
      if (!text) return Promise.reject(new Error('No citation text to copy.'));
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(function () {
          return fallbackCopyText(text);
        });
      }
      return fallbackCopyText(text);
    }

    function setCopyButtonState(state, label, ariaLabel) {
      if (!copyBtn) return;
      copyBtn.classList.remove('is-copied', 'is-error');
      if (state) {
        copyBtn.classList.add(state);
      }
      if (copyLabel) {
        copyLabel.textContent = label;
      }
      copyBtn.setAttribute('aria-label', ariaLabel);
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var citationText = activeCitationText();
        copyCitationText(citationText)
          .then(function () {
            setCopyButtonState('is-copied', 'Copied', 'Citation copied');
            if (resetCopyStateTimeout) {
              clearTimeout(resetCopyStateTimeout);
            }
            resetCopyStateTimeout = window.setTimeout(function () {
              setCopyButtonState('', 'Copy', 'Copy citation');
            }, 1500);
          })
          .catch(function () {
            setCopyButtonState('is-error', 'Cmd/Ctrl+C', 'Copy unavailable');
            if (resetCopyStateTimeout) {
              clearTimeout(resetCopyStateTimeout);
            }
            resetCopyStateTimeout = window.setTimeout(function () {
              setCopyButtonState('', 'Copy', 'Copy citation');
            }, 2000);
          });
      });
    }

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
