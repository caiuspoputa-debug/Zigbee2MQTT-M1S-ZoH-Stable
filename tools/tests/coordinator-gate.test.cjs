'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const appConfig = require('../../zigbee2mqtt_m1s_zoh/config.json');
const {supervise, validateStatus, resolveOptions, TelnetFilter, healthy, readStatus, spawnZ2M, sleep} =
    require('../../zigbee2mqtt_m1s_zoh/rootfs/app/m1s-coordinator-gate.js');
const {statusCommand} = require('../../zigbee2mqtt_m1s_zoh/rootfs/app/m1s-readiness-probe.js');
const good = (extra = {}) => ({protocol: 1, ready: true, reason: 'ready', wifi_mac: '00:11:22:33:44:55',
    boot_id: '11111111-1111-1111-1111-111111111111', relay_pid: 123, relay_port: 1886, relay_start: '500', connections: 0, ...extra});
const options = {enabled: true, relayPort: 1886, pollMs: 1, runtimePollMs: 1, retryBaseMs: 1};

test('M1S app avoids host port conflict and gates new installs by default', () => {
    assert.equal(appConfig.version, '0.1.5');
    assert.equal(appConfig.ports['8485/tcp'], null);
    assert.equal(appConfig.options.socat.enabled, false);
    assert.equal(appConfig.options.coordinator_readiness.enabled, true);
    assert.equal(appConfig.ports['8099/tcp'], null);
    assert.equal(appConfig.ingress_port, 8099);
});

test('validates fresh identity and rejects malformed/occupied readiness', () => {
    assert.equal(validateStatus(good(), options).ready, true);
    for (const bad of [{protocol: 2}, {ready: false}, {relay_port: 23}, {relay_pid: 0}, {relay_start: '0'}, {boot_id: 'old'}, {wifi_mac: 'bad'}, {connections: 1}]) {
        assert.equal(validateStatus(good(bad), options).ready, false);
    }
    assert.equal(validateStatus(good({connections: 1}), options, true).ready, true);
    assert.equal(validateStatus(good({connections: 2}), options, true).ready, false);
    assert.equal(validateStatus(good(), {...options, expectedMac: '001122334456'}).ready, false);
});
test('resolves serial host and protects credentials against injection', () => {
    assert.deepEqual(resolveOptions({adapter: 'ember'}, {}), {enabled: false});
    assert.equal(resolveOptions({adapter: 'zoh', port: 'tcp://192.0.2.1:1886'}, {}).host, '192.0.2.1');
    for (const port of ['1886', 'http://example:1886', 'tcp://user:pass@example:1886', 'tcp://example:0', 'tcp://example:1886/x']) {
        assert.throws(() => resolveOptions({adapter: 'zoh', port}, {}));
    }
    assert.throws(() => resolveOptions({adapter: 'zoh', port: 'tcp://example:1886'}, {M1S_READY_USERNAME: 'admin\nreboot'}));
    assert.throws(() => statusCommand('1886; reboot'));
});
test('Telnet negotiation survives fragmented IAC and refuses options', () => {
    const filter = new TelnetFilter();
    assert.equal(filter.feed(Buffer.from([255, 251])).text, '');
    const result = filter.feed(Buffer.from([1, 65, 255, 255]));
    assert.deepEqual(result.replies, Buffer.from([255, 254, 1]));
    assert.equal(result.text, 'A\ufffd');
    assert.equal(filter.feed(Buffer.from([255, 250, 1, 2, 255, 240, 66])).text, 'B');
});
test('healthcheck treats intentional waiting as healthy, not stopped or stale', () => {
    for (const phase of ['waiting_coordinator', 'starting', 'running', 'retrying']) {
        assert.equal(healthy({protocol: 1, pid: 1, updated_at: 100, phase}, 110, () => true), true);
    }
    assert.equal(healthy({protocol: 1, pid: 1, updated_at: 100, phase: 'stopping'}, 110, () => true), false);
    assert.equal(healthy({protocol: 1, pid: 1, updated_at: 100, phase: 'running'}, 20100, () => true), false);
});

function launchFixture(controller, onLaunch = () => {}) {
    let launches = 0, stops = 0;
    return {get launches() {return launches;}, get stops() {return stops;}, launch() {
        launches++; let resolveExit, done = false;
        const exit = new Promise(resolve => {resolveExit = resolve;});
        const handle = {exit, started: true, get done() {return done;}, async stop() {
            if (!done) {done = true; stops++; resolveExit({code: 0, signal: 'SIGTERM'});}
        }};
        onLaunch(launches, handle, controller);
        return handle;
    }};
}
test('waits indefinitely without radio connection and stops promptly on manual Stop', async () => {
    const controller = new AbortController(); let probes = 0;
    const fixture = launchFixture(controller);
    await supervise(options, {signal: controller.signal, probe: async () => {
        if (++probes === 5) controller.abort(); return good({ready: false});
    }, launch: fixture.launch, log() {}});
    assert.equal(fixture.launches, 0); assert.equal(probes, 5);
});
test('requires two identical fresh probes before launch', async () => {
    const controller = new AbortController(); let probes = 0;
    const fixture = launchFixture(controller, () => controller.abort());
    await supervise(options, {signal: controller.signal, probe: async () => {
        probes++; return good({relay_start: probes === 1 ? '499' : '500'});
    }, launch: fixture.launch, log() {}});
    assert.equal(probes, 3); assert.equal(fixture.launches, 1); assert.equal(fixture.stops, 1);
});
test('one transient probe failure does not interrupt playback; two failures isolate child', async () => {
    const controller = new AbortController(); let probes = 0;
    const fixture = launchFixture(controller, count => {if (count === 2) controller.abort();});
    await supervise(options, {signal: controller.signal, probe: async () => {
        probes++;
        return good({ready: ![3, 5, 6].includes(probes)});
    }, launch: fixture.launch, log() {}});
    assert.equal(fixture.launches, 2); assert.equal(fixture.stops, 2);
    assert.ok(probes >= 8);
});
test('detects reboot or relay replacement and relaunches after stable readiness', async () => {
    const controller = new AbortController(); let probes = 0;
    const fixture = launchFixture(controller, count => {if (count === 2) controller.abort();});
    await supervise(options, {signal: controller.signal, probe: async () => good({relay_start: ++probes <= 2 ? '500' : '600'}),
        launch: fixture.launch, log() {}});
    assert.equal(fixture.launches, 2); assert.equal(fixture.stops, 2);
});
test('retries child crashes without finite watchdog exhaustion', async () => {
    const controller = new AbortController();
    const fixture = launchFixture(controller, (count, handle) => {
        if (count === 8) controller.abort(); else void handle.stop();
    });
    await supervise(options, {signal: controller.signal, probe: async () => good(), launch: fixture.launch, log() {}});
    assert.equal(fixture.launches, 8); assert.equal(fixture.stops, 8);
});
test('startup timeout stops child and permits clean retry', async () => {
    const controller = new AbortController();
    const fixture = launchFixture(controller, (count, handle) => {handle.started = false; if (count === 2) controller.abort();});
    await supervise({...options, startupTimeoutMs: 0}, {signal: controller.signal, probe: async () => good(), launch: fixture.launch, log() {}});
    assert.equal(fixture.launches, 2); assert.equal(fixture.stops, 2);
});
test('aborts sleep promptly', async () => {
    const controller = new AbortController(); const waiting = sleep(100000, controller.signal); controller.abort();
    await assert.rejects(waiting, {name: 'AbortError'});
});
test('real child starts, forwards startup detection, and stops without orphan process', async () => {
    const handle = spawnZ2M({enabled: true, env: {...process.env, Z2M_WATCHDOG: '100'}, cwd: process.cwd(), output: false,
        args: ['-e', 'console.log("Zigbee2MQTT started!"); setInterval(()=>{},1000)'], stopTimeoutMs: 500});
    try {
        for (let n = 0; n < 100 && !handle.started; n++) await sleep(10);
        assert.equal(handle.started, true);
    } finally {await handle.stop();}
    assert.equal(handle.done, true);
});
test('reads fresh status over a simulated Telnet session despite command echo', async () => {
    const server = net.createServer(socket => {
        socket.write('M1S login: '); let state = 0, buffer = '';
        socket.on('data', chunk => {
            buffer += chunk.toString();
            if (!buffer.endsWith('\r\n')) return;
            if (state === 0) {assert.equal(buffer, 'admin\r\n'); state++; socket.write('# ');}
            else {
                assert.ok(buffer.includes('/proc/')); assert.ok(!buffer.includes('readiness.sh'));
                socket.write(buffer + '\r\nM1S_READY_BEGIN\r\n' + JSON.stringify(good()) + '\r\nM1S_READY_END\r\n# ');
            }
            buffer = '';
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const result = await readStatus({host: '127.0.0.1', telnetPort: server.address().port, relayPort: 1886, timeoutMs: 2000});
        assert.equal(validateStatus(result, options).ready, true);
    } finally {await new Promise(resolve => server.close(resolve));}
});
