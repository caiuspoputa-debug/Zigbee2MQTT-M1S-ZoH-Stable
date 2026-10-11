'use strict';

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const {spawn} = require('node:child_process');

const STATE_FILE = '/tmp/m1s-z2m-gate-state.json';
const {statusCommand} = require('./m1s-readiness-probe.js');

function cancelled() {
    const error = new Error('Operation cancelled');
    error.name = 'AbortError';
    return error;
}

function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(cancelled());
        const timer = setTimeout(done, ms);
        function done() { signal?.removeEventListener('abort', abort); resolve(); }
        function abort() { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(cancelled()); }
        signal?.addEventListener('abort', abort, {once: true});
    });
}

class TelnetFilter {
    constructor() { this.state = 'data'; this.verb = 0; }
    feed(data) {
        const output = [], replies = [];
        for (const value of data) {
            if (this.state === 'data') {
                if (value === 255) this.state = 'iac'; else output.push(value);
            } else if (this.state === 'iac') {
                if (value === 255) { output.push(value); this.state = 'data'; }
                else if ([251,252,253,254].includes(value)) { this.verb = value; this.state = 'option'; }
                else this.state = value === 250 ? 'sub' : 'data';
            } else if (this.state === 'option') {
                if ([251,253].includes(this.verb)) replies.push(255, this.verb === 251 ? 254 : 252, value);
                this.state = 'data';
            } else if (this.state === 'sub') {
                if (value === 255) this.state = 'sub_iac';
            } else if (this.state === 'sub_iac') {
                this.state = value === 240 ? 'data' : 'sub';
            }
        }
        return {text: Buffer.from(output).toString('utf8'), replies: Buffer.from(replies)};
    }
}

function readStatus(options, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(cancelled());
        const socket = net.createConnection({host: options.host, port: options.telnetPort ?? 23});
        const filter = new TelnetFilter();
        let buffer = '', sentUser = false, sentPassword = false, sentCommand = false, settled = false;
        const timer = setTimeout(() => finish(new Error('Coordinator status timed out')), options.timeoutMs ?? 6000);
        const abort = () => finish(cancelled());
        function finish(error, value) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            socket.destroy();
            if (error) reject(error); else resolve(value);
        }
        signal?.addEventListener('abort', abort, {once: true});
        socket.on('error', () => finish(new Error('Coordinator Telnet unavailable')));
        socket.on('close', () => finish(new Error('Coordinator status connection closed')));
        socket.on('data', (data) => {
            const decoded = filter.feed(data);
            if (decoded.replies.length) socket.write(decoded.replies);
            buffer += decoded.text.replace(/\r/g, '');
            if (buffer.length > 65536) return finish(new Error('Invalid coordinator status response'));
            if (/login incorrect|authentication failed/i.test(buffer)) return finish(new Error('Coordinator Telnet login rejected'));
            if (!sentUser && /(?:login|username):\s*$/i.test(buffer)) {
                socket.write((options.username ?? 'admin') + '\r\n');
                sentUser = true; buffer = ''; return;
            }
            if (!sentPassword && /password:\s*$/i.test(buffer)) {
                socket.write((options.password ?? '') + '\r\n');
                sentPassword = true; buffer = ''; return;
            }
            if (!sentCommand && /(?:^|\n)[^\n]*[#$]\s*$/.test(buffer)) {
                socket.write(statusCommand(options.relayPort)); sentCommand = true; buffer = ''; return;
            }
            const match = buffer.match(/(?:^|\n)M1S_READY_BEGIN\n([^\n]+)\nM1S_READY_END(?:\n|$)/);
            if (match) {
                try { finish(null, JSON.parse(match[1])); }
                catch { finish(new Error('Invalid coordinator readiness JSON')); }
            }
        });
    });
}

function normalizeMac(value) { return typeof value === 'string' ? value.toLowerCase().replace(/[:-]/g, '') : ''; }

function validateStatus(status, options, running = false) {
    if (status?.protocol !== 1 || typeof status.ready !== 'boolean') return {ready: false, reason: 'unsupported marker protocol'};
    if (!/^[0-9a-f]{12}$/.test(normalizeMac(status.wifi_mac))) return {ready: false, reason: 'invalid coordinator identity'};
    if (options.expectedMac && normalizeMac(status.wifi_mac) !== normalizeMac(options.expectedMac)) {
        return {ready: false, reason: 'coordinator identity mismatch'};
    }
    if (!status.ready) return {ready: false, reason: /^[a-z_]{1,60}$/.test(status.reason) ? status.reason : 'coordinator not ready'};
    if (!Number.isInteger(status.connections) || status.connections < 0 || status.connections > (running ? 1 : 0)) {
        return {ready: false, reason: 'radio socket already in use'};
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(status.boot_id ?? '') ||
        !Number.isSafeInteger(status.relay_pid) || status.relay_pid < 1 ||
        status.relay_port !== options.relayPort || !/^[1-9]\d*$/.test(status.relay_start ?? '')) {
        return {ready: false, reason: 'invalid ready marker'};
    }
    return {ready: true, reason: 'ready', token: `${status.boot_id}:${status.relay_pid}:${status.relay_start}`};
}

async function waitForChild(handle, ms, signal) {
    const timerController = new AbortController();
    const abort = () => timerController.abort();
    if (signal?.aborted) throw cancelled();
    signal?.addEventListener('abort', abort, {once: true});
    try { await Promise.race([handle.exit, sleep(ms, timerController.signal)]); }
    finally { timerController.abort(); signal?.removeEventListener('abort', abort); }
}

function effectiveSerial(env, loadYaml) {
    const filename = path.join(env.ZIGBEE2MQTT_DATA ?? '/config/zigbee2mqtt', 'configuration.yaml');
    let config = {};
    if (fs.existsSync(filename)) config = loadYaml(fs.readFileSync(filename, 'utf8')) ?? {};
    const adapter = env.ZIGBEE2MQTT_CONFIG_SERIAL_ADAPTER ?? config.serial?.adapter;
    const port = env.ZIGBEE2MQTT_CONFIG_SERIAL_PORT ?? config.serial?.port;
    return {adapter, port};
}

function resolveOptions(serial, env) {
    const enabled = env.M1S_READY_ENABLED !== 'false' && serial.adapter === 'zoh';
    if (!enabled) return {enabled: false};
    let target;
    try { target = new URL(serial.port); } catch { throw new Error('Readiness requires a configured tcp:// coordinator address'); }
    if (target.protocol !== 'tcp:' || target.username || target.password || !target.hostname || !target.port ||
        !['', '/'].includes(target.pathname) || target.search || target.hash) {
        throw new Error('Readiness requires a plain tcp://host:port coordinator address');
    }
    if (!/^\d+$/.test(target.port) || Number(target.port) < 1 || Number(target.port) > 65535) throw new Error('Invalid relay port');
    const username = env.M1S_READY_USERNAME ?? 'admin', password = env.M1S_READY_PASSWORD ?? '';
    if (/\r|\n/.test(username + password)) throw new Error('Invalid Telnet credentials');
    const expectedMac = env.M1S_READY_EXPECTED_MAC ?? '';
    if (expectedMac && !/^[0-9a-f]{12}$/.test(normalizeMac(expectedMac))) throw new Error('Invalid expected coordinator MAC');
    return {enabled: true, host: target.hostname.replace(/^\[|\]$/g, ''), relayPort: Number(target.port), username, password, expectedMac};
}

function spawnZ2M(options) {
    const env = {...options.env};
    // This wrapper owns all retries; an internal watchdog would bypass the ready gate.
    if (options.enabled) delete env.Z2M_WATCHDOG;
    const child = spawn(options.node ?? process.execPath, options.args ?? ['index.js'], {
        cwd: options.cwd ?? '/app', env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let done = false, isStarted = false, tail = '';
    const exit = new Promise((resolve) => {
        child.once('error', () => { done = true; resolve({code: 1, signal: null}); });
        child.once('exit', (code, signal) => { done = true; resolve({code, signal}); });
    });
    child.stdout.on('data', (data) => {
        if (options.output !== false) process.stdout.write(data);
        tail = (tail + data.toString()).slice(-8192);
        if (tail.includes('Zigbee2MQTT started!')) isStarted = true;
    });
    child.stderr.on('data', (data) => { if (options.output !== false) process.stderr.write(data); });
    return {
        child, exit, get done() { return done; }, get started() { return isStarted; },
        async stop() {
            if (done) return;
            child.kill('SIGTERM');
            const timer = setTimeout(() => { if (!done) child.kill('SIGKILL'); }, options.stopTimeoutMs ?? 12000);
            try { await exit; } finally { clearTimeout(timer); }
        },
    };
}

async function supervise(options, dependencies = {}) {
    const signal = dependencies.signal;
    const probe = dependencies.probe ?? ((s) => readStatus(options, s));
    const launch = dependencies.launch ?? (() => spawnZ2M(options));
    const log = dependencies.log ?? ((message) => console.log(`[M1S READY] ${message}`));
    const state = dependencies.state ?? (() => {});
    const pollMs = options.pollMs ?? 5000, runtimePollMs = options.runtimePollMs ?? 10000;
    let handle, attempts = 0, lastNotice = '', noticedAt = 0;
    function notice(message) {
        if (message !== lastNotice || Date.now() - noticedAt >= 60000) {
            log(message); lastNotice = message; noticedAt = Date.now();
        }
    }
    async function status(running = false) {
        try { return validateStatus(await probe(signal), options, running); }
        catch (error) { if (error.name === 'AbortError') throw error; return {ready: false, reason: error.message}; }
    }
    try {
        while (!signal?.aborted) {
            let initial;
            let stableToken;
            while (!signal?.aborted) {
                initial = await status();
                if (initial.ready && stableToken === initial.token) break;
                stableToken = initial.ready ? initial.token : undefined;
                state('waiting_coordinator', initial.reason);
                notice(`Waiting for coordinator: ${initial.reason}. No connection to the Zigbee UART.`);
                await sleep(pollMs, signal);
            }
            if (signal?.aborted) break;
            log('Coordinator readiness verified twice; starting Zigbee2MQTT.');
            state('starting', 'read-only readiness verified');
            handle = launch();
            const startedAt = Date.now();
            let failures = 0;
            while (!handle.done && !signal?.aborted) {
                await waitForChild(handle, runtimePollMs, signal);
                if (handle.done || signal?.aborted) break;
                if (handle.started) state('running', 'Zigbee2MQTT reports successful startup');
                else if (Date.now() - startedAt >= (options.startupTimeoutMs ?? 180000)) {
                    log('Zigbee2MQTT startup timed out; retrying without rebooting the coordinator.');
                    await handle.stop(); break;
                }
                const current = await status(true);
                failures = current.ready ? 0 : failures + 1;
                if ((current.ready && current.token !== initial.token) || failures >= 2) {
                    log('Coordinator became unavailable or changed session; stopping only Zigbee2MQTT and waiting.');
                    state('waiting_coordinator', current.reason);
                    await handle.stop(); break;
                }
            }
            if (signal?.aborted) break;
            const result = await handle.exit;
            if (Date.now() - startedAt >= 60000 && handle.started) attempts = 0;
            attempts += 1;
            const retryMs = Math.min((options.retryBaseMs ?? 5000) * Math.min(attempts, 6), 30000);
            state('retrying', 'child process stopped');
            log(`Zigbee2MQTT stopped (code=${result.code}, signal=${result.signal}); rechecking the coordinator in ${retryMs / 1000}s.`);
            handle = undefined;
            await sleep(retryMs, signal);
        }
    } catch (error) {
        if (error.name !== 'AbortError') throw error;
    } finally {
        state('stopping', 'Stop requested');
        if (handle) await handle.stop();
    }
}

function healthy(record, now = Date.now(), pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } }) {
    return record?.protocol === 1 && Number.isSafeInteger(record.pid) && record.pid > 0 &&
        Number.isFinite(record.updated_at) && now >= record.updated_at && now - record.updated_at < 20000 &&
        ['waiting_coordinator', 'starting', 'running', 'retrying'].includes(record.phase) && pidAlive(record.pid);
}

async function main() {
    if (process.argv.includes('--healthcheck')) {
        try { return healthy(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))) ? 0 : 1; } catch { return 1; }
    }
    const yaml = require('js-yaml');
    const options = {...resolveOptions(effectiveSerial(process.env, (text) => yaml.load(text)), process.env), env: process.env};
    if (!options.enabled) {
        // Preserve the stock behavior for non-ZoH adapters or an explicit opt-out.
        const handle = spawnZ2M(options), controller = new AbortController();
        const record = {protocol: 1, pid: process.pid, phase: 'starting', updated_at: Date.now()};
        const startedAt = Date.now();
        const beat = () => {
            record.updated_at = Date.now(); if (handle.started) record.phase = 'running';
            if (!handle.started && Date.now() - startedAt > 180000) record.phase = 'startup_failed';
            fs.writeFileSync(STATE_FILE, JSON.stringify(record), {mode: 0o600});
        };
        beat(); const timer = setInterval(beat, 5000);
        const stop = () => { controller.abort(); void handle.stop(); };
        process.once('SIGTERM', stop); process.once('SIGINT', stop);
        try { const result = await handle.exit; return controller.signal.aborted ? 0 : (result.code ?? 1); }
        finally { clearInterval(timer); fs.rmSync(STATE_FILE, {force: true}); }
    }
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once('SIGTERM', stop); process.once('SIGINT', stop);
    const record = {protocol: 1, pid: process.pid, phase: 'waiting_coordinator', updated_at: Date.now()};
    const beat = () => {
        record.updated_at = Date.now();
        const temp = STATE_FILE + '.tmp';
        fs.writeFileSync(temp, JSON.stringify(record), {mode: 0o600}); fs.renameSync(temp, STATE_FILE);
    };
    beat(); const timer = setInterval(beat, 5000);
    try {
        await supervise(options, {signal: controller.signal, state: (phase, reason) => { record.phase = phase; record.reason = reason; beat(); }});
        return 0;
    } finally { clearInterval(timer); fs.rmSync(STATE_FILE, {force: true}); }
}

module.exports = {TelnetFilter, readStatus, validateStatus, effectiveSerial, resolveOptions, spawnZ2M, supervise, healthy, sleep, waitForChild};
if (require.main === module) main().then((code) => { process.exitCode = code; }).catch(() => {
    console.error('[M1S READY] Configuration or gate failure. Check serial/readiness settings; credentials are not logged.');
    process.exitCode = 1;
});
