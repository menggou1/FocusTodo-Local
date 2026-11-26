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

export function sidebarTaskDropKind(project) {
    if (project?.state !== 0) return null;
    if ([1000, 7005].includes(project.type)) return 'list';
    if ([4000, 4001, 4003].includes(project.type)) return 'deadline';
    if ([5001, 5002, 5003].includes(project.type)) return 'priority';
    return project.type === 3000 ? 'tag' : null;
}

export function sidebarTaskChanges(task, project, now) {
    switch (sidebarTaskDropKind(project)) {
    case 'list': return task.projectId === project.id ? {} : { projectId: project.id };
    case 'deadline': {
        const date = new Date(now);
        if (project.type === 4001) date.setDate(date.getDate() + 1);
        return deadlineChanges(task, project.type === 4003 ? 0 : date.setHours(23, 59, 59, 999));
    }
    case 'priority': {
        const priority = project.type - 5000;
        return task.priority === priority ? {} : { priority };
    }
    case 'tag': {
        const tags = String(task.tags || '').split(',').filter(Boolean);
        return tags.includes(project.id) ? {} : { tags: [...tags, project.id].join(',') };
    }
    default: return null;
    }
}
