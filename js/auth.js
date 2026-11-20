/* BiteBox 2.0 — Authentication.
   API-first: when the Spring Boot backend is reachable, signup/login return a
   JWT (stored via BB_API) and accounts persist server-side with BCrypt hashes.
   When the backend is offline, falls back to the demo localStorage store
   (djb2 hash — NOT production security; demo only). */
(function () {
  "use strict";

  var USERS_KEY = "biteboxUsers";
  var USER_KEY = "biteboxUser";

  function read(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  /* Same non-cryptographic hash file.js uses — kept for compatibility. */
  function hashPassword(value) {
    var text = String(value || ""), hash = 5381;
    for (var i = 0; i < text.length; i++) hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    return "h" + (hash >>> 0).toString(36);
  }

  function users() { var u = read(USERS_KEY, []); return Array.isArray(u) ? u : []; }
  function currentUser() {
    var u = read(USER_KEY, null);
    return u && u.email ? u : null;
  }
  function publicUser(u) {
    if (!u) return null;
    return { id: u.id, name: u.name, email: u.email, phone: u.phone || "", createdAt: u.createdAt };
  }

  var Auth = {
    currentUser: function () { return publicUser(currentUser()); },
    isLoggedIn: function () { return !!currentUser(); },

    logout: function () {
      try { localStorage.removeItem(USER_KEY); } catch (e) {}
      if (window.BB_API) BB_API.clearSession();
    },

    /* API-first signup: real backend when reachable, demo store as fallback. */
    signup: async function (data) {
      var name = String(data.name || "").trim();
      var email = String(data.email || "").trim().toLowerCase();
      var phone = String(data.phone || "").replace(/\D/g, "").slice(0, 10);
      var password = String(data.password || "");
      if (name.length < 2) return { ok: false, error: "Please enter your full name." };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "Enter a valid email address." };
      if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
      if (password !== String(data.confirm || "")) return { ok: false, error: "Passwords do not match." };

      if (window.BB_API) {
        try {
          var res = await BB_API.auth.register(name, email, phone, password);
          BB_API.setSession(res);
          var apiUser = { id: "api-" + res.userId, name: res.name, email: res.email, phone: res.phone || "", role: res.role, createdAt: new Date().toISOString() };
          write(USER_KEY, apiUser);
          return { ok: true, user: publicUser(apiUser) };
        } catch (e) {
          if (e && e.status) return { ok: false, error: e.message || "Sign up failed." };
          /* network failure → demo fallback below */
        }
      }

      var list = users();
      if (list.some(function (u) { return String(u.email).toLowerCase() === email; })) {
        return { ok: false, error: "An account with this email already exists. Try logging in." };
      }
      var user = {
        id: "u" + Date.now().toString(36),
        name: name, email: email, phone: phone,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString()
      };
      list.push(user);
      write(USERS_KEY, list);
      write(USER_KEY, user);
      return { ok: true, user: publicUser(user) };
    },

    /* API-first login: JWT session when backend reachable, demo store as fallback. */
    login: async function (email, password) {
      var target = String(email || "").trim().toLowerCase();

      if (window.BB_API) {
        try {
          var res = await BB_API.auth.login(target, String(password || ""));
          BB_API.setSession(res);
          var apiUser = { id: "api-" + res.userId, name: res.name, email: res.email, phone: res.phone || "", role: res.role, createdAt: new Date().toISOString() };
          write(USER_KEY, apiUser);
          return { ok: true, user: publicUser(apiUser) };
        } catch (e) {
          if (e && e.status === 401) return { ok: false, error: e.message || "Invalid email or password." };
          if (e && e.status) return { ok: false, error: e.message || "Login failed." };
          /* network failure → demo fallback below */
        }
      }

      var user = users().find(function (u) { return String(u.email).toLowerCase() === target; });
      if (!user || user.passwordHash !== hashPassword(String(password || ""))) {
        return { ok: false, error: "Invalid email or password." };
      }
      write(USER_KEY, user);
      return { ok: true, user: publicUser(user) };
    },

    updateProfile: function (patch) {
      var current = currentUser();
      if (!current) return { ok: false, error: "Not logged in." };
      var list = users();
      var idx = list.findIndex(function (u) { return u.id === current.id; });
      if (idx === -1) return { ok: false, error: "Account not found." };
      var name = String(patch.name || "").trim();
      var phone = String(patch.phone || "").replace(/\D/g, "").slice(0, 10);
      if (name.length < 2) return { ok: false, error: "Name is too short." };
      list[idx].name = name;
      list[idx].phone = phone;
      write(USERS_KEY, list);
      write(USER_KEY, list[idx]);
      return { ok: true, user: publicUser(list[idx]) };
    }
  };

  window.BiteBoxAuth = Auth;
})();
