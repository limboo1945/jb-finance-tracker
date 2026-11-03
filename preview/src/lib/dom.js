// @ts-check
/** Tiny DOM helpers to keep view code declarative without a framework. */

/**
 * Create an element with props and children.
 * @param {string} tag
 * @param {Object} [props] - attributes/props; `class`, `dataset`, `on*` events, `html`
 * @param {(Node|string|null|undefined|Array<Node|string|null|undefined>)} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') {
      for (const [dk, dv] of Object.entries(value)) node.dataset[dk] = String(dv);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'for') {
      node.setAttribute('for', value);
    } else if (key in node && key !== 'list') {
      // @ts-ignore - assign DOM props like value, checked, disabled
      node[key] = value;
    } else {
      node.setAttribute(key, String(value));
    }
  }
  appendChildren(node, children);
  return node;
}

/**
 * @param {HTMLElement} node
 * @param {(Node|string|null|undefined|Array<Node|string|null|undefined>)} children
 */
export function appendChildren(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    node.appendChild(
      typeof child === 'string' ? document.createTextNode(child) : child
    );
  }
}

/**
 * Replace all children of a node.
 * @param {HTMLElement} node
 * @param {(Node|string|null|undefined|Array<Node|string|null|undefined>)} children
 */
export function render(node, children) {
  node.textContent = '';
  appendChildren(node, children);
}

/**
 * Clear a node.
 * @param {HTMLElement} node
 */
export function clear(node) {
  node.textContent = '';
}
