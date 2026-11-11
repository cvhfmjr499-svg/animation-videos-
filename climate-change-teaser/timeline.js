// Shared cue sheet — used by the visual renderer (browser) and the audio synth (Node),
// so picture and sound hit on exactly the same frames.
(function (root) {
  const CUES = {
    duration: 15,
    fps: 30,
    scenes: { sun: 0, co2: 3.0, blanket: 6.0, impacts: 9.0, outro: 12.0 },
    impacts: [6.0, 9.0, 12.0],      // big hits
    softHits: [3.0],                // gentle scene change
    cards: [9.15, 9.8, 10.45, 11.1],// consequence cards slam in
    whooshes: [2.8, 8.75, 11.75],
    risers: [[7.4, 8.98], [11.2, 11.98]],
    resolve: 13.3,                  // hopeful line + cooling
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CUES;
  else root.CUES = CUES;
})(this);
