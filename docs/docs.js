/* 908 Docs — shared shell JS
 * Builds sidebar + on-this-page from a single `components` registry.
 * Pages just set data attributes on <body>.
 */

window.COMPONENTS = [
  // Section, entries in display order
  { section: "Foundations", items: [
    { id: "colors",   name: "Colors" },
    { id: "type",     name: "Typography" },
    { id: "motion",   name: "Motion" },
    { id: "spacing",  name: "Spacing & Radius" },
  ]},
  { section: "Actions", items: [
    { id: "button",        name: "Button" },
    { id: "text-button",   name: "Text Button" },
    { id: "icon-button",   name: "Icon Button" },
    { id: "bottom-cta",    name: "Bottom CTA" },
  ]},
  { section: "Inputs", items: [
    { id: "textfield",       name: "Textfield" },
    { id: "search-field",    name: "Search Field" },
    { id: "checkbox",        name: "Checkbox" },
    { id: "switch",          name: "Switch" },
    { id: "slider",          name: "Slider" },
    { id: "stepper",         name: "Numeric Stepper" },
    { id: "numeric-spinner", name: "Numeric Spinner" },
    { id: "rating",          name: "Rating" },
    { id: "keypad",          name: "Keypad" },
    { id: "segment-control", name: "Segment Control" },
    { id: "tab",             name: "Tab" },
  ]},
  { section: "Containment", items: [
    { id: "badge",         name: "Badge" },
    { id: "highlight",     name: "Highlight" },
    { id: "border",        name: "Border" },
    { id: "grid-list",     name: "Grid List" },
    { id: "asset",         name: "Asset" },
    { id: "chart",         name: "Chart" },
  ]},
  { section: "Rows & Lists", items: [
    { id: "list-header",   name: "List Header" },
    { id: "list-row",      name: "List Row" },
    { id: "board-row",     name: "Board Row" },
    { id: "table-row",     name: "Table Row" },
    { id: "list-footer",   name: "List Footer" },
    { id: "post",          name: "Post" },
    { id: "paragraph",     name: "Paragraph" },
    { id: "agreement",     name: "Agreement" },
  ]},
  { section: "Feedback", items: [
    { id: "loader",           name: "Loader" },
    { id: "skeleton",         name: "Skeleton" },
    { id: "progress-bar",     name: "Progress Bar" },
    { id: "progress-stepper", name: "Progress Stepper" },
    { id: "result",           name: "Result" },
    { id: "toast",            name: "Toast" },
    { id: "tooltip",          name: "Tooltip" },
    { id: "bubble",           name: "Bubble" },
    { id: "bottom-info",      name: "Bottom Info" },
  ]},
  { section: "Overlays", items: [
    { id: "menu",         name: "Menu" },
    { id: "modal",        name: "Modal" },
    { id: "dialog",       name: "Dialog" },
    { id: "bottom-sheet", name: "Bottom Sheet" },
    { id: "top",          name: "Top (App Bar)" },
  ]},
];

// Flatten for prev/next
window.FLAT_COMPONENTS = (() => {
  const flat = [];
  for (const s of window.COMPONENTS) for (const i of s.items) flat.push({ ...i, section: s.section });
  return flat;
})();

function renderShell(currentId) {
  const BASE = window.__DOCS_BASE || './';
  const side = document.getElementById("sidebar");
  if (side) {
    const groups = window.COMPONENTS.map(sec => `
      <div class="group">
        <div class="group-label">${sec.section}</div>
      </div>
      <nav class="nav">
        ${sec.items.map(it => `
          <a href="${BASE}${it.id}.html" class="${it.id === currentId ? 'active' : ''}">${it.name}</a>
        `).join('')}
      </nav>
    `).join('');
    side.innerHTML = `
      <a href="${BASE}index.html" class="brand" style="text-decoration:none;color:inherit;">
        <div class="mark">908</div>
        <div>
          <div class="name">908 Doha</div>
          <div class="sub">Design System</div>
        </div>
      </a>
      ${groups}
    `;
    // Stagger sidebar links
    side.querySelectorAll('.nav a').forEach((a, i) => a.style.setProperty('--i', i));
  }
  // On this page — build from h2[id]
  const otp = document.getElementById("otp");
  if (otp) {
    const h2s = document.querySelectorAll(".content h2[id]");
    otp.innerHTML = `
      <div class="otp-label">On this page</div>
      ${[...h2s].map(h => `<a href="#${h.id}">${h.textContent}</a>`).join('')}
    `;
    otp.querySelectorAll('a').forEach((a, i) => a.style.setProperty('--i', i));
  }
  // Stagger preview inner children
  document.querySelectorAll('.content .preview').forEach(pv => {
    [...pv.children].forEach((c, i) => c.style.setProperty('--ci', i));
  });
  // Mark later sections (after the 1st h2) for in-view reveal
  const heads = [...document.querySelectorAll('.content h2, .content h3')];
  if (heads.length > 1) {
    heads.slice(1).forEach(h => {
      let el = h;
      while (el && el.tagName !== 'H1' && !(el.classList && el.classList.contains('pagenav'))) {
        if (el !== h && (el.tagName === 'H2' || el.tagName === 'H1')) break;
        if (el.classList) el.classList.add('rv');
        el = el.nextElementSibling;
        if (!el) break;
      }
    });
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    document.querySelectorAll('.content .rv').forEach(el => io.observe(el));
  }
  // Prev/next
  const pn = document.getElementById("pagenav");
  if (pn && currentId) {
    const idx = window.FLAT_COMPONENTS.findIndex(c => c.id === currentId);
    const prev = window.FLAT_COMPONENTS[idx - 1];
    const next = window.FLAT_COMPONENTS[idx + 1];
    pn.innerHTML = `
      ${prev ? `<a href="${BASE}${prev.id}.html" class="prev"><span class="d">← Previous</span><span class="t">${prev.name}</span></a>` : '<span></span>'}
      ${next ? `<a href="${BASE}${next.id}.html" class="next"><span class="d">Next →</span><span class="t">${next.name}</span></a>` : ''}
    `;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const cur = document.body.dataset.component;
  renderShell(cur);
});
