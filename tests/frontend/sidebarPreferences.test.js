import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The production JSON import is bundled by Vite; use a data URL for Node versions requiring JSON import attributes.
const file=new URL('../../resources/js/lib/sidebarPreferences.js',import.meta.url);
const source=fs.readFileSync(file,'utf8').replace("import catalog from '../../navigation/sidebar.json';",`const catalog=${fs.readFileSync(new URL('../../resources/navigation/sidebar.json',import.meta.url),'utf8')};`);
const {defaultSidebarPreferences,normalizeSidebarPreferences,moveSidebarItem,sidebarItems,isSidebarItemVisible}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

test('defaults and normalization preserve every known menu while rejecting unknown and duplicate IDs',()=>{
 const d=defaultSidebarPreferences();const n=normalizeSidebarPreferences({order:['/users','/unknown','/users'],super_admin_hidden:['/unknown','/users','/users']});
 assert.equal(n.order[0],'/users');assert.equal(n.order.length,d.order.length);assert.equal(new Set(n.order).size,d.order.length);assert.deepEqual(n.super_admin_hidden,['/users']);assert.deepEqual(normalizeSidebarPreferences(null),d);
});
test('moving menus works in both directions without changing the original order or dropping entries',()=>{
 const start=['a','b','c','d'];assert.deepEqual(moveSidebarItem(start,'a','c'),['b','c','a','d']);assert.deepEqual(moveSidebarItem(start,'d','b'),['a','d','b','c']);assert.deepEqual(start,['a','b','c','d']);assert.deepEqual(moveSidebarItem(start,'unknown','a'),start);
});
test('sidebar order includes the regional block and keeps module identities separate from the network route',()=>{
 const p=defaultSidebarPreferences();p.order=moveSidebarItem(p.order,'@olt-regions','/users');const items=sidebarItems([{path:'/network',name:'Network'},{path:'/users',name:'Users'}],p);
 assert.deepEqual(items.map(i=>i.id),['/network','/users','@olt-regions']);assert.equal(items.at(-1).path,'/network');
});
test('admin hiding changes visibility only and never grants another role access',()=>{
 const item={id:'/customers',path:'/customers'},prefs={super_admin_hidden:['/customers']};let calls=0;const allow=()=>{calls++;return true;};
 assert.equal(isSidebarItemVisible(item,{role:'Super Administrator'},allow,prefs),false);assert.equal(calls,1);assert.equal(isSidebarItemVisible(item,{role:'Customer Service'},allow,prefs),true);assert.equal(isSidebarItemVisible(item,{role:'Customer Service'},()=>false,prefs),false);
});
