// @ts-check
/**
 * Spending-by-category chart (Req 7). Inline SVG pie/donut with a legend.
 * No dependencies.
 * @typedef {import('../types.js').CategorySpend} CategorySpend
 */
import { el } from '../lib/dom.js';
import { money } from '../lib/format.js';
import { t } from '../lib/i18n.js';

/** Distinct, readable colors on a black background. */
const PALETTE = [
  '#60a5fa', '#f87171', '#34d399', '#fbbf24', '#a78bfa',
  '#f472b6', '#22d3ee', '#fb923c', '#4ade80', '#e879f9',
  '#94a3b8', '#facc15',
];

/**
 * Build the spending chart node from category spend data.
 * @param {CategorySpend[]} data - already filtered (expenses, non-zero)
 * @returns {HTMLElement}
 */
export function spendingChart(data) {
  if (!data || data.length === 0) {
    return el('div', { class: 'empty' }, [
      el('span', { class: 'emoji', 'aria-hidden': 'true' }, '📈'),
      el('div', {}, t.chart.noExpenses),
    ]);
  }

  const total = data.reduce((s, d) => s + d.total, 0);
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const innerR = r * 0.58; // donut hole

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', t.chart.ariaLabel);

  // Single-slice case: draw a full ring instead of a degenerate arc.
  if (data.length === 1) {
    const ring = document.createElementNS(svgNS, 'circle');
    ring.setAttribute('cx', String(cx));
    ring.setAttribute('cy', String(cy));
    ring.setAttribute('r', String((r + innerR) / 2));
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', PALETTE[0]);
    ring.setAttribute('stroke-width', String(r - innerR));
    svg.appendChild(ring);
  } else {
    let angle = -Math.PI / 2; // start at top
    data.forEach((d, i) => {
      const frac = d.total / total;
      const next = angle + frac * Math.PI * 2;
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', donutSlice(cx, cy, r, innerR, angle, next));
      path.setAttribute('fill', PALETTE[i % PALETTE.length]);
      const pct = Math.round(frac * 100);
      const title = document.createElementNS(svgNS, 'title');
      title.textContent = `${d.categoryName}: ${money(d.total)} (${pct}%)`;
      path.appendChild(title);
      svg.appendChild(path);
      angle = next;
    });
  }

  // Center total label
  const centerLabel = el('div', { class: 'chart-center' }, [
    el('div', { style: 'font-size:0.72rem;color:var(--text-muted)' }, t.chart.spent),
    el('div', { style: 'font-size:1.05rem;font-weight:650' }, money(total)),
  ]);

  const svgWrap = el('div', {
    style:
      'position:relative;width:' + size + 'px;height:' + size + 'px;display:grid;place-items:center',
  });
  svgWrap.appendChild(svg);
  centerLabel.style.position = 'absolute';
  centerLabel.style.textAlign = 'center';
  svgWrap.appendChild(centerLabel);

  // Legend
  const legend = el(
    'div',
    { class: 'chart-legend' },
    data.map((d, i) => {
      const pct = Math.round((d.total / total) * 100);
      return el('div', { class: 'legend-row' }, [
        el('span', {
          class: 'legend-swatch',
          style: `background:${PALETTE[i % PALETTE.length]}`,
          'aria-hidden': 'true',
        }),
        el('span', { class: 'legend-name' }, d.categoryName),
        el('span', { class: 'legend-val' }, `${money(d.total)} · ${pct}%`),
      ]);
    })
  );

  return el('div', { class: 'chart-wrap' }, [svgWrap, legend]);
}

/**
 * SVG path for a donut slice between two angles (radians).
 * @param {number} cx @param {number} cy @param {number} rOuter
 * @param {number} rInner @param {number} a0 @param {number} a1
 * @returns {string}
 */
function donutSlice(cx, cy, rOuter, rInner, a0, a1) {
  const largeArc = a1 - a0 > Math.PI ? 1 : 0;
  const x0 = cx + rOuter * Math.cos(a0);
  const y0 = cy + rOuter * Math.sin(a0);
  const x1 = cx + rOuter * Math.cos(a1);
  const y1 = cy + rOuter * Math.sin(a1);
  const xi1 = cx + rInner * Math.cos(a1);
  const yi1 = cy + rInner * Math.sin(a1);
  const xi0 = cx + rInner * Math.cos(a0);
  const yi0 = cy + rInner * Math.sin(a0);
  return [
    `M ${x0} ${y0}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x1} ${y1}`,
    `L ${xi1} ${yi1}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${xi0} ${yi0}`,
    'Z',
  ].join(' ');
}
