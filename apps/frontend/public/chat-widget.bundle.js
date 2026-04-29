(function () {
  var script = document.currentScript;
  var originAttr = script && script.getAttribute("data-origin");
  var baseUrl = originAttr || window.location.origin;

  var container = document.createElement("div");
  container.id = "omnichannel-ai-widget-container";
  container.style.position = "fixed";
  container.style.right = "0";
  container.style.bottom = "0";
  container.style.width = "420px";
  container.style.height = "620px";
  container.style.maxWidth = "100vw";
  container.style.maxHeight = "100vh";
  container.style.zIndex = "2147483647";
  container.style.border = "0";
  container.style.background = "transparent";

  var iframe = document.createElement("iframe");
  iframe.src = baseUrl.replace(/\/$/, "") + "/widget";
  iframe.title = "Omnichannel AI Chat Widget";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.style.background = "transparent";
  iframe.setAttribute("allow", "clipboard-write");

  container.appendChild(iframe);
  document.body.appendChild(container);
})();
