// App bootstrap: wires up every module once the DOM is ready.
import { initCart } from "./modules/cart.js";
import { initProducts } from "./modules/products.js";
import { initSearch } from "./modules/search.js";
import { initReviews } from "./modules/reviews.js";
import { initAuth } from "./modules/auth.js";
import { byId } from "./modules/utils.js";
import { api } from "./modules/utils.js";
import { toast } from "./modules/toast.js";
import { setWhatsappNumber } from "./config.js";

function init() {
  byId("year").textContent = String(new Date().getFullYear());

  initCart();
  initProducts();
  initSearch();
  initReviews();
  initAuth();
  loadServerConfig();
  initMobileNav();
  initFooterForms();
}

// Pick up the confirmed WhatsApp number from the server once it answers.
// Until then, every link uses the static fallback in config.js.
async function loadServerConfig() {
  try {
    const config = await api("/config");
    setWhatsappNumber(config.whatsapp);
  } catch {
    // Server unreachable: config.js fallback stays in effect.
  }
}

function initMobileNav() {
  const menu = byId("menu-toggle");
  const nav = byId("primary-nav");

  menu.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  });

  nav.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      menu.setAttribute("aria-expanded", "false");
    })
  );
}

function initFooterForms() {
  const forms = [
    ["contact-form", "/contact", "Message sent."],
    ["newsletter-form", "/newsletter", "You're subscribed."],
  ];

  forms.forEach(([formId, path, successMessage]) => {
    byId(formId).addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const data = Object.fromEntries(new FormData(form));
      try {
        await api(path, { method: "POST", body: JSON.stringify(data) });
        form.reset();
        toast(successMessage);
      } catch (err) {
        toast(err.message, "error");
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", init);

