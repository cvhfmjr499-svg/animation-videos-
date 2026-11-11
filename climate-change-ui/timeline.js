// Shared cue sheet for picture (film.js) and sound (audio.cjs).
(function (root) {
  const CUES = {
    duration: 20,
    fps: 30,
    width: 1920,
    height: 1080,
    scenes: { cloud: 0, counter: 3.0, search: 6.6, trails: 9.4, light: 12.4, finale: 16.85 },
    counter: [3.3, 4.8],
    search: { open: 6.65, typeStart: 7.15, typeEnd: 8.45, send: 8.7, burst: 9.4 },
    query: 'Was ist der Klimawandel?',
    blocks: [12.45, 14.05, 15.6],           // light UI blocks a / b / c
    pillQueries: ['Erklär mir den Klimawandel', 'Wie stark ist die Erwärmung?', 'Was sind die Folgen?'],
    finale: { line: 17.25, reveal: 17.65, tagline: 18.3, end: 18.8 },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CUES;
  else root.CUES = CUES;
})(this);
