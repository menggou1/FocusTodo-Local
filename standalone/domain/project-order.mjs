/** Legacy preset/custom orderedIds, shared by snapshots and drag previews.
 * Folder membership affects indentation, never the persisted order of a list.
 * Keep stable ties; an ID is an identity, not a user ordering preference. */
export function orderedProjects(rows) {
    return [...rows].sort((a, b) => Number(Number(a.type) < 4000) - Number(Number(b.type) < 4000) ||
        (Number(a.order) || 0) - (Number(b.order) || 0));
}

export function folderProjects(projects, folderId) {
    return projects.filter(row => row.type === 1000 && row.state === 0 && row.parentId === folderId);
}
