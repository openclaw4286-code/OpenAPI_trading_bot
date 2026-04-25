/* 908 Docs — page builder
 * Each component page defines a `PAGE` object; this renders the whole content area.
 *
 * PAGE = {
 *   id: "button", name: "Button", eyebrow: "Actions",
 *   lead: "string or html",
 *   sections: [
 *     { id:"overview", title:"Overview", html:"..." },
 *     { id:"variants", title:"Variants", preview:"html",
 *       props:[{name,type,default,desc}], code:"source" },
 *   ]
 * }
 */

function buildPage() {
  const P = window.PAGE;
  document.title = `908 Doha · ${P.name}`;
  document.body.dataset.component = P.id;
  if (new URLSearchParams(location.search).has('review')) document.body.classList.add('review');

  const c = document.getElementById("content");
  const lead = typeof P.lead === "string" ? P.lead : "";
  let html = `
    <div class="eyebrow">${P.eyebrow || "Component"}</div>
    <h1>${P.name}</h1>
    <p class="lead">${lead}</p>
  `;
  for (const s of P.sections || []) {
    html += `<h2 id="${s.id}">${s.title}</h2>`;
    if (s.html) html += s.html;
    if (s.preview) html += `<div class="preview ${s.previewMod || ''}">${s.preview}</div>`;
    if (s.props && s.props.length) {
      html += `<h3>Props</h3><table class="props"><thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead><tbody>`;
      for (const p of s.props) {
        html += `<tr><td><code>${p.name}</code></td><td><code>${p.type || '—'}</code></td><td>${p.default ? `<code>${p.default}</code>` : '<span style="color:var(--text-tertiary)">—</span>'}</td><td class="desc">${p.desc || ''}</td></tr>`;
      }
      html += `</tbody></table>`;
    }
    if (s.code) {
      html += `<pre class="code"><code>${s.code.replace(/</g,"&lt;")}</code></pre>`;
    }
  }
  html += `<div class="pagenav" id="pagenav"></div>`;
  c.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", buildPage);
