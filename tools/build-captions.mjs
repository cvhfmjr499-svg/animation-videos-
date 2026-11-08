#!/usr/bin/env node
// Baut compositions/captions.html aus script.json (Wort-für-Wort-Untertitel im Erklärvideo-Stil).
// Nutzung: node tools/build-captions.mjs videos/<projekt>
// script.json: { "groups": [ { "t": [start, end], "text": "Was würde *passieren,*", "theme": "dark"|"light", "words": [optionale Startzeiten] } ] }
// *Wort* = Schlüsselwort mit blauem Auswahlrahmen (bleibt weiß/fett bis die Gruppe endet).
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
if (!dir) { console.error("Pfad zum Projekt fehlt"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(path.join(dir, "script.json"), "utf8"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r3 = (n) => Math.round(n * 1000) / 1000;

let markup = "";
const tweens = [];
let total = 0;

data.groups.forEach((g, gi) => {
  const [start, end] = g.t;
  total = Math.max(total, end);
  const raw = g.text.split(/\s+/).filter(Boolean);
  const words = raw.map((w) => {
    const kw = /^\*.*\*[.,!?:;]?$/.test(w) || /^\*.*\*$/.test(w);
    return { text: w.replace(/\*/g, ""), kw };
  });
  // Wortzeiten: explizit oder proportional zur Länge über [start, end - Lesepuffer]
  let times = g.words;
  if (!times) {
    const span = Math.max(0.2, end - start - Math.min(0.45, (end - start) * 0.3));
    const weights = words.map((w) => w.text.length + 3);
    const sum = weights.reduce((a, b) => a + b, 0);
    let acc = start;
    times = weights.map((wt) => { const t = acc; acc += (wt / sum) * span; return r3(t); });
  }
  const id = `cg${gi}`;
  const theme = g.theme === "light" ? "light" : "dark";
  markup += `    <div id="${id}" class="clip cgroup ${theme}" data-start="${r3(start)}" data-duration="${r3(end - start)}" data-track-index="1">\n      <div class="cin" id="${id}-in">`;
  words.forEach((w, wi) => {
    const wid = `${id}-w${wi}`;
    markup += `<span class="w${w.kw ? " kw" : ""}" id="${wid}"><span class="r">${esc(w.text)}</span><span class="b">${esc(w.text)}</span>${w.kw ? `<i class="box"><i class="hd h1"></i><i class="hd h2"></i></i>` : ""}</span> `;
    const t = times[wi];
    tweens.push(`tl.fromTo("#${wid}", {opacity:0, filter:"blur(8px)"}, {opacity:1, filter:"blur(0px)", duration:0.16, ease:"power3.out"}, ${t});`);
    if (w.kw) {
      tweens.push(`tl.fromTo("#${wid} .box", {opacity:0, scale:0.86}, {opacity:1, scale:1, duration:0.22, ease:"expo.out"}, ${r3(t + 0.05)});`);
    } else {
      const next = times[wi + 1];
      if (next !== undefined) {
        tweens.push(`tl.to("#${wid} .b", {opacity:0, duration:0.14, ease:"power2.out"}, ${next});`);
        tweens.push(`tl.to("#${wid} .r", {opacity:1, duration:0.14, ease:"power2.out"}, ${next});`);
      }
    }
  });
  markup += `</div>\n    </div>\n`;
  tweens.push(`tl.to("#${id}-in", {opacity:0, filter:"blur(8px)", duration:0.14, ease:"power2.in"}, ${r3(end - 0.15)});`);
});

const html = `<template>
  <style>
    #root { position: absolute; inset: 0; pointer-events: none; }
    #root .cgroup { position: absolute; left: 0; right: 0; top: 300px; display: flex; justify-content: center; }
    #root .cin { width: 920px; text-align: center; font-family: "Inter", sans-serif; font-size: 68px; line-height: 1.16; letter-spacing: -0.015em; }
    #root .w { display: inline-grid; position: relative; opacity: 0; margin: 0 -0.04em; }
    #root .w.kw { margin: 0 0.16em; }
    #root .w > span { grid-area: 1 / 1; text-align: center; white-space: nowrap; }
    #root .r { font-weight: 400; opacity: 0; }
    #root .b { font-weight: 700; }
    #root .dark .r { color: #8d8b90; }
    #root .dark .b { color: #ffffff; }
    #root .light .r { color: #8f8d8a; }
    #root .light .b { color: #141316; }
    #root .box { position: absolute; inset: 2px -12px -2px -12px; border: 3px solid #2f6fe8; background: rgba(47, 111, 232, 0.16); z-index: -1; }
    #root .light .box { background: rgba(47, 111, 232, 0.12); }
    #root .hd { position: absolute; width: 18px; height: 18px; border-radius: 50%; background: #2f6fe8; border: 3px solid #ffffff; }
    #root .h1 { left: -11px; top: -11px; }
    #root .h2 { right: -11px; bottom: -11px; }
  </style>
  <div id="root" data-composition-id="captions" data-width="1080" data-height="1920">
${markup}  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${tweens.join("\n    ")}
    window.__timelines["captions"] = tl;
  </script>
</template>
`;
fs.mkdirSync(path.join(dir, "compositions"), { recursive: true });
fs.writeFileSync(path.join(dir, "compositions", "captions.html"), html);
console.log(`captions.html: ${data.groups.length} Gruppen, Ende ${total}s`);
