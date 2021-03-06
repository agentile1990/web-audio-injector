'use strict';

class InjectorProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        this.initialized = false;

        this.port.onmessage = (event) => {
            const { type, payload } = event.data;

            switch (type) {
                case 'init': {
                    const { sharedBuffers, config } = payload;
                    this.initialize(sharedBuffers, config);
                    break;
                }
                default:
                    console.warn(
                        `web-audio-injector:processor] Unhandled message type: ${type}`,
                    );
                    console.log('[web-audio-injector:processor]', event.data);
            }
        };
    }

    initialize(sharedBuffers, config) {
        this.config = config;

        // Create local references to SharedArrayBuffers
        this.states = new Int32Array(sharedBuffers.states);
        this.audioBuffer = [new Float32Array(sharedBuffers.audioBuffer)];

        this.initialized = true;

        // Notify InjectorWorklet that the Processor is ready
        console.log('[web-audio-injector:processor]', this);
        this.port.postMessage({ type: 'ready' });


    }

    process(inputs, outputs) {
        const config = this.config;

        // Short circuit if not initialized
        if (!this.initialized) {
            return true;
        }

        // Get the read index location boundaries
        const readIdx = this.states[config.STATE.READ_INDEX];
        const nextReadIdx = readIdx + outputs[0][0].length;

        // If not wrapping around the end of the audioBuffer
        if (nextReadIdx < config.AUDIO_BUFFER_LENGTH) {
            // Push audioBuffer to WebAudio output
            outputs[0][0].set(
                this.audioBuffer[0].subarray(readIdx, nextReadIdx)
            );
            // Update the read index location
            this.states[config.STATE.READ_INDEX] += outputs[0][0].length;
        } else {
            // Handle wrapping around the end of the audioBuffer
            const overflow = nextReadIdx - this.audioBuffer[0].length;

            // firstPart will fit into remaining buffer space, secondPart
            // starts at 0.
            const firstPart = this.audioBuffer[0].subarray(readIdx);
            const secondPart = this.audioBuffer[0].subarray(0, overflow);

            // Push audioBuffers to WebAudio output
            outputs[0][0].set(firstPart);
            outputs[0][0].set(secondPart, firstPart.length);

            // Update the read index location
            this.states[config.STATE.READ_INDEX] = secondPart.length;
        }

        // If we have room on the buffer for more samples, get more input from Worker
        if (
            this.states[config.STATE.SAMPLES_AVAILABLE] <
            config.AUDIO_BUFFER_LENGTH
        ) {
            Atomics.store(this.states, config.STATE.REQUEST_RENDER, 1);
            Atomics.notify(this.states, config.STATE.REQUEST_RENDER);
        }

        // If we processed samples, update the count of available samples.
        if (this.states[config.STATE.SAMPLES_AVAILABLE]) {
            this.states[config.STATE.SAMPLES_AVAILABLE] -= outputs[0][0].length;
        }

        return true;
    }
}

registerProcessor('injector-processor', InjectorProcessor);
