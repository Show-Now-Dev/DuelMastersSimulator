// ui/logPanel.js
//
// Manages the action log panel.
// Encapsulates log line state and DOM rendering.
//
// Public API:
//   LogPanel.init(el)  — attach to DOM element; call once before use
//   LogPanel.log(msg)  — prepend a timestamped line (max 60 lines)
//   LogPanel.clear()   — clear all lines and re-render

var LogPanel = (function () {
  var _lines = [];
  var _el    = null;

  function init(el) {
    _el = el;
    _render();
  }

  function log(msg) {
    var now = new Date();
    var hh  = String(now.getHours()).padStart(2, "0");
    var mm  = String(now.getMinutes()).padStart(2, "0");
    var ss  = String(now.getSeconds()).padStart(2, "0");
    _lines.unshift("[" + hh + ":" + mm + ":" + ss + "] " + msg);
    if (_lines.length > 60) _lines.length = 60;
    if (_el) _render();
  }

  function clear() {
    _lines = [];
    if (_el) _render();
  }

  function _render() {
    _el.innerHTML = "";

    var header = document.createElement("div");
    header.className = "log-header";
    header.textContent = "ログ";
    _el.appendChild(header);

    var body = document.createElement("div");
    body.className = "log-body";
    _lines.forEach(function (line) {
      var el = document.createElement("div");
      el.className = "log-line";
      el.textContent = line;
      body.appendChild(el);
    });
    _el.appendChild(body);
  }

  return { init: init, log: log, clear: clear };
}());
