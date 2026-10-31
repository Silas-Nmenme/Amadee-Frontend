// Multi-step checkout: review cart, delivery details, payment method, confirm.
// All money fields shown here are estimates; the server recalculates and
// is the only source of truth for the final total.
import { api, safeText, formatNaira } from "./utils.js";
import { getCart, getSubtotal, whatsappUrl, clearCart } from "./cart.js";
import { openModal, closeModal } from "./modal.js";
import { toast } from "./toast.js";

// Must match server/routes/orders.js deliveryFees exactly.
const DELIVERY_OPTIONS = {
  pickup: { label: "Pick-up", fee: 0, time: "Coordinate a collection time" },
  lagos: { label: "Within Lagos", fee: 2000, time: "Estimated 2–5 business days" },
  outside: { label: "Outside Lagos", fee: 5000, time: "Estimated 4–8 business days" },
};

const PAYMENT_METHOD_LABELS = {
  paystack: "Pay online with Paystack",
  bank_transfer: "Bank transfer (manual confirmation)",
  pay_on_delivery: "Pay on delivery",
};

// Single source of truth for checkout state across steps, instead of a
// window global. Re-created each time the checkout dialog opens.
function createCheckoutState() {
  return {
    step: 1,
    deliveryOption: "pickup",
    paymentMethod: "",
    availablePaymentMethods: ["pay_on_delivery"],
    form: {
      name: "",
      email: "",
      phone: "",
      address: "",
      promoCode: "",
      bustChest: "",
      waist: "",
      hip: "",
      length: "",
      notes: "",
    },
  };
}

// Ask the server which payment methods are actually live. Falls back to
// pay-on-delivery only if /api/config is unreachable, since that is the
// one method guaranteed to work without any provider configured.
async function loadAvailablePaymentMethods() {
  try {
    const config = await api("/config");
    const methods = Object.entries(config.payments || {})
      .filter(([, enabled]) => enabled)
      .map(([key]) => (key === "bankTransfer" ? "bank_transfer" : key === "payOnDelivery" ? "pay_on_delivery" : key));
    return methods.length ? methods : ["pay_on_delivery"];
  } catch {
    return ["pay_on_delivery"];
  }
}
export function openCheckout() {
  if (!getCart().length) {
    toast("Your cart is empty.", "error");
    return;
  }

  const checkoutState = createCheckoutState();

  openModal("Checkout", (modal) => {
    const status = safeText("p", "Step 1 of 4 · Review cart", "eyebrow");
    const body = document.createElement("div");
    const actions = document.createElement("div");
    actions.className = "modal-actions";
    modal.append(status, body, actions);

    // Fetch which payment methods are actually live once, then redraw
    // step 3 if the customer is already there when it resolves.
    loadAvailablePaymentMethods().then((methods) => {
      checkoutState.availablePaymentMethods = methods;
      checkoutState.paymentMethod = methods[0];
      if (checkoutState.step === 3) draw();
    });

    const stepNames = ["Review cart", "Delivery details", "Payment", "Confirm order"];

    function draw() {
      body.replaceChildren();
      actions.replaceChildren();
      status.textContent = `Step ${checkoutState.step} of 4 · ${stepNames[checkoutState.step - 1]}`;

      if (checkoutState.step === 1) drawReviewStep(body);
      if (checkoutState.step === 2) drawDeliveryStep(body, checkoutState);
      if (checkoutState.step === 3) drawPaymentStep(body, checkoutState);
      if (checkoutState.step === 4) drawConfirmStep(body, checkoutState);

      drawActions(actions, checkoutState, body, draw);
    }

    draw();
  });
}

function drawReviewStep(body) {
  getCart().forEach((x) => {
    const optionText = [x.size, x.colour].filter(Boolean).join(" · ");
    body.append(
      safeText("p", `${x.product.name}${optionText ? ` (${optionText})` : ""} × ${x.quantity} — ${formatNaira(x.product.price * x.quantity)}`)
    );
  });
  body.append(safeText("p", `Subtotal: ${formatNaira(getSubtotal())}`, "cart-summary"));
}

// Step 2: contact + delivery + optional measurements, prefilled from
// checkoutState.form so going Back and Continue again does not lose data.
function drawDeliveryStep(body, checkoutState) {
  const form = document.createElement("form");
  form.id = "delivery-details";
  form.noValidate = true;

  const addField = (name, label, type, autocomplete, extra = {}) => {
    const fieldLabel = safeText("label", label);
    const input = document.createElement("input");
    input.name = name;
    input.type = type;
    input.required = true;
    input.autocomplete = autocomplete;
    input.value = checkoutState.form[name] || "";
    Object.assign(input, extra);
    fieldLabel.append(input);
    form.append(fieldLabel);
  };

  addField("name", "Full name", "text", "name");
  addField("email", "Email", "email", "email");
  addField("phone", "Phone number", "tel", "tel", { inputMode: "tel", placeholder: "080X XXX XXXX" });
  addField("address", "Delivery address", "text", "street-address");

  const deliveryLabel = safeText("label", "Delivery option");
  const deliverySelect = document.createElement("select");
  deliverySelect.name = "deliveryOption";
  Object.entries(DELIVERY_OPTIONS).forEach(([value, option]) => {
    const choice = document.createElement("option");
    choice.value = value;
    choice.textContent = `${option.label} — ${formatNaira(option.fee)} · ${option.time}`;
    deliverySelect.append(choice);
  });
  deliverySelect.value = checkoutState.deliveryOption;
  deliveryLabel.append(deliverySelect);
  form.append(deliveryLabel);

  const measurementFieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Optional made-to-measure measurements (cm)";
  measurementFieldset.append(legend);
  [["bustChest", "Bust / chest"], ["waist", "Waist"], ["hip", "Hip"], ["length", "Garment length"]].forEach(
    ([name, label]) => {
      const fieldLabel = safeText("label", label);
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = "300";
      input.name = name;
      input.value = checkoutState.form[name] || "";
      fieldLabel.append(input);
      measurementFieldset.append(fieldLabel);
    }
  );
  form.append(measurementFieldset);

  const notesLabel = safeText("label", "Custom notes");
  const notesField = document.createElement("textarea");
  notesField.name = "notes";
  notesField.maxLength = 1000;
  notesField.value = checkoutState.form.notes || "";
  notesLabel.append(notesField);
  form.append(notesLabel);

  const promoLabel = safeText("label", "Promo code (optional)");
  const promoInput = document.createElement("input");
  promoInput.name = "promoCode";
  promoInput.value = checkoutState.form.promoCode || "";
  promoLabel.append(promoInput);
  form.append(promoLabel);

  body.append(form);
}

// Step 3: pick a payment method, limited to what /api/config says is live.
function drawPaymentStep(body, checkoutState) {
  if (checkoutState.availablePaymentMethods.includes("paystack")) {
    body.append(safeText("p", "Choose how you'd like to pay."));
  } else {
    body.append(
      safeText(
        "p",
        "Online card payment is not available yet. Choose bank transfer or pay on delivery.",
        "notice"
      )
    );
  }

  const select = document.createElement("select");
  select.id = "payment-method";
  checkoutState.availablePaymentMethods.forEach((method) => {
    const option = document.createElement("option");
    option.value = method;
    option.textContent = PAYMENT_METHOD_LABELS[method] || method;
    select.append(option);
  });
  select.value = checkoutState.paymentMethod || checkoutState.availablePaymentMethods[0];
  select.addEventListener("change", () => {
    checkoutState.paymentMethod = select.value;
  });
  body.append(select);

  body.append(
    safeText(
      "p",
      "Estimated production time for made-to-measure items: 7–14 business days, subject to confirmation.",
      "notice"
    )
  );
}

// Step 4: final review before the order is sent to the server for real pricing.
function drawConfirmStep(body, checkoutState) {
  const delivery = DELIVERY_OPTIONS[checkoutState.deliveryOption];
  body.append(
    safeText("p", "Your order will be validated and priced again on the server before it is accepted."),
    safeText("p", `Delivery: ${delivery.label}. ${delivery.time}`),
    safeText("p", `Current estimate before server validation: ${formatNaira(getSubtotal() + delivery.fee)}`)
  );
}


// Builds the Back/Continue/Place order buttons and handles the
// step 2 -> 3 transition where the delivery form gets saved into state.
function drawActions(actions, checkoutState, body, draw) {
  if (checkoutState.step > 1) {
    const back = safeText("button", "Back", "button button-outline");
    back.type = "button";
    back.onclick = () => {
      checkoutState.step--;
      draw();
    };
    actions.append(back);
  }

  const isLastStep = checkoutState.step === 4;
  const next = safeText("button", isLastStep ? "Place order" : "Continue", "button");
  next.type = "button";
  next.onclick = () => handleNext(checkoutState, body, draw);
  actions.append(next);
}

async function handleNext(checkoutState, body, draw) {
  if (checkoutState.step === 2) {
    const form = body.querySelector("form");
    if (!form.reportValidity()) return;
    Object.assign(checkoutState.form, Object.fromEntries(new FormData(form)));
    checkoutState.deliveryOption = checkoutState.form.deliveryOption;
  }

  if (checkoutState.step < 4) {
    checkoutState.step++;
    draw();
    return;
  }

  await submitOrder(checkoutState);
}

// Send the order to the server, which recalculates every price. Only
// clear the cart once the server has confirmed the order (and, for a
// Paystack order, only after the customer is redirected to pay).
async function submitOrder(checkoutState) {
  const data = checkoutState.form;
  try {
    const order = await api("/orders", {
      method: "POST",
      body: JSON.stringify({
        customer: { name: data.name, email: data.email, phone: data.phone, address: data.address },
        items: getCart().map((x) => ({ productId: x.id, quantity: x.quantity, size: x.size, colour: x.colour })),
        deliveryOption: checkoutState.deliveryOption,
        promoCode: data.promoCode || "",
        measurements: {
          bustChest: data.bustChest,
          waist: data.waist,
          hip: data.hip,
          length: data.length,
          notes: data.notes,
        },
        paymentMethod: checkoutState.paymentMethod || "pay_on_delivery",
      }),
    });

    toast(`Order ${order.orderId} created.`);
    closeModal();

    if (order.authorizationUrl) {
      // Paystack redirect: clear the cart only after payment is verified
      // on payment-callback.html, not here.
      window.location.assign(order.authorizationUrl);
      return;
    }

    // Bank transfer / pay on delivery: the order is confirmed now, so it is
    // safe to clear the cart.
    clearCart();
    openModal("Order received", (modal) => {
      modal.append(
        safeText("p", `Order reference: ${order.orderId}`),
        safeText("p", order.message || "We will contact you to confirm the next steps.")
      );
      const whatsappLink = safeText("a", "Send cart via WhatsApp", "button button-outline");
      whatsappLink.href = whatsappUrl();
      whatsappLink.target = "_blank";
      whatsappLink.rel = "noopener noreferrer";
      modal.append(whatsappLink);
    });
  } catch (err) {
    toast(err.message, "error");
  }
}

