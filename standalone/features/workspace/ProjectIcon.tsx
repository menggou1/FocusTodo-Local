import today from '../../../public/img/project-today.png';
import tomorrow from '../../../public/img/project-tomorrow.png';
import week from '../../../public/img/project-week.png';
import planned from '../../../public/img/project-upcoming.png';
import someday from '../../../public/img/project-someday.png';
import overdue from '../../../public/img/project-overdue.png';
import seven from '../../../public/img/project-next7days.png';
import high from '../../../public/img/project-priority-high.png';
import medium from '../../../public/img/project-priority-medium.png';
import low from '../../../public/img/project-priority-low.png';
import all from '../../../public/img/project-all.png';
import calendar from '../../../public/img/project-calendar.png';
import history from '../../../public/img/prj-history.png';
import tasks from '../../../public/img/project-tasks.png';
import project from '../../../public/img/project.png';
import folder from '../../../public/img/folder.png';

const icons: Record<number, string> = { 1000: project, 2000: folder, 4000: today, 4001: tomorrow, 4002: planned, 4003: someday, 4004: seven, 4006: overdue, 4007: week, 5001: low, 5002: medium, 5003: high, 7000: all, 7001: calendar, 7003: history, 7005: tasks };
export function ProjectIcon({ type }: { type: number }) { return <img className="workspace-nav-icon" src={icons[type] || project} alt="" />; }
