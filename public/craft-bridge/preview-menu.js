(function craftBridgePreviewMenu() {
  "use strict";

  var script = document.currentScript;
  var craftUrl = (script && script.getAttribute("data-craft-url")) || "http://localhost:3000";
  var repoRoot = (script && script.getAttribute("data-repo-root")) || "";
  var bridgeToken = (script && script.getAttribute("data-bridge-token")) || "";

  var MENU_ID = "craft-bridge-preview-menu";
  var TOAST_ID = "craft-bridge-preview-toast";
  var FLOAT_BTN_ID = "craft-bridge-push-fab";

  var HOME_HEADER_TABS = ["portfolio", "ipos", "nfo", "mtf"];

  var ONBOARDING_STEP_HINTS = [
    ["signature-draw", "Draw your signature"],
    ["signature", "Add signature"],
    ["mobile", "Enter mobile number"],
    ["otp", "Enter OTP"],
    ["welcome", "Invest in Stocks with Expert Advice"],
    ["add-email", "Add email"],
    ["enter-email", "Enter your email"],
    ["confirm-pan", "Confirm PAN details"],
    ["tell-us-more", "Tell us more about you"],
    ["verify-address", "Verify address via Aadhaar"],
    ["setup-pin", "Set up PIN"],
    ["enable-biometric", "Enable biometric login"],
  ];

  function isCraftPushTarget(target) {
    if (!(target instanceof Element)) return false;
    if (target.closest("[data-craft-screen-ignore]")) return false;
    if (target.closest("#" + MENU_ID)) return false;
    if (target.closest("#" + FLOAT_BTN_ID)) return false;
    return true;
  }

  function removeEl(id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  }

  function showToast(text, kind) {
    removeEl(TOAST_ID);
    var toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.textContent = text;
    toast.style.cssText =
      "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483646;" +
      "max-width:min(92vw,420px);padding:10px 14px;border-radius:12px;font:500 13px/1.4 system-ui,sans-serif;" +
      "color:#fff;box-shadow:0 8px 32px rgba(0,0,0,.35);" +
      (kind === "error" ? "background:#7f1d1d;" : "background:#14532d;");
    document.body.appendChild(toast);
    window.setTimeout(function () {
      removeEl(TOAST_ID);
    }, 4500);
  }

  function showMenu(x, y) {
    removeEl(MENU_ID);
    var menu = document.createElement("div");
    menu.id = MENU_ID;
    menu.style.cssText =
      "position:fixed;z-index:2147483647;min-width:200px;padding:6px 0;" +
      "border-radius:10px;background:#1a1a1a;border:1px solid rgba(255,255,255,.12);" +
      "box-shadow:0 12px 40px rgba(0,0,0,.45);font:500 13px/1.2 system-ui,sans-serif;color:#f5f5f5;";

    var item = document.createElement("button");
    item.type = "button";
    item.textContent = "Push to Craft canvas";
    item.style.cssText =
      "display:block;width:100%;text-align:left;padding:10px 14px;border:0;background:transparent;" +
      "color:inherit;cursor:pointer;font:inherit;";
    item.onmouseenter = function () {
      item.style.background = "rgba(255,255,255,.08)";
    };
    item.onmouseleave = function () {
      item.style.background = "transparent";
    };
    item.onclick = function () {
      removeEl(MENU_ID);
      void pushToCraft();
    };

    menu.appendChild(item);
    document.body.appendChild(menu);

    var rect = menu.getBoundingClientRect();
    var left = Math.min(x, window.innerWidth - rect.width - 8);
    var top = Math.min(y, window.innerHeight - rect.height - 8);
    menu.style.left = Math.max(8, left) + "px";
    menu.style.top = Math.max(8, top) + "px";
  }

  function ensureFloatingPushButton() {
    if (document.documentElement.getAttribute("data-craft-hide-push-button") === "1") return;
    if (document.getElementById(FLOAT_BTN_ID)) return;

    var btn = document.createElement("button");
    btn.id = FLOAT_BTN_ID;
    btn.type = "button";
    btn.title = "Push to Craft canvas (Alt+Shift+P)";
    btn.setAttribute("aria-label", "Push to Craft canvas");
    btn.textContent = "Push to Craft";
    btn.style.cssText =
      "position:fixed;bottom:20px;right:20px;z-index:2147483645;" +
      "padding:10px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.18);" +
      "background:rgba(20,83,45,.92);color:#fff;font:600 12px/1 system-ui,sans-serif;" +
      "cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.35);backdrop-filter:blur(8px);";
    btn.onmouseenter = function () {
      btn.style.background = "rgba(22,101,52,.98)";
    };
    btn.onmouseleave = function () {
      btn.style.background = "rgba(20,83,45,.92)";
    };
    btn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      void pushToCraft();
    };
    document.body.appendChild(btn);
  }

  function authHeaders() {
    var headers = { "Content-Type": "application/json" };
    if (bridgeToken) {
      headers.Authorization = "Bearer " + bridgeToken;
      headers["X-Craft-Bridge-Token"] = bridgeToken;
    }
    return headers;
  }

  function slugTabLabel(text) {
    return String(text || "")
      .replace(/\d+/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function isStorybookPreview() {
    try {
      var href = window.location.href;
      var path = window.location.pathname || "";
      if (/iframe\.html$/i.test(path)) return true;
      if (new URL(href).searchParams.has("path")) return true;
    } catch (e) {}
    return !!document.querySelector("#storybook-root, .sb-show-main, [data-is-storybook='true']");
  }

  function usesPmlScreenRouting() {
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.has("screen")) return true;
    } catch (e) {}
    return !!document.querySelector(
      ".pml-home, .pml-signup, .pml-onboarding, .pml-more, .pml-stocks, .ob-flow, [class*='pml-']",
    );
  }

  function inferHomeTabFromContent() {
    var text = document.body ? document.body.innerText || "" : "";
    if (/Open IPOs/i.test(text)) return "ipos";
    if (/Total portfolio value/i.test(text)) return "portfolio";
    return "";
  }

  function inferOnboardingStepFromContent() {
    var text = document.body ? document.body.innerText || "" : "";
    for (var i = 0; i < ONBOARDING_STEP_HINTS.length; i++) {
      if (text.indexOf(ONBOARDING_STEP_HINTS[i][1]) >= 0) {
        return ONBOARDING_STEP_HINTS[i][0];
      }
    }
    return "";
  }

  function readLiveCaptureTheme() {
    try {
      var url = new URL(window.location.href);
      var fromUrl = url.searchParams.get("theme");
      if (fromUrl === "light" || fromUrl === "dark") return fromUrl;
      var globals = url.searchParams.get("globals") || "";
      if (/theme:dark\b/i.test(globals)) return "dark";
    } catch (e) {}
    try {
      var stored = localStorage.getItem("pml-theme");
      if (stored === "light" || stored === "dark") return stored;
    } catch (e) {}
    if (document.documentElement.getAttribute("data-theme") === "dark") return "dark";
    if (document.documentElement.classList.contains("dark")) return "dark";
    return "light";
  }

  function withLiveCaptureTheme(url) {
    url.searchParams.set("theme", readLiveCaptureTheme());
    return url.toString();
  }

  function readCaptureViewport() {
    var exposed = document.documentElement.getAttribute("data-craft-viewport");
    if (exposed) {
      var parts = String(exposed).toLowerCase().split(/x/);
      if (parts.length === 2) {
        var w = parseInt(parts[0], 10);
        var h = parseInt(parts[1], 10);
        if (w > 0 && h > 0) return { width: w, height: h };
      }
    }
    // Phone-column apps (PML, ob-flow): omit viewport — Craft captures at 376×844.
    if (usesPmlScreenRouting()) return null;
    if (
      document.querySelector(
        ".ob-flow, .pml-home, .pml-more, .pml-signup, .pml-stocks, .pml-onboarding, [class*='pml-']",
      )
    ) {
      return null;
    }
    if (isStorybookPreview() || window.innerWidth > 480) {
      return {
        width: Math.max(320, Math.round(window.innerWidth || 1280)),
        height: Math.max(480, Math.round(window.innerHeight || 800)),
      };
    }
    return null;
  }

  function signatureDrawPadHasInk() {
    var canvas = document.querySelector(
      ".ob-flow-sig-draw canvas, .ob-flow-sig-draw__canvas canvas, [class*='sig-draw'] canvas",
    );
    if (canvas && canvas.getContext) {
      try {
        var ctx = canvas.getContext("2d");
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          for (var pi = 3; pi < data.length; pi += 32) {
            if (data[pi] > 8) return true;
          }
        }
      } catch (err) {}
    }
    if (
      document.querySelector(
        "[class*='sig-draw'][class*='--filled'], [class*='sig-draw'][class*='--has-signature'], .ob-flow-sig-draw__box--filled",
      )
    ) {
      return true;
    }
    var saveBtn = document.querySelector(".ob-flow__footer .btn--filled, .ob-flow__footer button.btn");
    if (saveBtn && !saveBtn.disabled && !saveBtn.classList.contains("btn--disabled")) {
      var saveLabel = (saveBtn.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (saveLabel.indexOf("save") >= 0) return true;
    }
    return false;
  }

  function readSignatureMethodFromDom() {
    var selected = document.querySelector(
      ".ob-flow-sig-option--selected, .ob-flow-signature-option--selected, [class*='sig-option--selected']",
    );
    if (!selected) return "";
    var copy = (selected.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (copy.indexOf("draw") >= 0) return "draw";
    if (copy.indexOf("autogenerated") >= 0 || copy.indexOf("auto generated") >= 0) return "autogenerated";
    return "";
  }

  function enrichPmlOnboardingCaptureUrl(url) {
    url.searchParams.delete("homeTab");
    url.searchParams.delete("tab");

    var stepEl = document.querySelector("[data-craft-onboarding-step]");
    var step =
      (stepEl && stepEl.getAttribute("data-craft-onboarding-step")) ||
      inferOnboardingStepFromContent();
    if (step) {
      url.searchParams.set("step", step);
    }
    if (step === "mobile") {
      var tcRow = document.querySelector(".ob-flow-form__tc");
      if (tcRow) {
        var cb = tcRow.querySelector(".checkbox__input, input[type=checkbox]");
        if (cb && cb.checked) {
          url.searchParams.set("craftAgreed", "1");
        }
      }
      var phoneInput = document.querySelector(
        ".ob-flow-form .textfield__input, .ob-flow-form input[type=tel], .ob-flow-form input[type=text]",
      );
      if (phoneInput && phoneInput.value) {
        var digits = String(phoneInput.value).replace(/\D/g, "").slice(-10);
        if (digits.length >= 10) {
          url.searchParams.set("craftMobile", digits);
        }
      }
    }
    if (step === "tell-us-more") {
      var checkInputs = document.querySelectorAll(
        ".ob-flow-checks .checkbox__input, .ob-flow-checks input[type=checkbox]",
      );
      var citizenOk = checkInputs.length >= 2;
      for (var ci = 0; ci < checkInputs.length; ci++) {
        if (!checkInputs[ci].checked) citizenOk = false;
      }
      if (citizenOk) {
        url.searchParams.set("craftTellUsCitizen", "1");
      }
      var selectedCard = document.querySelector(".ob-flow-select-card--selected");
      if (selectedCard) {
        var maritalLabel = (
          selectedCard.querySelector(".ob-flow-select-card__label")?.textContent || ""
        )
          .trim()
          .toLowerCase();
        if (maritalLabel.indexOf("married") >= 0) {
          url.searchParams.set("craftMarital", "married");
        } else if (maritalLabel.indexOf("single") >= 0) {
          url.searchParams.set("craftMarital", "single");
        }
      }
    }
    if (step === "signature" || step === "signature-draw" || step === "sig-draw") {
      var sigMethod = readSignatureMethodFromDom();
      if (sigMethod) {
        url.searchParams.set("craftSigMethod", sigMethod);
      }
    }
    if (step === "signature-draw" || step === "sig-draw") {
      if (signatureDrawPadHasInk()) {
        url.searchParams.set("craftSigDrawn", "1");
      }
    }
    return url;
  }

  function enrichPmlHomeCaptureUrl(url) {
    url.searchParams.delete("step");

    var explicitTab =
      document.documentElement.getAttribute("data-craft-active-tab") ||
      (document.body && document.body.getAttribute("data-craft-active-tab"));
    if (explicitTab) {
      url.searchParams.set("homeTab", explicitTab);
      return url;
    }

    var marked = document.querySelector(
      "[data-craft-tab][aria-selected='true'], [data-craft-tab].active, [data-craft-active-tab]",
    );
    if (marked) {
      var tabId =
        marked.getAttribute("data-craft-tab") || marked.getAttribute("data-craft-active-tab");
      if (tabId) {
        url.searchParams.set("homeTab", tabId);
        return url;
      }
    }

    var selectedTab =
      document.querySelector('.tab--active[role="tab"]') ||
      document.querySelector("[role='tab'][aria-selected='true']");
    if (selectedTab) {
      var slug = slugTabLabel(selectedTab.textContent);
      if (slug && HOME_HEADER_TABS.indexOf(slug) >= 0) {
        url.searchParams.set("homeTab", slug);
        return url;
      }
    }

    var inferred = inferHomeTabFromContent();
    if (inferred) {
      url.searchParams.set("homeTab", inferred);
    }
    return url;
  }

  /** Capture URL for any preview: Vite, Storybook, React Router, plain HTML, or PML ?screen= apps. */
  function buildCapturePreviewUrl() {
    var exposed = document.documentElement.getAttribute("data-craft-capture-url");
    if (exposed) {
      try {
        return withLiveCaptureTheme(new URL(exposed));
      } catch (e) {
        return exposed;
      }
    }

    var url = new URL(window.location.href);

    if (isStorybookPreview() || !usesPmlScreenRouting()) {
      return withLiveCaptureTheme(url);
    }

    var screen = (url.searchParams.get("screen") || "").trim();
    if (screen === "onboarding") {
      enrichPmlOnboardingCaptureUrl(url);
      return withLiveCaptureTheme(url);
    }

    url.searchParams.delete("step");

    if (screen && screen !== "home") {
      url.searchParams.delete("homeTab");
      return withLiveCaptureTheme(url);
    }

    enrichPmlHomeCaptureUrl(url);
    return withLiveCaptureTheme(url);
  }

  var pushInFlight = false;

  async function pushToCraft() {
    if (pushInFlight) return;
    if (!repoRoot) {
      showToast("Missing repoRoot. Run: craft-bridge install-preview-menu", "error");
      return;
    }
    pushInFlight = true;
    showToast("Capturing screen → Craft…", "ok");
    try {
      var captureUrl = buildCapturePreviewUrl();
      var viewport = readCaptureViewport();
      var payload = {
        previewUrl: captureUrl,
        repoRoot: repoRoot,
      };
      if (viewport) payload.viewport = viewport;
      var res = await fetch(craftUrl.replace(/\/$/, "") + "/api/craft-bridge/push-from-preview", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      var body = await res.json();
      if (!res.ok) {
        showToast(body.error || "Push failed (" + res.status + ")", "error");
        return;
      }
      showToast(
        (body.message || "On canvas") +
          " — switch to your open Craft /editor tab (" +
          (body.layerCount || "?") +
          " layers)",
        "ok",
      );
    } catch (e) {
      showToast(
        "Could not reach Craft at " + craftUrl + ". Is npm run dev running?",
        "error",
      );
    } finally {
      pushInFlight = false;
    }
  }

  window.__craftBridgePushToCanvas = pushToCraft;
  window.craftBridgePushToCanvas = pushToCraft;

  document.addEventListener(
    "contextmenu",
    function (e) {
      if (!isCraftPushTarget(e.target)) return;
      e.preventDefault();
      showMenu(e.clientX, e.clientY);
    },
    true,
  );

  document.addEventListener("click", function () {
    removeEl(MENU_ID);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") removeEl(MENU_ID);
    if (e.altKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
      e.preventDefault();
      void pushToCraft();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureFloatingPushButton);
  } else {
    ensureFloatingPushButton();
  }
})();
