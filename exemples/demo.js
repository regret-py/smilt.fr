/*
 * smilt. · comportement commun des sites de démonstration (/exemples/)
 * Un lien, un bouton ou un formulaire marqué data-demo="…" ne part nulle part : il affiche ce texte dans une bulle
 * (« Démo : sur le vrai site, ce bouton ouvre l'itinéraire dans Google Maps. »). JavaScript ES5, sans dépendance.
 */
(function () {
  'use strict';
  var toast = null, timer = null;
  function show(msg) {
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'smilt-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('on');
    clearTimeout(timer);
    timer = setTimeout(function () { toast.classList.remove('on'); }, 4200);
  }
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-demo]') : null;
    if (!el || el.tagName === 'FORM') return;
    e.preventDefault();
    show(el.getAttribute('data-demo'));
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || !f.hasAttribute || !f.hasAttribute('data-demo')) return;
    e.preventDefault();
    show(f.getAttribute('data-demo'));
  });
  window.smiltDemo = { toast: show };
})();
