// Account modal: sign in / create account tabs, email verification with
// resend, forgot password, and a signed-in menu once authenticated.
import { api, byId, safeText } from "./utils.js";
import { openModal, closeModal } from "./modal.js";
import { toast } from "./toast.js";

let currentUser = null;

export async function initAuth() {
  byId("open-auth").addEventListener("click", () => {
    if (currentUser) openAccountMenu();
    else openSignIn();
  });

  // Restore the session on page load so a refresh does not sign the
  // customer out of a still-valid cookie.
  try {
    const result = await api("/auth/me");
    setSignedIn(result.user);
  } catch {
    setSignedOut();
  }
}

function setSignedIn(user) {
  currentUser = user;
  const button = byId("open-auth");
  button.textContent = user.name.split(" ")[0] || "Account";
}

function setSignedOut() {
  currentUser = null;
  byId("open-auth").textContent = "Sign in";
}

// Shown once signed in: quick links plus sign out. "My orders" and
// "Wishlist" open their own views once those pages exist (Phase 2/4).
function openAccountMenu() {
  openModal("Your account", (modal) => {
    modal.append(safeText("p", `Signed in as ${currentUser.email}`));

    const links = document.createElement("div");
    links.className = "modal-actions";

    const orders = safeText("button", "My orders", "button button-outline");
    orders.type = "button";
    orders.onclick = () => toast("Order history is coming soon.");

    const wishlist = safeText("button", "Wishlist", "button button-outline");
    wishlist.type = "button";
    wishlist.onclick = () => toast("Open the heart icon on any product to view your wishlist items.");

    const signOut = safeText("button", "Sign out", "button");
    signOut.type = "button";
    signOut.onclick = async () => {
      try {
        await api("/auth/logout", { method: "POST" });
      } catch {
        // Clearing the cookie server-side may fail if the server is
        // unreachable; sign out locally regardless.
      }
      setSignedOut();
      toast("Signed out.");
      closeModal();
    };

    links.append(orders, wishlist, signOut);
    modal.append(links);
  });
}
// The main sign-in dialog: a tab switch between "Sign in" and
// "Create account", each with its own form so fields never get mixed up.
function openSignIn() {
  openModal("Account", (modal) => {
    const tabs = document.createElement("div");
    tabs.className = "modal-actions";
    const signInTab = safeText("button", "Sign in", "button");
    const signUpTab = safeText("button", "Create account", "button button-outline");
    signInTab.type = "button";
    signUpTab.type = "button";
    tabs.append(signInTab, signUpTab);
    modal.append(tabs);

    const body = document.createElement("div");
    modal.append(body);

    function showSignIn() {
      signInTab.className = "button";
      signUpTab.className = "button button-outline";
      body.replaceChildren(buildSignInForm());
    }

    function showSignUp() {
      signInTab.className = "button button-outline";
      signUpTab.className = "button";
      body.replaceChildren(buildSignUpForm());
    }

    signInTab.onclick = showSignIn;
    signUpTab.onclick = showSignUp;
    showSignIn();
  });
}

function buildSignInForm() {
  const form = document.createElement("form");
  form.className = "form-card";
  Object.assign(form.style, { boxShadow: "none", border: "0", padding: "0" });

  const emailLabel = safeText("label", "Email");
  const email = document.createElement("input");
  email.name = "email";
  email.type = "email";
  email.required = true;
  email.autocomplete = "email";
  emailLabel.append(email);

  const passwordLabel = safeText("label", "Password");
  const password = document.createElement("input");
  password.name = "password";
  password.type = "password";
  password.required = true;
  password.minLength = 8;
  password.autocomplete = "current-password";
  passwordLabel.append(password);

  const forgot = safeText("a", "Forgot your password?", "forgot-link");
  forgot.href = "#";
  forgot.onclick = (e) => {
    e.preventDefault();
    openForgotPassword();
  };

  const submit = safeText("button", "Sign in", "button");
  submit.type = "submit";

  form.append(emailLabel, passwordLabel, forgot, submit);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.value, password: password.value }),
      });
      setSignedIn(result.user);
      toast("Signed in successfully.");
      closeModal();
    } catch (err) {
      toast(err.message, "error");
    }
  });
  return form;
}


// Sign-up form, followed in place by the OTP verification step once the
// server confirms it has sent a code. Includes a Resend code button.
function buildSignUpForm() {
  const form = document.createElement("form");
  form.className = "form-card";
  Object.assign(form.style, { boxShadow: "none", border: "0", padding: "0" });

  const nameLabel = safeText("label", "Full name");
  const name = document.createElement("input");
  name.name = "name";
  name.required = true;
  name.autocomplete = "name";
  nameLabel.append(name);

  const emailLabel = safeText("label", "Email");
  const email = document.createElement("input");
  email.name = "email";
  email.type = "email";
  email.required = true;
  email.autocomplete = "email";
  emailLabel.append(email);

  const passwordLabel = safeText("label", "Password");
  const password = document.createElement("input");
  password.name = "password";
  password.type = "password";
  password.required = true;
  password.minLength = 8;
  password.autocomplete = "new-password";
  passwordLabel.append(password);

  const submit = safeText("button", "Create account", "button");
  submit.type = "submit";
  form.append(nameLabel, emailLabel, passwordLabel, submit);

  // Verification step, hidden until signup succeeds.
  const otpSection = document.createElement("div");
  otpSection.hidden = true;
  otpSection.append(safeText("p", "Enter the 6-digit code we emailed you."));

  const otpLabel = safeText("label", "Verification code");
  const otp = document.createElement("input");
  otp.name = "otp";
  otp.inputMode = "numeric";
  otp.autocomplete = "one-time-code";
  otp.pattern = "[0-9]{6}";
  otp.maxLength = 6;
  otp.placeholder = "123456";
  otpLabel.append(otp);
  otpSection.append(otpLabel);

  const otpActions = document.createElement("div");
  otpActions.className = "modal-actions";
  const verify = safeText("button", "Verify email code", "button");
  verify.type = "button";
  const resend = safeText("button", "Resend code", "button button-outline");
  resend.type = "button";
  otpActions.append(verify, resend);
  otpSection.append(otpActions);
  form.append(otpSection);

  verify.onclick = async () => {
    try {
      const result = await api("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.value, otp: otp.value }),
      });
      setSignedIn(result.user);
      toast("Email verified. You're signed in.");
      closeModal();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  resend.onclick = async () => {
    try {
      await api("/auth/resend-otp", { method: "POST", body: JSON.stringify({ email: email.value }) });
      toast("If that account needs verifying, a new code has been sent.");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name: name.value, email: email.value, password: password.value }),
      });
      toast("Verification code sent to your email.");
      [nameLabel, emailLabel, passwordLabel, submit].forEach((el) => (el.hidden = true));
      otpSection.hidden = false;
    } catch (err) {
      toast(err.message, "error");
    }
  });

  return form;
}

// A separate small dialog so "forgot password" does not have to share
// state with the sign-in/sign-up tabs.
function openForgotPassword() {
  openModal("Reset your password", (modal) => {
    const form = document.createElement("form");
    const emailLabel = safeText("label", "Email");
    const email = document.createElement("input");
    email.name = "email";
    email.type = "email";
    email.required = true;
    email.autocomplete = "email";
    emailLabel.append(email);
    form.append(emailLabel);

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const submit = safeText("button", "Send reset link", "button");
    submit.type = "submit";
    actions.append(submit);
    form.append(actions);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email.value }) });
        toast("If that account exists, a reset link has been sent.");
        closeModal();
      } catch (err) {
        toast(err.message, "error");
      }
    });

    modal.append(form);
  });
}


