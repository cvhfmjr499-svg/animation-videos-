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
    whips: [2.45, 4.35],            // fast camera moves (motion-blurred)
    reactions: [3.0, 3.3, 3.55, 3.8, 4.0, 4.15],
    comments: [3.2, 3.7],
    text: { listen: 4.75, friends: 5.35, same1: 6.25, same2: 6.7, wherever: 7.35 },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CUES;
  else root.CUES = CUES;
})(this);
