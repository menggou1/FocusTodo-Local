import { orderedProjects } from '../../domain/project-order.mjs';
/* Read-only layout and hover projection reconstructed from legacy modules 863/868. */
export function sidebarItems(projects, collapsed = new Set()) {
  const rows = orderedProjects(projects.filter(row => row.state === 0 && [1000, 2000, 3000].includes(row.type)));
  const ids = new Set(rows.map(row=>row.id)), roots=[],children=new Map();
  for(const row of rows){if(row.parentId&&ids.has(row.parentId)){if(!children.has(row.parentId))children.set(row.parentId,[]);children.get(row.parentId).push(row)}else roots.push(row)}
  const result=[];
  for(const row of roots){result.push({id:row.id,project:row,parent:null});if(row.type===2000&&row.expanded&&!collapsed.has(row.id)){const nested=children.get(row.id)||[];if(nested.length)result.push(...nested.map(project=>({id:project.id,project,parent:row})));else result.push({id:row.id+':empty',project:null,parent:row})}}
  return result;
}
export function sidebarMinutes(minutes){const hours=Math.floor(minutes/60),rest=Math.round(minutes%60);return(hours?hours+'h'+(rest?' ':''):'')+(rest===0&&hours?'':rest+'m')}
/** The legacy hover projection changes only the dragged row. Commit belongs to drag end. */
export function sidebarMove(items, fromId, toId) {
  const from=items.findIndex(row=>row.id===fromId),to=items.findIndex(row=>row.id===toId);
  if(from<0||to<0||from===to||!items[from].project)return null;
  const source=items[from].project,target=items[to].project;
  if((source.type===2000||source.type===3000)&&items[to].parent)return null;
  let order=source.order,parentId='';
  if(to>from){
    if(to>=items.length-1){if(target){order=target.order+10000;if(source.type===1000&&target.parentId)parentId=target.parentId}else parentId=items[to-1]?.project?.id||items[to].parent?.id||''}
    else if(target){let next=null;if(source.type===1000){next=items[to+1].project;if(next){if(target.type===2000){order=next.order-10000;parentId=target.id}else if(target.parentId){parentId=target.parentId;order=next.parentId?(target.order+next.order)/2:target.order+10000}else order=(target.order+next.order)/2}else parentId=target.id}
      else{for(let i=to+1;i<items.length;i++)if(items[i].parent===null){next=items[i].project;break}order=next?(target.order+next.order)/2:target.order+10000}}
    else parentId=items[to-1]?.project?.id||items[to].parent?.id||'';
  }else{
    if(to<=0){if(!target)return null;order=target.order-10000}
    else if(target){let previous=null;if(source.type===1000){previous=items[to-1].project;if(previous){if(previous.type===2000){order=target.order-10000;parentId=previous.id}else if(previous.parentId){parentId=previous.parentId;order=target.parentId?(target.order+previous.order)/2:previous.order+10000}else order=(target.order+previous.order)/2}else parentId=items[to-2]?.project?.id||items[to].parent?.id||''}
      else{for(let i=to-1;i>=0;i--)if(items[i].parent===null){previous=items[i].project;break}if(!previous)return null;order=(target.order+previous.order)/2}}
    else parentId=items[to-1]?.project?.id||items[to].parent?.id||'';
  }
  return {id:source.id,order,parentId};
}
