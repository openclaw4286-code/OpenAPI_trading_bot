/* 908 Docs — interactions.js
 * Scans every `.preview` on the page and wires up live interactions for the
 * standard component markup used across the docs. All components are static
 * HTML until this runs; after DOMContentLoaded everything is tappable.
 *
 * Binder is idempotent — each wiring tags its root with data-bound-<name> so
 * we never double-bind if called twice.
 */

(function () {
  'use strict';

  function $$(root, sel) { return [...(root || document).querySelectorAll(sel)]; }
  function once(el, key) { if (el.dataset[key]) return false; el.dataset[key] = '1'; return true; }

  // ---------- CHECKBOX ----------
  // markup: <div class="cb [on|ind|dis]"></div>
  function bindCheckbox(root) {
    $$(root, '.cb').forEach(cb => {
      if (!once(cb, 'boundCb')) return;
      if (cb.classList.contains('dis')) return;
      cb.style.cursor = 'pointer';
      cb.addEventListener('click', () => {
        // indeterminate → checked → unchecked → ...
        if (cb.classList.contains('ind')) { cb.classList.remove('ind'); cb.classList.add('on'); }
        else cb.classList.toggle('on');
      });
    });
  }

  // ---------- SWITCH ----------
  // markup: <div class="sw [on|dis]"></div>
  function bindSwitch(root) {
    $$(root, '.sw').forEach(sw => {
      if (!once(sw, 'boundSw')) return;
      if (sw.classList.contains('dis')) return;
      sw.style.cursor = 'pointer';
      sw.addEventListener('click', () => sw.classList.toggle('on'));
    });
  }

  // ---------- SEGMENT CONTROL ----------
  // markup: <div class="sg [s0|s1|s2]"><div class="pill"></div><button [class="on"]>…</button>…</div>
  function bindSegment(root) {
    $$(root, '.sg').forEach(sg => {
      if (!once(sg, 'boundSg')) return;
      const buttons = $$(sg, 'button');
      buttons.forEach((b, i) => b.addEventListener('click', () => {
        buttons.forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        sg.classList.remove('s0', 's1', 's2', 's3');
        sg.classList.add('s' + i);
      }));
    });
  }

  // ---------- TAB (underlined) ----------
  // markup: <div class="tb-row"><button [class="on"]>…</button>… <div class="tb-ind"></div></div>
  function bindTab(root) {
    $$(root, '.tb-row').forEach(row => {
      if (!once(row, 'boundTb')) return;
      const ind = row.querySelector('.tb-ind');
      const btns = $$(row, 'button');
      const place = (btn) => {
        if (!ind || !btn) return;
        const rRow = row.getBoundingClientRect();
        const rBtn = btn.getBoundingClientRect();
        ind.style.width = rBtn.width + 'px';
        ind.style.transform = `translateX(${rBtn.left - rRow.left}px)`;
      };
      btns.forEach(b => b.addEventListener('click', () => {
        btns.forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        place(b);
      }));
      // Initial position
      const active = row.querySelector('button.on') || btns[0];
      requestAnimationFrame(() => place(active));
    });
  }

  // ---------- STEPPER ----------
  // markup: <div class="st"><button [.dis]>−</button><span class="v">N</span><button [.dis]>+</button></div>
  function bindStepper(root) {
    $$(root, '.st').forEach(st => {
      if (!once(st, 'boundSt')) return;
      const [minus, , plus] = st.children;
      const val = st.querySelector('.v');
      const get = () => parseInt(val.textContent, 10) || 0;
      const set = (n) => { val.textContent = String(n); };
      if (minus && minus.tagName === 'BUTTON') minus.addEventListener('click', () => {
        if (minus.classList.contains('dis')) return;
        set(Math.max(0, get() - 1));
      });
      if (plus && plus.tagName === 'BUTTON') plus.addEventListener('click', () => {
        if (plus.classList.contains('dis')) return;
        set(get() + 1);
      });
    });
  }

  // ---------- SLIDER ----------
  // markup: <div class="sl"><div class="sl-tr"><div class="sl-fl"></div><div class="sl-hd"></div></div></div>
  function bindSlider(root) {
    $$(root, '.sl').forEach(sl => {
      if (!once(sl, 'boundSl')) return;
      const track = sl.querySelector('.sl-tr');
      const fill  = sl.querySelector('.sl-fl');
      const head  = sl.querySelector('.sl-hd');
      if (!track || !head) return;
      let dragging = false;
      const apply = (clientX) => {
        const r = track.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
        const pct = (p * 100).toFixed(2) + '%';
        if (fill) fill.style.width = pct;
        head.style.left = pct;
      };
      const start = (e) => {
        dragging = true;
        head.style.transition = 'none';
        if (fill) fill.style.transition = 'none';
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        apply(x);
      };
      const move = (e) => { if (!dragging) return;
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        apply(x);
      };
      const end = () => { dragging = false; };
      track.addEventListener('mousedown', start);
      track.addEventListener('touchstart', start, {passive: true});
      window.addEventListener('mousemove', move);
      window.addEventListener('touchmove', move, {passive: true});
      window.addEventListener('mouseup', end);
      window.addEventListener('touchend', end);
    });
  }

  // ---------- RATING ----------
  // markup: <div class="rt"><svg>…</svg>…</div>
  function bindRating(root) {
    $$(root, '.rt').forEach(rt => {
      if (!once(rt, 'boundRt')) return;
      const stars = $$(rt, 'svg');
      stars.forEach((s, i) => s.addEventListener('click', () => {
        stars.forEach((x, j) => x.setAttribute('fill', j <= i ? 'var(--accent-brand)' : 'var(--grey-200)'));
      }));
    });
  }

  // ---------- KEYPAD ----------
  // markup: <div class="kp"><button>1</button>…</div>
  // Adds a live display above the keypad showing the composed amount.
  function bindKeypad(root) {
    $$(root, '.kp').forEach(kp => {
      if (!once(kp, 'boundKp')) return;
      // Inject a display
      const disp = document.createElement('div');
      disp.style.cssText = 'width:100%;text-align:center;font-family:var(--font-mono);font-size:32px;font-weight:700;color:var(--text-primary);padding:8px 0 4px;letter-spacing:-.02em;min-height:44px';
      disp.textContent = '0';
      kp.parentNode.insertBefore(disp, kp);
      let v = '';
      const render = () => { disp.textContent = v === '' ? '0' : v; };
      $$(kp, 'button').forEach(b => b.addEventListener('click', () => {
        const k = b.textContent.trim();
        if (k === '⌫') v = v.slice(0, -1);
        else if (k === '.') { if (!v.includes('.')) v = (v || '0') + '.'; }
        else {
          if (v === '0') v = k;
          else v = (v + k).slice(0, 10);
        }
        render();
      }));
    });
  }

  // ---------- TEXTFIELD ----------
  // markup: <div class="tf [err]"><label>…</label><input /></div>
  // Give it live error-toggle if the label text is "IBAN" (keeps the demo lively);
  // otherwise just focus styles work (already CSS-driven).
  function bindTextfield(root) {
    $$(root, '.tf input').forEach(inp => {
      if (!once(inp, 'boundTf')) return;
      const tf = inp.closest('.tf');
      inp.addEventListener('input', () => {
        // IBAN rule: must start with QA and be 29 chars
        if (tf && tf.querySelector('label')?.textContent.trim() === 'IBAN') {
          const ok = /^QA\d{2}/i.test(inp.value.trim()) && inp.value.replace(/\s/g,'').length === 29;
          tf.classList.toggle('err', !ok && inp.value.length > 0);
        }
      });
    });
  }

  // ---------- SEARCH FIELD ----------
  // markup: <div class="sf"><svg>…</svg><input /><div class="x">×</div>?</div>
  function bindSearch(root) {
    $$(root, '.sf').forEach(sf => {
      if (!once(sf, 'boundSf')) return;
      const inp = sf.querySelector('input');
      let x = sf.querySelector('.x');
      const ensureX = () => {
        if (!x && inp?.value) {
          x = document.createElement('div');
          x.className = 'x';
          x.textContent = '×';
          sf.appendChild(x);
          x.addEventListener('click', () => { inp.value = ''; inp.dispatchEvent(new Event('input')); });
        }
      };
      if (x) x.addEventListener('click', () => { if (inp) { inp.value = ''; x.style.display = 'none'; } });
      if (inp) inp.addEventListener('input', () => {
        ensureX();
        if (x) x.style.display = inp.value ? 'flex' : 'none';
      });
    });
  }

  // ---------- BUTTON press feedback ----------
  // Generic — any <button> inside .preview gets a ripple-less press scale,
  // unless it already has animation class 'btn-anim'.
  function bindButtons(root) {
    $$(root, '.preview button').forEach(b => {
      if (!once(b, 'boundBtn')) return;
      if (b.classList.contains('btn-anim')) return;
      b.addEventListener('click', () => {
        // small count badge on buttons that look like "+" to feel alive
      });
    });
  }

  // ---------- OVERLAY TRIGGERS ----------
  // For Menu / Modal / Dialog / Bottom Sheet / Toast / Tooltip pages, add a
  // small "Toggle" button to the preview so the reader can actually dismiss
  // and re-open the overlay and feel the animation.
  const OVERLAY_KINDS = {
    'modal':        { label: 'Replay',    sel: '[style*="rgba(0,0,0,.32)"]' },
    'dialog':       { label: 'Replay',    sel: ':scope > div' },
    'bottom-sheet': { label: 'Replay',    sel: '[style*="rgba(0,0,0,.32)"]' },
    'menu':         { label: 'Replay',    sel: '[style*="box-shadow"]' },
    'toast':        { label: 'Replay',    sel: '[style*="grey-900"], [style*="state-negative"]' },
    'tooltip':      { label: 'Replay',    sel: '[style*="background:var(--grey-900)"]' },
    'bubble':       { label: 'Replay',    sel: ':scope > div' },
    'result':       { label: 'Replay',    sel: ':scope > div' },
    'bottom-info':  { label: 'Replay',    sel: ':scope > div' },
  };
  function bindReplay() {
    const id = document.body.dataset.component;
    if (!OVERLAY_KINDS[id]) return;
    $$(document, '.preview').forEach(pv => {
      if (!once(pv, 'boundReplay')) return;
      const btn = document.createElement('button');
      btn.textContent = '▶ ' + OVERLAY_KINDS[id].label;
      btn.style.cssText = 'position:absolute;top:12px;right:12px;padding:6px 12px;background:var(--grey-900);color:#fff;border:0;border-radius:99px;font-family:var(--font-sans);font-weight:600;font-size:11px;cursor:pointer;z-index:2;opacity:.8;transition:opacity .2s';
      btn.onmouseenter = () => btn.style.opacity = '1';
      btn.onmouseleave = () => btn.style.opacity = '.8';
      pv.style.position = 'relative';
      pv.appendChild(btn);
      btn.addEventListener('click', () => {
        const targets = pv.querySelectorAll(':scope > div');
        targets.forEach(t => {
          t.style.animation = 'none';
          // force reflow
          void t.offsetWidth;
          t.style.animation = 'ds-scale-in 620ms var(--ease-soft) both';
        });
      });
    });
  }

  // ---------- TOAST auto-dismiss loop ----------
  // The toast page has static toasts; make them pulse every ~4s.
  function bindToastLoop() {
    if (document.body.dataset.component !== 'toast') return;
    $$(document, '.preview > div > div').forEach((t, i) => {
      t.style.animation = `toastPulse 4s ${i * 300}ms var(--ease-soft) infinite`;
    });
    if (!document.getElementById('toast-kf')) {
      const s = document.createElement('style');
      s.id = 'toast-kf';
      s.textContent = `@keyframes toastPulse { 0%,90%,100%{transform:translateY(0);opacity:1} 95%{transform:translateY(-4px);opacity:.85} }`;
      document.head.appendChild(s);
    }
  }

  // ---------- MAIN ----------
  function bindAll(root) {
    bindCheckbox(root);
    bindSwitch(root);
    bindSegment(root);
    bindTab(root);
    bindStepper(root);
    bindSlider(root);
    bindRating(root);
    bindKeypad(root);
    bindTextfield(root);
    bindSearch(root);
    bindButtons(root);
    bindReplay();
    bindToastLoop();
  }

  // Expose for re-binding after dynamic content
  window.__908_bindInteractions = bindAll;

  function run() { bindAll(document); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // page.js runs on DOMContentLoaded too; schedule just after it.
      setTimeout(run, 0);
    });
  } else {
    setTimeout(run, 0);
  }
})();
