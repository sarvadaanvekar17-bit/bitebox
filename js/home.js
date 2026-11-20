/* BiteBox 2.0 — Homepage interactions (homepage only).
   Relies on file.js for cart, theme, reveal and tilt. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* Mobile nav toggle lives in file.js (all pages). */

  /* ---------- Audio toggle (mutes the add-to-cart chime in file.js) ---------- */
  var audioToggle = document.getElementById("audio-toggle");
  var audioIcon = audioToggle && audioToggle.querySelector(".audio-icon");

  function applyAudioState() {
    var muted = window.BB_AUDIO_MUTED === true;
    if (audioToggle) audioToggle.setAttribute("aria-pressed", String(!muted));
    if (audioIcon) audioIcon.textContent = muted ? "🔇" : "🔊";
  }

  try {
    window.BB_AUDIO_MUTED = localStorage.getItem("biteboxAudio") === "muted";
  } catch (e) { /* storage unavailable */ }
  applyAudioState();

  if (audioToggle) {
    audioToggle.addEventListener("click", function () {
      window.BB_AUDIO_MUTED = !window.BB_AUDIO_MUTED;
      try { localStorage.setItem("biteboxAudio", window.BB_AUDIO_MUTED ? "muted" : "on"); } catch (e) {}
      applyAudioState();
    });
  }

  /* ---------- Hero 3D parallax (desktop pointer only) ---------- */
  var stage = document.getElementById("hero-stage");
  var hero = document.getElementById("hero-visual");

  if (stage && hero && !reduceMotion.matches) {
    var raf = null;
    var tx = 0, ty = 0, px = 0, py = 0;

    function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

    hero.addEventListener("pointermove", function (event) {
      if (event.pointerType === "touch") return;
      var rect = hero.getBoundingClientRect();
      var nx = (event.clientX - rect.left) / rect.width - 0.5;
      var ny = (event.clientY - rect.top) / rect.height - 0.5;
      tx = clamp(nx * 14, -14, 14);   /* rotateY */
      ty = clamp(-ny * 10, -10, 10);  /* rotateX */
      px = clamp(nx * 18, -18, 18);
      py = clamp(ny * 14, -14, 14);
      if (!raf) raf = requestAnimationFrame(apply);
    });

    hero.addEventListener("pointerleave", function () {
      tx = ty = px = py = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    });

    function apply() {
      raf = null;
      stage.style.setProperty("--ry", tx.toFixed(2) + "deg");
      stage.style.setProperty("--rx", ty.toFixed(2) + "deg");
      stage.style.setProperty("--px", px.toFixed(1) + "px");
      stage.style.setProperty("--py", py.toFixed(1) + "px");
    }

    /* Gentle scroll drift */
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking || reduceMotion.matches) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var drift = Math.min(window.scrollY * 0.06, 40);
        stage.style.setProperty("--scroll-drift", drift.toFixed(1) + "px");
      });
    }, { passive: true });
  }
})();
