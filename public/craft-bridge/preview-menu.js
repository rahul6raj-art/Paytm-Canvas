(function craftBridgePreviewMenu() {
  "use strict";

  var script = document.currentScript;
  var craftUrl = (script && script.getAttribute("data-craft-url")) || "http://localhost:3000";
  var repoRoot = (script && script.getAttribute("data-repo-root")) || "";
  var bridgeToken = (script && script.getAttribute("data-bridge-token")) || "";

  var MENU_ID = "craft-bridge-preview-menu";
  var TOAST_ID = "craft-bridge-preview-toast";

  function isCraftScreenTarget(target) {
    if (!(target instanceof Element)) return false;
    if (target.closest("[data-craft-screen-ignore]")) return false;
    if (target.closest("input, textarea, select, [contenteditable='true']")) return false;
    if (target.closest("#" + MENU_ID)) return false;
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

  function authHeaders() {
    var headers = { "Content-Type": "application/json" };
    if (bridgeToken) {
      headers.Authorization = "Bearer " + bridgeToken;
      headers["X-Craft-Bridge-Token"] = bridgeToken;
    }
    return headers;
  }

  async function pushToCraft() {
    if (!repoRoot) {
      showToast("Missing repoRoot. Run: craft-bridge install-preview-menu", "error");
      return;
    }
    showToast("Capturing screen → Craft…", "ok");
    try {
      var res = await fetch(craftUrl.replace(/\/$/, "") + "/api/craft-bridge/push-from-preview", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          previewUrl: window.location.href,
          repoRoot: repoRoot,
        }),
      });
      var body = await res.json();
      if (!res.ok) {
        showToast(body.error || "Push failed (" + res.status + ")", "error");
        return;
      }
      showToast(
        (body.message || "On canvas") +
          " — keep Craft /editor open (" +
          (body.layerCount || "?") +
          " layers)",
        "ok",
      );
      if (body.openUrl) {
        window.open(craftUrl.replace(/\/$/, "") + body.openUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      showToast(
        "Could not reach Craft at " + craftUrl + ". Is npm run dev running?",
        "error",
      );
    }
  }

  document.addEventListener(
    "contextmenu",
    function (e) {
      if (!isCraftScreenTarget(e.target)) return;
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
  });
})();
