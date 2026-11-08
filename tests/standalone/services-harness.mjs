/* Built only by services-browser.cjs. This API never enters the application. */
import { createCoreServices } from '../../standalone/services/core.mjs';
import { verifyIsolation as verifyOldIsolation } from '../fixtures/standalone-isolation-139d0f9.ts';
import { createImageConverter } from '../../standalone/services/images.mjs';
import { downloadImageAsDataUrl, createThumbnail } from './image-legacy-oracle.mjs';

window.syntheticClock = Date.UTC(2026, 10, 8);
window.serviceEvents = [];
window.serviceErrors = [];
window.audioTrace = [];
window.serviceVisible = true;
window.verifyOldIsolation = () => verifyOldIsolation(new AbortController().signal);
window.oldImage = async (blob, compressed = false) => {const url=URL.createObjectURL(blob);try{const dataUrl=await downloadImageAsDataUrl(url);return {dataUrl,thumbnail:await createThumbnail(compressed?dataUrl:url)}}finally{URL.revokeObjectURL(url)}};
window.convertImage = createImageConverter({ createImage: () => new Image(), createCanvas: () => document.createElement('canvas'),
    createObjectURL: blob => URL.createObjectURL(blob), revokeObjectURL: url => URL.revokeObjectURL(url), setTimeout, clearTimeout });
window.startServices = async ({ noLocks = false, noChannel = false, failAt = null } = {}) => {
    window.coreServices = await createCoreServices({
        storage: localStorage, indexedDB, now: () => window.syntheticClock,
        randomUUID: () => crypto.randomUUID(), random: () => Math.random(),
        appVersion: '7.1.1-local.1.9.3', encodeBase64: value => btoa(unescape(encodeURIComponent(value))),
        compression: window, locks: noLocks ? null : navigator.locks,
        origin: location.origin, fetch: (...args) => fetch(...args), languages: navigator.languages,
        visible: () => window.serviceVisible,
        createAudio(file) { const audio = {file,paused:true,volume:1,loop:false,play(){this.paused=false;audioTrace.push({kind:'play',file,audio:this});return Promise.resolve()},pause(){this.paused=true},removeAttribute(){},load(){}};return audio; },
        image: window.convertImage,
        channel: noChannel || !window.BroadcastChannel ? null : new BroadcastChannel('FocusTodoStandalone.PomodoroDB6:services'),
        saveBackup: async snapshot => {
            window.lastSyntheticBackup = snapshot;
            if (window.holdBackup) {
                window.backupWaiting = true;
                await new Promise(resolve => { window.releaseBackup = resolve; });
            }
        },
        onEvent: (type, detail) => window.serviceEvents.push({ type, detail }),
        onError: error => window.serviceErrors.push(error.message),
        fault: point => { if (point === window.failAt) throw new Error('Synthetic fault: ' + point); },
    });
    window.failAt = failAt;
};
addEventListener('pagehide', event => { if (!event.persisted) window.coreServices?.dispose(); });
