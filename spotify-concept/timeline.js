// Shared cue sheet for picture (film.js) and sound (audio.cjs). 120 BPM → one beat = 0.5 s.
(function (root) {
  const CUES = {
    duration: 10,
    fps: 30,
    width: 1920,
    height: 1080,
    bpm: 120,
    groove: [0.0, 8.3],
    scenes: { home: 0, room: 2.6, text: 4.6, logo: 8.3 },
    tap: 1.15,                      // finger taps the "Live" chip
    swooshes: [2.3, 4.15],         // soft camera glides (sound only)
    reactions: [3.0, 3.3, 3.55, 3.8, 4.0, 4.15],
    comments: [3.2, 3.7],
    text: { listen: 4.7, friends: 5.2, same1: 6.45, same2: 6.8 },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CUES;
  else root.CUES = CUES;
})(this);
