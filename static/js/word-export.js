/*
 * js/word-export.js
 * Word (.docx) export of reports.
 */

/* ===================== WORD (.docx) EXPORT of the report preview ===================== */
(function () {
  "use strict";
  const NAVY = "16213E",
    BLUE = "4B5FD6",
    GREY = "6B7592",
    INK = "1F2937";
  const PAGE_W = 11906,
    PAGE_H = 16838,
    MAR = 1000,
    CONTENT_TW = PAGE_W - 2 * MAR; /* twips */
  const CONTENT_PX = Math.round(CONTENT_TW / 15);
  const ex = (s) =>
    String(s == null ? "" : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const hex = (c) => {
    const m = String(c || "").match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/);
    if (!m) return null;
    if (m[4] !== undefined && +m[4] === 0) return null;
    return [m[1], m[2], m[3]]
      .map((v) => (+v).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  };

  let S; /* per-export state */

  /* ---------- inline runs ---------- */
  function rPr(f) {
    let o = "";
    if (f.b) o += "<w:b/>";
    if (f.i) o += "<w:i/>";
    if (f.caps) o += "<w:caps/>";
    if (f.color) o += `<w:color w:val="${f.color}"/>`;
    if (f.sp) o += `<w:spacing w:val="${f.sp}"/>`;
    if (f.sz) o += `<w:sz w:val="${f.sz}"/><w:szCs w:val="${f.sz}"/>`;
    if (f.shd) o += `<w:shd w:val="clear" w:color="auto" w:fill="${f.shd}"/>`;
    return o ? `<w:rPr>${o}</w:rPr>` : "";
  }
  const run = (t, f) =>
    t === "" ? "" : `<w:r>${rPr(f || {})}<w:t xml:space="preserve">${ex(t)}</w:t></w:r>`;
  function runs(node, f) {
    f = f || {};
    let o = "";
    node.childNodes.forEach((ch) => {
      if (ch.nodeType === 3) {
        const t = ch.nodeValue.replace(/\s+/g, " ");
        if (t.trim() || t === " ") o += run(t, f);
      } else if (ch.nodeType === 1) {
        const tg = ch.tagName.toLowerCase(),
          c = ch.classList;
        if (tg === "br") o += "<w:r><w:br/></w:r>";
        else if (tg === "svg" || tg === "style" || tg === "script") return;
        else if (c.contains("an-bar")) {
          if (!ch.parentElement.querySelector("b")) o += run(ch.dataset.v || "", f);
        } else if (c.contains("r-ph")) {
          const cs = getComputedStyle(ch);
          o += run(
            ch.textContent.trim(),
            Object.assign({}, f, {
              b: true,
              color: hex(cs.color) || f.color,
              shd: hex(cs.backgroundColor),
              sz: f.sz ? Math.max(14, f.sz - 2) : 16,
            }),
          );
        } else {
          const g = Object.assign({}, f);
          if (tg === "b" || tg === "strong") g.b = true;
          if (tg === "i" || tg === "em") g.i = true;
          if (c.contains("r-mu")) g.color = GREY;
          o += runs(ch, g);
        }
      }
    });
    return o;
  }

  /* ---------- paragraphs ---------- */
  function para(inner, o) {
    o = o || {};
    let pp = "";
    if (o.style) pp += `<w:pStyle w:val="${o.style}"/>`;
    if (o.keep) pp += "<w:keepNext/>";
    if (S.pend && S.n > 0 && !o.noBreak) {
      pp += "<w:pageBreakBefore/>";
      S.pend = false;
    }
    if (o.bullet) pp += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
    if (o.bdr)
      pp += `<w:pBdr><w:bottom w:val="single" w:sz="${o.bdr[0]}" w:space="4" w:color="${o.bdr[1]}"/></w:pBdr>`;
    if (o.before != null || o.after != null)
      pp += `<w:spacing w:before="${o.before || 0}" w:after="${o.after == null ? 100 : o.after}"/>`;
    if (o.ind) pp += `<w:ind w:left="${o.ind[0]}" w:hanging="${o.ind[1] || 0}"/>`;
    if (o.jc) pp += `<w:jc w:val="${o.jc}"/>`;
    S.n++;
    return `<w:p>${pp ? `<w:pPr>${pp}</w:pPr>` : ""}${inner || ""}</w:p>`;
  }
  const emptyP = () => "<w:p/>";

  /* ---------- images ---------- */
  function imgXml(svg, maxPx) {
    const im = S.imgs.get(svg);
    if (!im || !im.bytes) return "";
    let w = svg.getBoundingClientRect().width || im.W;
    w = Math.min(w, maxPx);
    const h = (w * im.H) / im.W,
      cx = Math.round(w * 9525),
      cy = Math.round(h * 9525),
      id = im.id;
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Figure ${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="image${id}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }
  const svgPara = (svg, maxPx, o) => {
    const x = imgXml(svg, maxPx);
    return x ? para(x, Object.assign({ after: 80, keep: true }, o || {})) : "";
  };

  /* ---------- tables ---------- */
  const cellBorders = (b) => (b ? `<w:tcBorders>${b}</w:tcBorders>` : "");
  function tblWrap(grid, rows, o) {
    o = o || {};
    const bd = o.borders || "";
    return `<w:tbl><w:tblPr><w:tblW w:w="${o.tw || CONTENT_TW}" w:type="dxa"/>${bd ? `<w:tblBorders>${bd}</w:tblBorders>` : ""}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="${o.padV == null ? 50 : o.padV}" w:type="dxa"/><w:left w:w="${o.padH == null ? 90 : o.padH}" w:type="dxa"/><w:bottom w:w="${o.padV == null ? 50 : o.padV}" w:type="dxa"/><w:right w:w="${o.padH == null ? 90 : o.padH}" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="0000"/></w:tblPr><w:tblGrid>${grid.map((g) => `<w:gridCol w:w="${g}"/>`).join("")}</w:tblGrid>${rows}</w:tbl>`;
  }
  function colWidths(tbl, tw) {
    const rows = [...tbl.rows];
    let n = 0;
    rows.forEach((r) => {
      let c = 0;
      [...r.cells].forEach((x) => (c += x.colSpan || 1));
      n = Math.max(n, c);
    });
    const maxWord = (t) =>
      Math.max(
        1,
        ...t
          .trim()
          .split(/\s+/)
          .map((x) => x.length),
      );
    const hdr = new Array(n).fill(0),
      mw = new Array(n).fill(0),
      sum = new Array(n).fill(0),
      cnt = new Array(n).fill(0);
    rows.forEach((r) => {
      let ci = 0;
      [...r.cells].forEach((c) => {
        const sp = c.colSpan || 1;
        if (sp === 1) {
          const t = c.textContent;
          if (c.tagName === "TH") hdr[ci] = Math.max(hdr[ci], maxWord(t) * 1.15 + 1.5);
          else {
            mw[ci] = Math.max(mw[ci], maxWord(t) * (c.querySelector(".r-ph") ? 1.3 : 1) + 1.5);
            sum[ci] += Math.min(t.trim().length, 46) * 0.8;
            cnt[ci]++;
          }
        }
        ci += sp;
      });
    });
    const w = hdr.map((h, i) => Math.max(h, mw[i], cnt[i] ? sum[i] / cnt[i] : 0, 5));
    const tot = w.reduce((a, b) => a + b, 0) || 1;
    let g = w.map((v) => Math.max(500, Math.round((v / tot) * tw)));
    const gt = g.reduce((a, b) => a + b, 0);
    return g.map((v) => Math.floor((v * tw) / gt));
  }
  function tableXml(tbl, maxPx) {
    const tw = Math.round(maxPx * 15),
      meta = tbl.classList.contains("r-meta"),
      sm = tbl.classList.contains("sm") || maxPx < 400,
      sz = meta ? 20 : sm ? 15 : 17;
    const grid = colWidths(tbl, tw);
    let rows = "",
      bi = 0;
    [...tbl.rows].forEach((tr) => {
      const sec = tr.parentElement.tagName,
        isH = sec === "THEAD",
        isF = sec === "TFOOT";
      let ci = 0,
        cells = "";
      if (!isH && !isF) bi++;
      [...tr.cells].forEach((td) => {
        const sp = td.colSpan || 1,
          w = grid.slice(ci, ci + sp).reduce((a, b) => a + b, 0);
        ci += sp;
        const right = td.classList.contains("n");
        let f = { sz };
        let shd = "",
          bd = "";
        if (isH) {
          f = Object.assign(f, { b: true, color: "FFFFFF", caps: true, sz: Math.max(13, sz - 2) });
          shd = NAVY;
        } else if (isF) {
          f.b = true;
          shd = "EEF1F8";
          bd = `<w:top w:val="single" w:sz="12" w:space="0" w:color="${NAVY}"/>`;
        } else {
          if (!meta && bi % 2 === 0) shd = "F7F9FD";
          bd = '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="E3E7F0"/>';
        }
        if (meta && td === tr.cells[0]) f.color = GREY;
        const body = runs(td, f) || "";
        cells += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${sp > 1 ? `<w:gridSpan w:val="${sp}"/>` : ""}${cellBorders(bd)}${shd ? `<w:shd w:val="clear" w:color="auto" w:fill="${shd}"/>` : ""}<w:vAlign w:val="${isH ? "bottom" : "top"}"/></w:tcPr>${para(body, { after: 0, jc: right ? "right" : null, noBreak: true })}</w:tc>`;
      });
      rows += `<w:tr><w:trPr><w:cantSplit/>${isH ? "<w:tblHeader/>" : ""}</w:trPr>${cells}</w:tr>`;
    });
    if (S.pend && S.n > 0) {
      rows = rows;
      S.pend = false;
      return (
        para("", { after: 0, noBreak: false, before: 0 }).replace("<w:p>", "<w:p>") +
        tblWrap(grid, rows, { tw, padH: 80, padV: 40, borders: "" })
      );
    }
    S.n++;
    return (
      tblWrap(grid, rows, { tw, padH: 80, padV: 40, borders: "" }) +
      para("", { after: 60, noBreak: true })
    );
  }

  /* two-column layout (report .r-2) */
  function twoCol(el, maxPx) {
    const kids = [...el.children].filter((k) => !k.classList.contains("r-foot"));
    const n = Math.max(1, kids.length),
      half = Math.floor(CONTENT_TW / n),
      px = Math.floor(maxPx / n) - 12;
    let cells = "";
    kids.forEach((k) => {
      let b = blocks(k, px);
      if (!/<\/w:p>\s*$|<w:p\/>\s*$/.test(b)) b += emptyP();
      cells += `<w:tc><w:tcPr><w:tcW w:w="${half}" w:type="dxa"/></w:tcPr>${b || emptyP()}</w:tc>`;
    });
    const grid = kids.map(() => half);
    S.n++;
    return (
      tblWrap(grid, `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells}</w:tr>`, {
        tw: half * n,
        padH: 60,
        padV: 20,
      }) + para("", { after: 40, noBreak: true })
    );
  }

  /* KPI cards (report .r-kg) */
  function kpiTable(el, maxPx) {
    const cols =
      Math.max(
        1,
        (getComputedStyle(el).gridTemplateColumns || "").split(" ").filter(Boolean).length,
      ) || 3;
    const cards = [...el.children],
      tw = Math.round(maxPx * 15),
      cw = Math.floor(tw / cols);
    let rows = "";
    for (let i = 0; i < cards.length; i += cols) {
      let cells = "";
      for (let j = 0; j < cols; j++) {
        const k = cards[i + j];
        let inner = "";
        if (k) {
          const sm = k.querySelector("small"),
            b = k.querySelector("b"),
            em = k.querySelector("em");
          inner =
            (sm
              ? para(run(sm.textContent.trim(), { sz: 14, color: GREY, caps: true, sp: 10 }), {
                  after: 20,
                  noBreak: true,
                })
              : "") +
            (b
              ? para(run(b.textContent.trim(), { sz: 30, b: true, color: NAVY }), {
                  after: 10,
                  noBreak: true,
                })
              : "") +
            (em
              ? para(run(em.textContent.trim(), { sz: 15, color: GREY }), {
                  after: 0,
                  noBreak: true,
                })
              : "");
        }
        const bd = k
          ? '<w:top w:val="single" w:sz="8" w:space="0" w:color="FFFFFF"/><w:left w:val="single" w:sz="8" w:space="0" w:color="FFFFFF"/><w:bottom w:val="single" w:sz="8" w:space="0" w:color="FFFFFF"/><w:right w:val="single" w:sz="8" w:space="0" w:color="FFFFFF"/>'
          : "";
        cells += `<w:tc><w:tcPr><w:tcW w:w="${cw}" w:type="dxa"/>${cellBorders(bd)}${k ? `<w:shd w:val="clear" w:color="auto" w:fill="F1F4FB"/>` : ""}</w:tcPr>${inner || emptyP()}</w:tc>`;
      }
      rows += `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells}</w:tr>`;
    }
    S.n++;
    return (
      tblWrap(new Array(cols).fill(cw), rows, { tw: cw * cols, padH: 130, padV: 90 }) +
      para("", { after: 60, noBreak: true })
    );
  }

  /* ---------- block walker ---------- */
  function legend(el) {
    let o = "";
    [...el.children].forEach((sp) => {
      const i = sp.querySelector("i"),
        col = i ? hex(getComputedStyle(i).backgroundColor) : null;
      const txt = runs(sp, { sz: 17 });
      o += para(
        (col ? run("■ ", { color: col, sz: 17 }) : "") +
          txt.replace(/^<w:r>(<w:rPr>.*?<\/w:rPr>)?<w:t xml:space="preserve"> <\/w:t><\/w:r>/, ""),
        { after: 20, noBreak: true },
      );
    });
    return o;
  }
  function heading(n) {
    const t = n.tagName;
    const lvl = t === "H2" ? 1 : t === "H3" ? 2 : 3;
    const inner = runs(n, {});
    return para(inner, { style: "Heading" + lvl, keep: true });
  }
  function block(n, W) {
    const c = n.classList,
      t = n.tagName;
    if (c.contains("r-foot") || c.contains("rbar") || n.hidden) return "";
    if (t === "SECTION") {
      if (c.contains("r-cover")) return cover(n);
      if (c.contains("pb") && S.n > 0) S.pend = true;
      return blocks(n, W);
    }
    if (t === "H1")
      return para(runs(n, { sz: 56, b: true, color: NAVY }), { before: 200, after: 140 });
    if (t === "H2" || t === "H3" || t === "H4") return heading(n);
    if (t === "P") {
      if (c.contains("r-tags")) {
        return para(
          [...n.children]
            .map((s) => run(s.textContent.trim(), { sz: 17 }))
            .join(run("  ·  ", { color: GREY, sz: 17 })),
          { after: 100 },
        );
      }
      const f = c.contains("r-lead")
        ? { sz: 21, color: "4A5575" }
        : c.contains("an-note") || c.contains("r-mu")
          ? { sz: 16, color: GREY }
          : { sz: 19 };
      return para(runs(n, f), { after: c.contains("an-note") ? 120 : 100 });
    }
    if (t === "UL")
      return [...n.children]
        .map((li) =>
          para(runs(li, { sz: c.contains("sm") ? 17 : 19 }), {
            bullet: true,
            after: 50,
            ind: [360, 220],
          }),
        )
        .join("");
    if (t === "OL")
      return [...n.children]
        .map((li, i) =>
          para(run(i + 1 + ". ", { color: GREY, sz: 19 }) + runs(li, { sz: 19 }), { after: 30 }),
        )
        .join("");
    if (t === "TABLE") return tableXml(n, W);
    if (t === "FIGURE") {
      const s = n.querySelector("svg"),
        cap = n.querySelector("figcaption");
      return (
        (s ? svgPara(s, W) : "") +
        (cap ? para(runs(cap, { sz: 15, color: GREY, i: true }), { after: 160 }) : "")
      );
    }
    if (t === "svg" || t === "SVG") return svgPara(n, W);
    if (c.contains("r-2")) return twoCol(n, W);
    if (c.contains("r-kg")) return kpiTable(n, W);
    if (c.contains("r-lg")) return legend(n);
    if (c.contains("r-sub")) {
      return para(runs(n, { sz: 19, color: "4A5575" }), { after: 120 });
    }
    if (t === "DIV" || t === "ASIDE" || t === "SECTION") {
      if (n.querySelector(":scope > *")) return blocks(n, W);
      const tx = n.textContent.trim();
      return tx ? para(runs(n, { sz: 19 }), {}) : "";
    }
    const tx = n.textContent.trim();
    return tx ? para(runs(n, { sz: 19 }), {}) : "";
  }
  function blocks(el, W) {
    let o = "";
    [...el.children].forEach((k) => {
      o += block(k, W);
    });
    return o;
  }

  function cover(sec) {
    let o = "";
    [...sec.children].forEach((k) => {
      const c = k.classList;
      if (c.contains("r-band")) {
        const b = k.querySelector("b"),
          s = k.querySelector("small");
        o += para(
          run(b ? b.textContent : "BM Monitor", { b: true, sz: 30, color: NAVY }) +
            (s ? "<w:r><w:br/></w:r>" + run(s.textContent, { sz: 18, color: GREY }) : ""),
          { bdr: [24, NAVY], after: 600 },
        );
      } else if (c.contains("r-ct")) {
        const sm = k.querySelector("small"),
          h = k.querySelector("h1"),
          p = k.querySelector("p");
        if (sm)
          o += para(
            run(" " + sm.textContent.trim().toUpperCase() + " ", {
              b: true,
              sz: 16,
              color: BLUE,
              shd: "EEF1F8",
              sp: 20,
            }),
            { before: 1200, after: 160 },
          );
        if (h)
          o += para(run(h.textContent.trim(), { b: true, sz: 64, color: NAVY }), { after: 160 });
        if (p) o += para(run(p.textContent.trim(), { sz: 26, color: "4A5575" }), { after: 600 });
      } else if (k.tagName === "TABLE") o += tableXml(k, Math.min(560, CONTENT_PX));
      else if (c.contains("r-toc")) {
        const h = k.querySelector("h3"),
          ol = k.querySelector("ol");
        o += para("", { after: 400 });
        if (h) o += para(runs(h, {}), { style: "Heading2", keep: true });
        if (ol)
          o += [...ol.children]
            .map((li, i) =>
              para(
                run(i + 1 + ".  ", { color: GREY, sz: 19 }) +
                  run(li.textContent.trim(), { sz: 19 }),
                { after: 40 },
              ),
            )
            .join("");
      }
    });
    S.pend = true;
    return o;
  }

  /* ---------- package ---------- */
  const NS =
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const HDR = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const STYLES =
    HDR +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:color w:val="${INK}"/><w:sz w:val="19"/><w:szCs w:val="19"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="18" w:space="4" w:color="${BLUE}"/></w:pBdr><w:spacing w:before="120" w:after="140"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="${NAVY}"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="260" w:after="90"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:caps/><w:color w:val="${BLUE}"/><w:spacing w:val="14"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="${NAVY}"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="right" w:pos="${CONTENT_TW}"/></w:tabs><w:spacing w:after="0"/></w:pPr><w:rPr><w:color w:val="${GREY}"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style></w:styles>`;
  const NUMBERING =
    HDR +
    '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="220"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="475569"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';
  const footerXml = (txt) =>
    HDR +
    `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t xml:space="preserve">${ex(txt)}</w:t></w:r><w:r><w:tab/><w:t xml:space="preserve">Page </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t xml:space="preserve"> of </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;

  async function buildDocx() {
    const paper = document.querySelector("#rep .paper");
    if (!paper) throw new Error("Generate a report first");
    const rbT = (document.querySelector("#rep .rbar b") || {}).textContent || "",
      ref = rbT.replace(/^Report preview\s*·\s*/, "").trim() || "BioReg-report";
    S = { n: 0, pend: false, imgs: new Map() };
    /* rasterise every SVG (maps, charts, gauges) to PNG */
    const svgs = [...paper.querySelectorAll("svg")];
    let id = 0;
    await Promise.all(
      svgs.map(async (sv) => {
        const vb = (sv.getAttribute("viewBox") || "").split(/\s+/).map(Number);
        if (vb.length < 4 || !vb[2]) return;
        const W = vb[2],
          H = vb[3],
          xml = new XMLSerializer().serializeToString(sv),
          isMap = sv.classList.contains("rmap"),
          k = isMap ? 2.6 : 2.4;
        const bytes = await svgToPng(xml, k);
        const myId = ++id;
        S.imgs.set(sv, { id: myId, bytes, W, H });
      }),
    );
    let body = blocks(paper, CONTENT_PX);
    const sect = `<w:sectPr><w:footerReference w:type="default" r:id="rIdFtr"/><w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}"/><w:pgMar w:top="${MAR}" w:right="${MAR}" w:bottom="1100" w:left="${MAR}" w:header="500" w:footer="520" w:gutter="0"/></w:sectPr>`;
    const doc = HDR + `<w:document ${NS}><w:body>${body}${sect}</w:body></w:document>`;
    const imgs = [...S.imgs.values()].filter((x) => x.bytes);
    const files = [
      {
        name: "[Content_Types].xml",
        data:
          HDR +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
      },
      {
        name: "_rels/.rels",
        data:
          HDR +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
      },
      {
        name: "docProps/core.xml",
        data:
          HDR +
          `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${ex(ref)}</dc:title><dc:creator>${ex((typeof REP !== "undefined" && REP.by) || "BM Monitor")}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`,
      },
      { name: "word/document.xml", data: doc },
      { name: "word/styles.xml", data: STYLES },
      { name: "word/numbering.xml", data: NUMBERING },
      {
        name: "word/footer1.xml",
        data: footerXml(
          ((typeof REP !== "undefined" && REP.cls) || "Internal") +
            " · " +
            ref +
            " · BM Monitor",
        ),
      },
      {
        name: "word/_rels/document.xml.rels",
        data:
          HDR +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSty" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
          imgs
            .map(
              (m) =>
                `<Relationship Id="rIdImg${m.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${m.id}.png"/>`,
            )
            .join("") +
          "</Relationships>",
      },
    ].concat(imgs.map((m) => ({ name: `word/media/image${m.id}.png`, data: m.bytes })));
    return { bytes: zipStore(files), ref };
  }

  async function exportDocx() {
    try {
      toast("Preparing the Word report…");
      const r = await buildDocx(),
        b = new Blob([r.bytes], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
        a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = r.ref + ".docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast("Word report downloaded");
    } catch (e) {
      console.error(e);
      toast("Could not create the Word file: " + e.message);
    }
  }
  window.exportDocx = exportDocx;
  window.buildDocx = buildDocx;

  /* wire the buttons */
  const _sr = showReport;
  showReport = function (a, b) {
    _sr(a, b);
    const x = document.getElementById("rb-dx");
    if (x) x.onclick = exportDocx;
  };
  const dg = document.getElementById("rd-dx");
  if (dg)
    dg.onclick = () => {
      document.getElementById("rd-go").click();
      setTimeout(exportDocx, 700);
    };
})();
