/* BiteBox 2.0 — Auth forms: show/hide password + login/signup via BiteBoxAuth.
   Replaces the old file.js handlers on these pages (file.js guards on form IDs;
   our handlers run after and own the flow). */
(function () {
  "use strict";

  var Auth = window.BiteBoxAuth;
  if (!Auth) return;

  /* ---------- Show / hide password ---------- */
  document.querySelectorAll(".pass-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.dataset.target);
      if (!input) return;
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "🙈" : "👁";
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  /* ---------- Helpers ---------- */
  function setError(form, name, msgText) {
    var err = form.querySelector(".field-error[data-for='" + name + "']");
    var input = form.querySelector("[name='" + name + "']");
    if (err) err.textContent = msgText || "";
    var wrap = input && input.closest(".field");
    if (wrap) wrap.classList.toggle("has-error", !!msgText);
  }
  function clearErrors(form) {
    form.querySelectorAll(".field-error").forEach(function (e) { e.textContent = ""; });
    form.querySelectorAll(".has-error").forEach(function (e) { e.classList.remove("has-error"); });
  }
  function loading(btn, on, label) {
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? "Please wait…" : label;
  }

  /* ---------- Login ---------- */
  var loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearErrors(loginForm);
      var btn = document.getElementById("login-submit");
      var email = loginForm.email.value.trim();
      var password = loginForm.password.value;

      var bad = false;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setError(loginForm, "email", "Enter a valid email address."); bad = true; }
      if (!password) { setError(loginForm, "password", "Enter your password."); bad = true; }
      if (bad) return;

      loading(btn, true, "Log in");
      Promise.resolve(Auth.login(email, password)).then(function (res) {
        loading(btn, false, "Log in");
        if (!res.ok) { setError(loginForm, "password", res.error); return; }
        btn.textContent = "Welcome back!";
        setTimeout(function () { window.location.href = "account.html"; }, 500);
      }).catch(function () {
        loading(btn, false, "Log in");
        setError(loginForm, "password", "Something went wrong. Please try again.");
      });
    });
    var forgot = document.getElementById("forgot-link");
    if (forgot) forgot.addEventListener("click", function (e) {
      e.preventDefault();
      if (window.BiteBoxAudio) BiteBoxAudio.play("click");
    });
  }

  /* ---------- Signup ---------- */
  var signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearErrors(signupForm);
      var btn = document.getElementById("signup-submit");

      var data = {
        name: signupForm.name.value,
        email: signupForm.email.value,
        phone: signupForm.phone ? signupForm.phone.value : "",
        password: signupForm.password.value,
        confirm: signupForm.confirm.value
      };

      /* Field-level pre-checks for nicer messages */
      var bad = false;
      if (String(data.name).trim().length < 2) { setError(signupForm, "name", "Please enter your full name."); bad = true; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(data.email).trim())) { setError(signupForm, "email", "Enter a valid email address."); bad = true; }
      if (data.phone && !/^[6-9]\d{9}$/.test(String(data.phone).replace(/\D/g, ""))) { setError(signupForm, "phone", "Enter a valid 10-digit mobile number."); bad = true; }
      if (String(data.password).length < 6) { setError(signupForm, "password", "Password must be at least 6 characters."); bad = true; }
      if (data.password !== data.confirm) { setError(signupForm, "confirm", "Passwords do not match."); bad = true; }
      if (bad) return;

      loading(btn, true, "Create account");
      Promise.resolve(Auth.signup(data)).then(function (res) {
        loading(btn, false, "Create account");
        if (!res.ok) {
          /* Surface duplicate-email etc. on the email field */
          setError(signupForm, /email/i.test(res.error) ? "email" : "password", res.error);
          return;
        }
        btn.textContent = "Account created!";
        setTimeout(function () { window.location.href = "account.html"; }, 500);
      }).catch(function () {
        loading(btn, false, "Create account");
        setError(signupForm, "password", "Something went wrong. Please try again.");
      });
    });
  }
})();
