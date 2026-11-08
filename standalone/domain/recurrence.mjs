import { invariant } from '../services/errors.mjs';
const endOfDay = value => { const date = new Date(value); date.setHours(23, 59, 59, 999); return date; };
/** Calendar arithmetic matches legacy moment rules, including month-end clamp. */
export function nextRepetitionDate(task, value) {
    invariant(Number.isInteger(task.rCycle) && task.rCycle > 0 && task.rCycle <= 10000, 'Invalid recurrence cycle');
    const date = endOfDay(value), cycle = task.rCycle;
    invariant(Number.isFinite(date.getTime()), 'Invalid recurrence date');
    if (task.rUnit === 'days') date.setDate(date.getDate() + cycle);
    else if (task.rUnit === 'weeks') {
        const days = String(task.rValue).split(',').map(Number);
        invariant(days.length && days.every(day => Number.isInteger(day) && day >= 0 && day <= 6), 'Invalid recurrence weekdays');
        if (days[0] === 0) { days.shift(); days.push(7); }
        days.push(days[0] + 7 * cycle);
        const day = date.getDay() || 7, next = days.find(next => next > day);
        invariant(next !== undefined, 'Recurrence must advance'); date.setDate(date.getDate() + next - day);
    } else if (task.rUnit === 'months') {
        const first = new Date(task.rFirstDeadline); first.setDate(1); first.setHours(0, 0, 0, 0);
        const offset = task.rFirstDeadline - first.getTime();
        const next = new Date(date); next.setDate(1); next.setHours(0, 0, 0, 0); next.setMonth(next.getMonth() + cycle);
        const end = new Date(next); end.setMonth(end.getMonth() + 1); end.setMilliseconds(-1);
        return Math.min(next.getTime() + offset, end.getTime());
    } else {
        // moment.add(years) clamps Feb 29 instead of rolling into March.
        const month = date.getMonth(), day = date.getDate(); date.setDate(1); date.setFullYear(date.getFullYear() + cycle);
        const last = new Date(date); last.setMonth(month + 1, 0); date.setDate(Math.min(day, last.getDate()));
    }
    return date.getTime();
}
export function repetitionDeadline(task, now) {
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    let value = task.deadline;
    for (let count = 0; count < 100000; count++) {
        const next = nextRepetitionDate(task, value);
        invariant(next > value && Number.isFinite(next), 'Recurrence did not advance'); value = next;
        if (value >= today.getTime()) return value;
    }
    throw new Error('Recurrence catch-up exceeds supported range');
}
