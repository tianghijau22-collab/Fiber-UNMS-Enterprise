import catalog from '../../navigation/sidebar.json';

export const OLT_REGION_MENU = '@olt-regions';
export const DEFAULT_SIDEBAR_ORDER = catalog;
export const defaultSidebarPreferences = () => ({ order:[...catalog], super_admin_hidden:[] });
export function normalizeSidebarPreferences(value) {
  const order=[...new Set((Array.isArray(value?.order)?value.order:[]).filter(id=>catalog.includes(id)))];
  return {order:[...order,...catalog.filter(id=>!order.includes(id))],super_admin_hidden:[...new Set((Array.isArray(value?.super_admin_hidden)?value.super_admin_hidden:[]).filter(id=>catalog.includes(id)))]};
}
export function moveSidebarItem(order, id, target) {
  const next=[...order], from=next.indexOf(id), to=next.indexOf(target);
  if (from<0||to<0||from===to) return next;
  next.splice(from,1);next.splice(to,0,id);return next;
}
export function sidebarItems(modules, preferences) {
  const byId=new Map(modules.map(m=>[m.path,{...m,id:m.path}]));
  byId.set(OLT_REGION_MENU,{id:OLT_REGION_MENU,path:'/network',name:'Daftar Wilayah OLT',category:'Infrastruktur Jaringan & OLT',desc:'Blok pintasan wilayah dan perangkat OLT pada sidebar.'});
  return normalizeSidebarPreferences(preferences).order.map(id=>byId.get(id)).filter(Boolean);
}
export function isSidebarItemVisible(item,user,canAccessRoute,preferences) {
  return canAccessRoute(item.path)&&!(user?.role==='Super Administrator'&&normalizeSidebarPreferences(preferences).super_admin_hidden.includes(item.id));
}
