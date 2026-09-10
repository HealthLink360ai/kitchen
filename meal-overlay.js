(function () {
  'use strict';
  var MONTH_KEY = 'hl360_meal_seen_2026_09';
  var memberKey = 'hl360_kitchen_member';

  function member() { try { return JSON.parse(localStorage.getItem(memberKey)); } catch (_) { return null; } }
  function track(name, properties) {
    var current = member(); if (!current || !current.email) return;
    fetch('/.netlify/functions/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      email: current.email, eventName: name, properties: Object.assign({ recipe: 'september-meal-of-the-month' }, properties || {})
    }) }).catch(function () {});
  }

  function enforceSubscription() {
    var checkbox = document.getElementById('g-waitlist');
    var form = document.getElementById('gate-form');
    if (!checkbox || !form) return;
    checkbox.required = true;
    var label = form.querySelector('.checkrow .lbl');
    if (label) label.textContent = 'Subscribe me to HealthLink360 Kitchen for monthly recipes and food-as-medicine updates. I can unsubscribe at any time.';
    var button = form.querySelector('button[type="submit"]');
    if (button && button.firstChild) button.firstChild.textContent = 'Subscribe & Enter ';
    form.addEventListener('submit', function (event) {
      if (!checkbox.checked) { event.preventDefault(); event.stopImmediatePropagation(); checkbox.focus(); }
    }, true);
  }

  function featureRecipe() {
    var wrap = document.querySelector('#recipes .wrap');
    var first = wrap && wrap.querySelector('.recipe-card');
    if (!first || document.getElementById('meal-feature-card')) return;
    var card = document.createElement('article');
    card.id = 'meal-feature-card'; card.className = 'recipe-card reveal visible'; card.setAttribute('data-recipe', 'september-meal-of-the-month');
    card.innerHTML = '<div class="rc-hero"><img src="/assets/september-meal-of-the-month.jpg" alt="Glazed chicken served with marinated tomatoes and charred okra over creamy polenta"><div class="rc-hero-scrim"></div><div class="rc-hero-content"><span class="month-badge">September 2026 · Meal of the Month</span><h3 class="rc-title">Marinated Tomatoes & Charred Okra over Polenta</h3><p class="rc-tagline">A late-summer bowl with glazed chicken as an optional protein.</p><a href="/meal-of-the-month.html" class="btn btn-pink" style="margin-top:16px">View Recipe</a></div></div>';
    first.parentNode.insertBefore(card, first);
    card.querySelector('a').addEventListener('click', function () { track('kitchen_meal_open', { source: 'featured_recipe' }); });
  }

  function showReveal() {
    if (!member() || sessionStorage.getItem(MONTH_KEY)) return;
    sessionStorage.setItem(MONTH_KEY, '1');
    var overlay = document.createElement('div'); overlay.id = 'meal-reveal';
    overlay.innerHTML = '<div class="meal-dialog" role="dialog" aria-modal="true" aria-labelledby="meal-title"><button class="meal-close" aria-label="Close">×</button><img src="/assets/september-meal-of-the-month.jpg" alt="Glazed chicken with marinated tomatoes and charred okra over polenta"><div class="meal-copy"><p>September · Meal of the Month</p><h2 id="meal-title">Marinated Tomatoes & Charred Okra over Polenta</h2><span>Glazed chicken is an optional protein.</span><a href="/meal-of-the-month.html">View Recipe</a></div></div>';
    document.body.appendChild(overlay);
    var style = document.createElement('style'); style.textContent = '#meal-reveal{position:fixed;inset:0;z-index:120;background:rgba(10,8,12,.76);display:grid;place-items:center;padding:20px}.meal-dialog{position:relative;width:min(880px,100%);display:grid;grid-template-columns:1.08fr .92fr;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.35)}.meal-dialog>img{width:100%;height:100%;object-fit:cover}.meal-copy{padding:clamp(28px,5vw,58px);display:flex;flex-direction:column;justify-content:center}.meal-copy p{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#c8208e}.meal-copy h2{font-family:Georgia,serif;font-weight:400;font-size:clamp(30px,4vw,48px);line-height:1.05;margin:8px 0 14px}.meal-copy span{color:#69616c}.meal-copy a{align-self:flex-start;margin-top:22px;padding:12px 18px;border-radius:99px;background:#17131c;color:#fff;text-decoration:none;font-weight:800}.meal-close{position:absolute;right:12px;top:10px;width:36px;height:36px;border:0;border-radius:50%;background:rgba(255,255,255,.9);font-size:25px;cursor:pointer}@media(max-width:680px){.meal-dialog{grid-template-columns:1fr}.meal-dialog>img{height:260px}.meal-copy{padding:26px}}'; document.head.appendChild(style);
    function close() { overlay.remove(); }
    overlay.querySelector('.meal-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('a').addEventListener('click', function () { track('kitchen_meal_open', { source: 'post_login_reveal' }); });
    track('kitchen_meal_reveal');
  }

  function waitForLogin() {
    var gate = document.getElementById('gate');
    if (!gate || gate.classList.contains('hidden')) return setTimeout(showReveal, 350);
    new MutationObserver(function () { if (gate.classList.contains('hidden')) setTimeout(showReveal, 350); }).observe(gate, { attributes: true, attributeFilter: ['class'] });
  }

  document.addEventListener('DOMContentLoaded', function () { enforceSubscription(); featureRecipe(); waitForLogin(); });
}());
