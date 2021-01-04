'use strict';

import InjectorWorklet from './worklet.js';
class InjectorClient {
    constructor() {
        this.state = {
            socketWorker: {
                dataSocket: 'INIT',
                audioSocket: 'INIT',
                audioFile: {
                    channels: 0,
                    sampleRate: 0,
                    bitDepth: 0,
                    frameCount: 0,
                    bufferLength: 0,
                },
            },
            audioContext: {
                playing: false,
            }
        };

        $(document).ready(() => {
            $('#audio-context-suspended-alert').attr('hidden', true);

            $('#audio-context-suspended-alert').click(async () => {
                await this.audioContext.resume();
                this.render();
            });

            $('#transport').click(() => {
                this.state.audioContext.playing ? this.stop() : this.play();
                this.state.audioContext.playing = !this.state.audioContext.playing;
                this.render();
            });
        });
    }

    async initialize() {
        try {
            this.audioContext = new AudioContext();

            await this.audioContext.audioWorklet.addModule(
                './processor.js',
            );

            this.worklet = new InjectorWorklet(this.audioContext);

            this.worker = new Worker('./worker.js', { type: 'module' });
            this.worker.onmessage = this.handleWorkerMessage.bind(this);

            this.socketWorker = new Worker('./socketWorker.js', { type: 'module' });
            this.socketWorker.onmessage = this.handleSocketWorkerMessage.bind(this);
        } catch (error) {
            console.error('[web-audio-injector]', error);
        }
    }

    handleSocketWorkerMessage(event) {
        const { type, payload } = event.data;

        switch (type) {
            case 'status':
                this.updateSocketWorkerStatus(payload);
                break;
            default:
                console.warn(
                    `[web-audio-injector] Unhandled socket worker message type: ${type}`,
                );
                console.log('[web-audio-injector]', event.data);
        }
    }

    handleWorkerMessage(event) {
        const { type, payload } = event.data;

        switch (type) {
            case 'ready':
                this.worklet.postMessage({ type: 'init', payload });
                break;
            default:
                console.warn(
                    `[web-audio-injector] Unhandled injector worker message type: ${type}`,
                );
                console.log('[web-audio-injector]', event.data);
        }
    }

    play() {
        this.worklet.connect(this.audioContext.destination);
    }

    stop() {
        this.worklet.disconnect(this.audioContext.destination);
    }

    updateSocketWorkerStatus(payload) {
        const { socketWorker } = this.state;

        socketWorker.audioFile = payload.audioFile;
        socketWorker.audioSocket = this._stateToStatus(payload.audioSocket);
        socketWorker.dataSocket = this._stateToStatus(payload.dataSocket);

        this.render();
    }

    render() {
        const { socketWorker, audioContext } = this.state;

        this.audioContext.state === 'suspended'
            ? $('#audio-context-suspended-alert').attr('hidden', false)
            : $('#audio-context-suspended-alert').attr('hidden', true);

        $('#transport').text(audioContext.playing ? 'STOP' : 'PLAY');
        $('#data-socket').text(socketWorker.dataSocket);
        $('#audio-socket').text(socketWorker.audioSocket);

        $('#channels').text(socketWorker.audioFile.channels);
        $('#sample-rate').text(`${socketWorker.audioFile.sampleRate / 1000} kHz`);
        $('#bit-depth').text(socketWorker.audioFile.bitDepth);
        $('#frame-count').text(socketWorker.audioFile.frameCount);
        $('#buffer-length').text(socketWorker.audioFile.bufferLength);
    }

    _stateToStatus(state) {
        switch (state) {
            case 0:
                return 'CONECTING';
            case 1:
                return 'CONNECTED';
            case 2:
                return 'CLOSING';
            case 3:
                return 'CLOSED';
            default:
                return 'UNKNOWN';
        }
    }
}

export default InjectorClient;
