/* Pure calendar rules migrated from local-calendar.js at 139d0f9. */
export function deadlineInSevenDays(now = Date.now()) {
        const date = new Date(now); date.setDate(date.getDate() + 7); date.setHours(23, 59, 59, 999); return date.getTime();
    }
    // Half-open intervals: an event ending when another begins can reuse its column.
    // Include the visible minimum height so even very short records remain clickable.
export function layoutEvents(events, dayStart, dayEnd, minuteHeight) {
        const rows = events.map(event => {
            const start = Math.max(dayStart, Number(event.start)), end = Math.min(dayEnd, Number(event.end));
            return { event, start, end: Math.min(dayEnd, Math.max(end, start + 18 / minuteHeight * 60000)) };
        }).filter(row => Number.isFinite(row.start) && Number.isFinite(row.end) && row.end > row.start &&
            Number(row.event.end) > dayStart && Number(row.event.start) < dayEnd)
            .sort((a, b) => a.start - b.start || a.end - b.end || String(a.event.id).localeCompare(String(b.event.id)));
        let group = [], active = [], groupEnd = -Infinity, columns = 0;
        const finish = () => { group.forEach(row => { row.columns = columns; }); group = []; active = []; columns = 0; };
        for (const row of rows) {
            if (row.start >= groupEnd) finish();
            active = active.filter(item => item.end > row.start);
            const used = new Set(active.map(item => item.column)); let column = 0;
            while (used.has(column)) column++;
            row.column = column; active.push(row); group.push(row); columns = Math.max(columns, column + 1);
            groupEnd = group.length === 1 ? row.end : Math.max(groupEnd, row.end);
        }
        finish(); return rows;
    }
