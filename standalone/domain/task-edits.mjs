/** Actual 1.9.3 TaskActions.updateDeadlineOfTask semantics. */
export function deadlineChanges(task, deadline) {
    if (task.deadline === deadline) return {};
    const changes = { deadline };
    if (Number(task.rCycle)) {
        if (deadline === 0) Object.assign(changes, { rCycle: 0, rFirstDeadline: 0, rUnit: '', rValue: '', rId: '' });
        else changes.rFirstDeadline = deadline;
    }
    return changes;
}
