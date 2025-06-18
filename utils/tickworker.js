// tickWorker.js
import { parentPort } from 'worker_threads';

const TICK_RATE = 70;
const TICK_INTERVAL = 1000 / TICK_RATE;

setInterval(() => {
    parentPort.postMessage(Date.now());
}, TICK_INTERVAL);
