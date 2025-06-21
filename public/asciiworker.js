// public/asciiworker.js
onmessage = function(event) {
    const { pixels, width, height } = event.data;
    postMessage({ pixels });
};