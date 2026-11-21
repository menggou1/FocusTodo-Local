const index = value => Number.isFinite(value) ? value : 0;

export function orderedTasks(rows) {
    return [...rows].sort((a, b) => index(a.order) - index(b.order) || a.id.localeCompare(b.id));
}

/** Preserve existing slots except when there is no representable gap. */
export function taskMoveOrders(rows, from, to, after) {
    const ordered = orderedTasks(rows);
    const source = ordered.find(row => row.id === from);
    const peers = ordered.filter(row => row.id !== from);
    const anchor = peers.findIndex(row => row.id === to);
    if (!source || anchor < 0) return [];
    const target = anchor + Number(after);
    if (target === ordered.indexOf(source)) return [];
    const before = peers[target - 1], next = peers[target];
    const lower = before ? index(before.order) : -Infinity;
    const upper = next ? index(next.order) : Infinity;
    const order = !before ? upper - 10000 : !next ? lower + 10000 : lower / 2 + upper / 2;
    if (Number.isFinite(order) && lower < order && order < upper) return [{ id: from, order }];
    peers.splice(target, 0, source);
    return peers.map((row, i) => ({ id: row.id, order: i * 10000 }));
}
