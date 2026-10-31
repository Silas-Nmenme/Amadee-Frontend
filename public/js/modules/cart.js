// Shopping cart state, persistence and cart drawer rendering.
import { products } from "../data/products.js";
import { byId, formatNaira, safeText } from "./utils.js";
import { openModal, closeModal } from "./modal.js";
import { toast } from "./toast.js";
import { getWhatsappNumber } from "./config.js";

const STORAGE_KEY = "amadee-stiches-cart-v1";

let cart = load();

// Load the cart from localStorage, dropping any lines that no longer
// match a real product or have a broken quantity.
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return raw.filter(
      (item) =>
        products.some((p) => p.id === item.id) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0
    );
  } catch {
    return [];
  }
}

// Save the cart, update the header badge and let other modules know it changed.
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  renderBadge();
  window.dispatchEvent(new CustomEvent("amadee:cart-change", { detail: { cart: [...cart] } }));
}

export const getCart = () =>
  cart.map((item) => ({ ...item, product: products.find((p) => p.id === item.id) }));

export const getSubtotal = () =>
  getCart().reduce((sum, x) => sum + x.product.price * x.quantity, 0);

export function addToCart(id, quantity = 1, options = {}) {
  const product = products.find((x) => x.id === id);
  if (!product || !product.inStock) {
    toast("This item is currently unavailable.", "error");
    return;
  }
  const size = options.size || "";
  const colour = options.colour || "";
  const existing = cart.find((x) => x.id === id && x.size === size && x.colour === colour);
  if (existing) {
    existing.quantity = Math.min(20, existing.quantity + quantity);
  } else {
    cart.push({ id, quantity: Math.max(1, Math.min(20, quantity)), size, colour });
  }
  persist();
  toast("Added to your cart.");
}

export function updateQuantity(index, delta) {
  if (!cart[index]) return;
  cart[index].quantity = Math.max(1, Math.min(20, cart[index].quantity + delta));
  persist();
}

export function removeItem(index) {
  cart.splice(index, 1);
  persist();
}

export function clearCart() {
  cart = [];
  persist();
}

function renderBadge() {
  const count = cart.reduce((sum, x) => sum + x.quantity, 0);
  const badge = byId("cart-count");
  badge.textContent = String(count);
  badge.setAttribute("aria-label", `${count} items in cart`);
}
export function openCart() {
  openModal("Your shopping cart", (modal) => renderCartInto(modal));
}

// Build the contents of the cart drawer/modal from scratch each time it is shown.
function renderCartInto(modal) {
  const items = getCart();
  if (!items.length) {
    modal.append(safeText("p", "Your cart is empty."));
    const link = safeText("a", "Explore products", "button");
    link.href = "#products";
    link.addEventListener("click", closeModal);
    modal.append(link);
    return;
  }

  const list = document.createElement("div");
  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "cart-row";

    const left = document.createElement("div");
    const optionText = [item.size, item.colour].filter(Boolean).join(" · ");
    left.append(
      safeText("strong", item.product.name),
      safeText("p", `${formatNaira(item.product.price)} each${optionText ? ` · ${optionText}` : ""}`)
    );

    const controls = document.createElement("div");
    controls.className = "quantity-controls";

    const minus = safeText("button", "−");
    minus.type = "button";
    minus.setAttribute("aria-label", `Decrease quantity of ${item.product.name}`);
    minus.onclick = () => {
      updateQuantity(index, -1);
      refresh();
    };

    const plus = safeText("button", "+");
    plus.type = "button";
    plus.setAttribute("aria-label", `Increase quantity of ${item.product.name}`);
    plus.onclick = () => {
      updateQuantity(index, 1);
      refresh();
    };

    const remove = safeText("button", "Remove", "button button-outline");
    remove.type = "button";
    remove.onclick = () => {
      removeItem(index);
      refresh();
    };

    controls.append(minus, safeText("span", item.quantity), plus, remove);
    row.append(left, controls, safeText("strong", formatNaira(item.product.price * item.quantity)));
    list.append(row);
  });
  modal.append(list);

  const summary = document.createElement("div");
  summary.className = "cart-summary";
  summary.append(safeText("span", "Subtotal"), safeText("strong", formatNaira(getSubtotal())));
  modal.append(summary);

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const whatsapp = safeText("a", "Order via WhatsApp", "button button-outline");
  whatsapp.target = "_blank";
  whatsapp.rel = "noopener noreferrer";
  whatsapp.href = whatsappUrl();
  actions.append(whatsapp);

  const checkout = safeText("button", "Continue to checkout", "button");
  checkout.type = "button";
  checkout.onclick = () => {
    closeModal();
    openCheckout();
  };
  actions.append(checkout);
  modal.append(actions);
}

// Re-draw the open cart dialog in place, preserving its title and focus trap.
function refresh() {
  const modal = document.querySelector("#modal-root .modal");
  if (!modal) return;
  const title = modal.querySelector("h2")?.textContent || "Your shopping cart";
  modal.replaceChildren();

  const close = document.createElement("button");
  close.className = "modal-close";
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close dialog");
  close.onclick = closeModal;

  modal.append(close, safeText("h2", title));
  renderCartInto(modal);
}

// Build a WhatsApp order message including every chosen size/colour.
export function whatsappUrl() {
  const lines = getCart().map((x) => {
    const optionText = [x.size, x.colour].filter(Boolean).join(", ");
    return `${x.product.name}${optionText ? ` (${optionText})` : ""} x${x.quantity} — ${formatNaira(x.product.price * x.quantity)}`;
  });
  const message = `Hello Amadee-Stiches, I'd like to order:\n${lines.join("\n")}\nSubtotal: ${formatNaira(getSubtotal())}`;
  return `https://wa.me/${getWhatsappNumber()}?text=${encodeURIComponent(message)}`;
}

function openCheckout() {
  import("./checkout.js").then((m) => m.openCheckout());
}

export function initCart() {
  renderBadge();
  byId("open-cart").addEventListener("click", openCart);
}

