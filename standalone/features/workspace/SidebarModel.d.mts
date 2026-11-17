import type { Entity } from '../../services/core.mjs';
export interface SidebarItem {id:string;project:Entity|null;parent:Entity|null}
export function sidebarItems(projects:readonly Entity[],collapsed?:Set<string>):SidebarItem[];
export function sidebarMinutes(minutes:number):string;
export function sidebarMove(items:readonly SidebarItem[],fromId:string,toId:string):{id:string;order:number;parentId:string}|null;
