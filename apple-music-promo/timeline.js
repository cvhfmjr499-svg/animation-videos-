// Shared cue sheet for picture (film.js) and sound (audio.cjs). 120 BPM → one beat = 0.5 s.
(function (root) {
  const CUES = {
    duration: 10,
    fps: 30,
    width: 1920,
    height: 1080,
    bpm: 120,
    scenes: { covers: 0, spatial: 2.0, lyrics: 4.0, devices: 6.5, end: 8.5 },
    groove: [2.0, 8.5],                 // drums play between these
    lyricLines: [4.3, 4.9, 5.5, 6.1],   // each lyric line becomes active
    lyrics: ['Die Stadt schläft noch,', 'doch wir sind wach –', 'jeder Beat ein Herzschlag,', 'jede Nacht ein Song.'],
    devicesIn: [6.55, 6.7, 6.85, 7.0],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CUES;
  else root.CUES = CUES;
})(this);
