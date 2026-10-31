// Static fallback configuration, used until the server's /api/config
// endpoint has answered (or if the server is unreachable).
// Do not put secrets here: this file ships to every visitor's browser.

// [CONFIRM] Keep this in sync with SHOP_OWNER_WHATSAPP on the server once
// GET /api/config is wired up in Phase 2.
const FALLBACK_WHATSAPP_NUMBER = "2349034063970";

let liveWhatsappNumber = null;

// Called once the real /api/config response has loaded, so every module
// that builds a WhatsApp link uses the confirmed number instead of the
// fallback baked into this file.
export function setWhatsappNumber(number) {
  if (number) liveWhatsappNumber = String(number).replace(/\D/g, "");
}

export function getWhatsappNumber() {
  return liveWhatsappNumber || FALLBACK_WHATSAPP_NUMBER;
}
