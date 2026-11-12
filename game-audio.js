(() => {
  if (window.parent === window) return;
  const script = document.currentScript;
  const parentOrigin = script?.dataset.parentOrigin || 'https://morejam.ru';
  let muted = script?.dataset.muted === 'true';
  const gates = new Set();
  const outputGates = new WeakMap();
  const media = new Map();

  if (window.AudioNode) {
    const { connect, disconnect } = AudioNode.prototype;
    AudioNode.prototype.connect = function (destination, ...ports) {
      if (destination !== this.context.destination) return connect.call(this, destination, ...ports);
      let gate = outputGates.get(destination);
      if (!gate) {
        gate = this.context.createGain();
        gate.gain.value = muted ? 0 : 1;
        connect.call(gate, destination);
        outputGates.set(destination, gate);
        gates.add(gate);
      }
      connect.call(this, gate, ...ports);
      return destination;
    };
    AudioNode.prototype.disconnect = function (...args) {
      const gate = outputGates.get(args[0]);
      if (gate) args[0] = gate;
      return disconnect.apply(this, args);
    };
  }

  const mediaPrototype = HTMLMediaElement.prototype;
  const mutedProperty = Object.getOwnPropertyDescriptor(mediaPrototype, 'muted');
  Object.defineProperty(mediaPrototype, 'muted', {
    ...mutedProperty,
    set(value) {
      if (muted) media.set(this, Boolean(value));
      mutedProperty.set.call(this, muted || value);
    }
  });
  function silence(element) {
    if (!media.has(element)) media.set(element, mutedProperty.get.call(element));
    mutedProperty.set.call(element, true);
  }
  const play = mediaPrototype.play;
  mediaPrototype.play = function (...args) {
    if (muted) silence(this);
    return play.apply(this, args);
  };
  window.addEventListener('play', (event) => {
    if (muted && event.target instanceof HTMLMediaElement) silence(event.target);
  }, true);

  window.addEventListener('message', (event) => {
    if (event.source !== parent || event.origin !== parentOrigin || event.data?.type !== 'cfujam:mute') return;
    if (typeof event.data.muted !== 'boolean' || muted === event.data.muted) return;
    muted = event.data.muted;
    for (const gate of gates) gate.gain.value = muted ? 0 : 1;
    if (muted) document.querySelectorAll('audio, video').forEach(silence);
    else {
      for (const [element, previous] of media) mutedProperty.set.call(element, previous);
      media.clear();
    }
  });
  parent.postMessage({ type: 'cfujam:audio-ready' }, parentOrigin);
})();
