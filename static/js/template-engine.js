/*
 * js/template-engine.js
 * Screen templates. Every screen's HTML lives in the page file (pages/<screen>.html) inside
 * <script type="text/html" data-tpl="NAME"> blocks. The scripts call __tpl(NAME, defaultHtml, [slot functions]).
 *
 *   {{s1: formatNumber(total)}}   is a slot: the text after "sN:" is only a hint of what goes there,
 *                                 the code for slot N is kept in the JavaScript file next to the template name.
 *
 * If the page has a block with that NAME, its HTML is used. If it does not, the default HTML kept next
 * to the call in the JavaScript file is used, so a page still works without its blocks.
 */
(function () {
  var registry = null;
  var parsed = {};
  var SLOT = /\{\{s(\d+)[^}]*\}\}/g;

  /* reads every <script type="text/html" data-tpl="..."> block of the page once */
  function scan() {
    registry = {};
    var blocks = document.querySelectorAll('script[type="text/html"][data-tpl]');
    for (var i = 0; i < blocks.length; i++) {
      var text = blocks[i].textContent.replace(/^\r?\n/, "").replace(/\r?\n[ \t]*$/, "");
      registry[blocks[i].getAttribute("data-tpl")] = text;
    }
  }

  /* "a{{s1: x}}b" -> ["a", 1, "b"] */
  function split(text) {
    var parts = [],
      last = 0,
      m;
    SLOT.lastIndex = 0;
    while ((m = SLOT.exec(text))) {
      parts.push(text.slice(last, m.index), +m[1]);
      last = m.index + m[0].length;
    }
    parts.push(text.slice(last));
    return parts;
  }

  window.__tpl = function (name, defaultHtml, slots) {
    if (registry === null) scan();
    var text = Object.prototype.hasOwnProperty.call(registry, name) ? registry[name] : defaultHtml;
    var parts = parsed[text] || (parsed[text] = split(text));
    var out = parts[0];
    for (var i = 1; i < parts.length; i += 2) {
      var fn = slots[parts[i] - 1];
      out += (fn ? String(fn()) : "") + parts[i + 1];
    }
    return out;
  };

  /* lets a page re-read its blocks (used after editing the HTML in the browser tools) */
  window.__tplReload = function () {
    registry = null;
    parsed = {};
  };
})();
