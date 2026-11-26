const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { performance } = require('node:perf_hooks');

const root = path.resolve(__dirname, '../..');
const modulePath = 'standalone/services/business.mjs';
const baseline = '34826d633a44d16736a53857cb62358dbd9dbd7b';
const searchUrl = pathToFileURL(path.join(root, modulePath));
const queries = 7;

async function loadBaseline() {
    const source = execFileSync('git', ['show', baseline + ':' + modulePath], { cwd: root, encoding: 'utf8' });
    const linked = source.replace(/from '([.][^']+)'/g, (_, relative) => 'from ' + JSON.stringify(new URL(relative, searchUrl).href));
    return import('data:text/javascript;base64,' + Buffer.from(linked).toString('base64'));
}

function fixture(size) {
    const Task = Array.from({ length: size }, (_, index) => ({
        id: 'task-' + index, state: 0, name: 'Task ' + index, remark: 'Notes for ' + index,
        tags: 'blue, shared', isFinished: index % 4 === 0,
    }));
    return {
        Task,
        Subtask: Task.flatMap(task => [0, 1].map(index => ({ id: task.id + '-' + index, taskId: task.id, state: 0, name: 'Step ' + index }))),
        Project: [
            { id: 'blue', type: 3000, state: 0, name: 'Blue label' },
            { id: 'shared', type: 3000, state: 0, name: 'Shared label' },
        ],
        Schedule: [], Pomodoro: [], TimerSession: [],
    };
}

async function run(create, tables) {
    const business = create({ data: {
        read: (_tables, read) => new Promise((resolve, reject) => read({
            objectStore: name => ({
                getAll() {
                    const request = { result: tables[name] };
                    queueMicrotask(() => request.onsuccess());
                    return request;
                },
            }),
        }, resolve, reject)),
    } });
    await business.refresh();
    function sample(query) {
        const start = performance.now();
        const matches = business.search(query);
        const duration = performance.now() - start;
        assert.equal(matches.length, 0);
        return duration;
    }
    const cold = sample('unmatched-cold');
    for (let index = 0; index < 3; index++) sample('unmatched-warm-up-' + index);
    const uncached = Array.from({ length: queries }, (_, index) => sample('unmatched-query-' + index));
    const cached = Array.from({ length: queries }, () => sample('unmatched-query-0'));
    assert.equal(business.search('Step 0').length, tables.Task.length);
    const median = durations => durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)];
    return { cold, uncached: median(uncached), repeated: median(cached) };
}

(async () => {
    const [before, after] = await Promise.all([loadBaseline(), import(searchUrl.href)]);
    console.log('Node ' + process.version + ' on ' + process.platform + ' ' + process.arch);
    console.log('Service-only lookup, with one cold query and medians of seven uncached or repeated queries (ms)');
    const results = [];
    for (const size of [1000, 2000, 4000, 8000]) {
        const tables = fixture(size);
        const reference = await run(before.createBusinessService, tables);
        const current = await run(after.createBusinessService, tables);
        const ms = value => Number(value.toFixed(4));
        results.push({ tasks: size, subtasks: size * 2,
            oldCold: ms(reference.cold), newCold: ms(current.cold),
            oldUncached: ms(reference.uncached), newUncached: ms(current.uncached),
            oldRepeated: ms(reference.repeated), newRepeated: ms(current.repeated),
        });
    }
    console.table(results);
})().catch(error => { console.error(error); process.exitCode = 1; });
