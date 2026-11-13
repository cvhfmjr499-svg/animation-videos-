// Renders index.html frame-by-frame in headless Chromium and pipes PNGs into ffmpeg.
//   node render.cjs                 → out/apple-music-10s.mp4 (with soundtrack if out/soundtrack.wav exists)
//   node render.cjs --stills 1,4.5  → out/still-<t>.png for quick checks
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const CUES = require('./timeline.js');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: CUES.width, height: CUES.height }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('PAGE ERROR', e); process.exitCode = 1; });
  await page.goto('file://' + path.join(__dirname, 'index.html') + '?render=1');
  await page.evaluate(() => window.__ready);
  const grab = t => page.evaluate(t => { window.__maTimeline.seek(t); return document.getElementById('c').toDataURL('image/png'); }, t);

  if (stillsArg) {
    for (const s of stillsArg.split(',')) {
      const b64 = (await grab(parseFloat(s))).split(',')[1];
      fs.writeFileSync(path.join(OUT, `still-${s}.png`), Buffer.from(b64, 'base64'));
    }
    await browser.close();
    return;
  }

  const wav = path.join(OUT, 'soundtrack.wav');
  const mp4 = path.join(OUT, 'apple-music-10s.mp4');
  const ff = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(CUES.fps), '-c:v', 'png', '-i', '-'];
  if (fs.existsSync(wav)) ff.push('-i', wav);
  ff.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart');
  if (fs.existsSync(wav)) ff.push('-c:a', 'aac', '-b:a', '256k', '-shortest');
  ff.push(mp4);
  const proc = spawn('ffmpeg', ff, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => proc.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));

  const frames = Math.round(CUES.duration * CUES.fps);
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    const buf = Buffer.from((await grab(f / CUES.fps)).split(',')[1], 'base64');
    if (!proc.stdin.write(buf)) await new Promise(r => proc.stdin.once('drain', r));
    if (f % 30 === 0) process.stdout.write(`frame ${f}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s\r`);
  }
  proc.stdin.end();
  await done;
  await browser.close();
  console.log(`\nwrote ${mp4}`);
})();
