import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

const button='px-3 py-2 text-xs font-semibold rounded-md border border-black/60 dark:border-white/60 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed';
const field='block w-full mt-1 bg-white dark:bg-black border border-black/40 dark:border-white/40 rounded-md px-3 py-2 text-xs';
const types={splice:'Sambungan core',splitter:'Percabangan splitter',termination:'Terminasi pada node'};
const date=value=>value?new Date(value).toLocaleString('id-ID'):'—';
const arrow=d=>d.direction==='a_to_b'?`${d.a.label} → ${d.b.label}`:`${d.b.label} → ${d.a.label}`;
const coreSummary=d=>['a','b'].filter(side=>d[side].kind==='cable').map(side=>`${side.toUpperCase()}: core ${d[side].core??'belum diketahui'}`).join(' · ');

async function api(url, body) {
  const response=await fetch(url,body===undefined?{headers:{Accept:'application/json'}}:{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-TOKEN':document.querySelector('meta[name="csrf-token"]')?.content??''},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>null);
  if (!response.ok) throw Error(Object.values(data?.errors||{}).flat()[0]||data?.message||'Permintaan gagal. Periksa koneksi dan sesi login, lalu coba lagi.');
  if (!data) throw Error('Respons server tidak lengkap. Periksa daftar sebelum mencoba kembali.');
  return data;
}

export default function TopologyConnectionRegistry({ candidate, tolerance, accepted, note, onBusyChange, onDraftChange }) {
  const {currentUser}=useAuth();
  const canWrite=['Super Administrator','Operator Jaringan'].includes(currentUser?.role);
  const [prepared,setPrepared]=useState(null),[form,setForm]=useState({}),[preparing,setPreparing]=useState(false),[writing,setWriting]=useState(false);
  const [notice,setNotice]=useState(''),[error,setError]=useState(''),[listError,setListError]=useState('');
  const [opened,setOpened]=useState(false),[state,setState]=useState('verified'),[page,setPage]=useState(1),[reload,setReload]=useState(0),[loading,setLoading]=useState(false),[listing,setListing]=useState(null);
  const [history,setHistory]=useState(null),[historyError,setHistoryError]=useState(''),[historyBusy,setHistoryBusy]=useState(false);
  const [revoke,setRevoke]=useState(null),[reason,setReason]=useState('');
  const alive=useRef(true),writeLock=useRef(false),prepareJob=useRef(0),listJob=useRef(0),historyJob=useRef(0);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;prepareJob.current++;listJob.current++;historyJob.current++;};},[]);
  useEffect(()=>{onBusyChange(writing);return()=>onBusyChange(false);},[writing,onBusyChange]);
  useEffect(()=>{onDraftChange(!!prepared||preparing);return()=>onDraftChange(false);},[prepared,preparing,onDraftChange]);
  useEffect(()=>{setForm(previous=>({...previous,confirmed:false}));},[accepted,candidate?.id]);
  useEffect(()=>{
    if (!prepared && !writing) return;
    const guard=e=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',guard);
    return()=>window.removeEventListener('beforeunload',guard);
  },[prepared,writing]);
  useEffect(()=>{
    if (!opened) return;
    const token=++listJob.current;setLoading(true);setListError('');
    api(`/api/topology-connections?state=${state}&page=${page}`).then(data=>{
      if (!alive.current||token!==listJob.current) return;
      if (!Array.isArray(data.data)||!Number.isInteger(data.last_page)) throw Error('Respons daftar hubungan tidak lengkap.');
      if (page>data.last_page) {setPage(data.last_page);return;}setListing(data);
    }).catch(err=>{if(alive.current&&token===listJob.current)setListError(err.message);}).finally(()=>{if(alive.current&&token===listJob.current)setLoading(false);});
    return()=>{listJob.current++;};
  },[opened,state,page,reload]);

  const prepare=async()=>{
    if(!canWrite||!candidate||preparing||writing||prepared||(!accepted&&!candidate.existing))return;
    const token=++prepareJob.current;setPreparing(true);setError('');setNotice('');
    try {
      const params=new URLSearchParams({candidate_id:candidate.id,tolerance:String(tolerance),a_lat:String(candidate.a.lat),a_lng:String(candidate.a.lng),b_lat:String(candidate.b.lat),b_lng:String(candidate.b.lng)});
      const response=await api('/api/topology-connections/prepare?'+params);if(!alive.current||token!==prepareJob.current)return;
      const p=response.data;if(!p?.source_version||!Array.isArray(p.junction_nodes)||!Array.isArray(p.olts))throw Error('Respons formulir tidak lengkap. Coba lagi.');
      const node=p.junction_nodes.length===1?p.junction_nodes[0]:null;
      setPrepared(p);setForm({node_id:node?String(node.id):'',direction:'',connection_type:'',olt_id:node?.olt_device_id?String(node.olt_device_id):'',pon:node?.pon?.includes(',')?'':(node?.pon||'').replace(/^gpon-(olt|onu)_/i,''),core_a:'',core_b:'',note:note||'',confirmed:false});
    }catch(err){if(alive.current&&token===prepareJob.current)setError(err.message);}
    finally{if(alive.current&&token===prepareJob.current)setPreparing(false);}
  };
  const patch=values=>setForm(previous=>({...previous,...values}));
  const chooseNode=id=>{const node=prepared.junction_nodes.find(n=>String(n.id)===id);patch({node_id:id,olt_id:node?.olt_device_id?String(node.olt_device_id):'',pon:node?.pon?.includes(',')?'':(node?.pon||'').replace(/^gpon-(olt|onu)_/i,''),confirmed:false});};
  const save=async event=>{
    event.preventDefault();if(writeLock.current||!prepared||candidate?.id!==prepared.candidate_id||(!accepted&&!candidate?.existing))return;
    const node=prepared.junction_nodes.find(n=>String(n.id)===form.node_id);if(!node)return;
    writeLock.current=true;setWriting(true);setError('');setNotice('');
    try{
      const response=await api('/api/topology-connections',{candidate_id:prepared.candidate_id,tolerance:prepared.tolerance_meters,source_version:prepared.source_version,
        junction_node_id:node.id,junction_version:node.version,direction:form.direction,connection_type:form.connection_type,olt_device_id:Number(form.olt_id),pon:form.pon,
        core_a:form.core_a===''?null:Number(form.core_a),core_b:form.core_b===''?null:Number(form.core_b),note:form.note,confirmed:form.confirmed});
      if(!response.id||response.status!=='success')throw Error('Respons penyimpanan tidak lengkap. Periksa daftar sebelum mencoba kembali.');
      if(alive.current){setPrepared(null);setForm({});setNotice(`Hubungan #${response.id} tersimpan. Belum digunakan oleh deteksi gangguan.`);setOpened(true);setPage(1);setState('verified');setReload(v=>v+1);}
    }catch(err){if(alive.current)setError(err.message);}
    finally{writeLock.current=false;if(alive.current)setWriting(false);}
  };
  const loadHistory=async id=>{
    const token=++historyJob.current;setHistoryBusy(true);setHistoryError('');setHistory(null);
    try{const response=await api(`/api/topology-connections/${id}/history`);if(!Array.isArray(response.data))throw Error('Riwayat tidak lengkap.');if(alive.current&&token===historyJob.current)setHistory({id,events:response.data});}
    catch(err){if(alive.current&&token===historyJob.current)setHistoryError(err.message);}
    finally{if(alive.current&&token===historyJob.current)setHistoryBusy(false);}
  };
  const cancelSaved=async event=>{
    event.preventDefault();if(writeLock.current||!revoke)return;
    writeLock.current=true;setWriting(true);setError('');setNotice('');
    try{const response=await api(`/api/topology-connections/${revoke.id}/revoke`,{expected_revision:revoke.revision,reason});if(response.status!=='success')throw Error('Periksa status hubungan sebelum mencoba kembali.');
      if(alive.current){setRevoke(null);setReason('');setHistory(null);setNotice('Hubungan dibatalkan. Riwayat tetap tersimpan.');setReload(v=>v+1);}}
    catch(err){if(alive.current)setError(err.message);}
    finally{writeLock.current=false;if(alive.current)setWriting(false);}
  };
  const mismatch=prepared&&candidate?.id!==prepared.candidate_id;
  const reviewMissing=prepared&&!accepted&&!candidate?.existing;
  return <section className="bg-white dark:bg-black border border-black/70 dark:border-white/70 rounded-lg p-4 space-y-4 text-black dark:text-white">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-sm">Hubungan Tervalidasi</h2><p className="mt-1 text-xs text-black/60 dark:text-white/60">Simpan hasil pemeriksaan lapangan sebagai fondasi topologi. Deteksi gangguan belum memakai hubungan ini.</p></div><button className={button} disabled={writing} onClick={()=>setOpened(v=>!v)}>{opened?'Tutup daftar':'Lihat Hubungan Tersimpan'}</button></div>
    {notice&&<p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">{notice}</p>}
    {error&&<p role="alert" className="text-xs text-red-700 dark:text-red-300">{error}</p>}
    {canWrite?<div className="space-y-2"><p className="text-xs">Calon terpilih: <b>{candidate?.title||'Pilih calon hubungan dari daftar.'}</b></p><button className={button} disabled={!candidate||(!accepted&&!candidate.existing)||preparing||writing||!!prepared} onClick={prepare}>{preparing?'Memeriksa data sumber...':'Validasi & Simpan Calon Terpilih'}</button>{candidate&&!accepted&&!candidate.existing&&<p className="text-xs text-black/60 dark:text-white/60">Pilih penilaian “Sesuai lapangan” terlebih dahulu.</p>}</div>:<p className="text-xs text-black/60 dark:text-white/60">Akses baca saja. Penyimpanan dan pembatalan tersedia untuk operator jaringan.</p>}
    {prepared&&<form onSubmit={save} className="border border-black/30 dark:border-white/30 rounded-md p-4 space-y-3">
      <h3 className="font-semibold text-sm">Konfirmasi hubungan: {prepared.title}</h3>
      {mismatch&&<p role="alert" className="text-xs text-amber-700 dark:text-amber-300">Calon yang dipilih telah berganti. Formulir ini masih untuk calon sebelumnya; batalkan formulir untuk memilih yang baru.</p>}
      {reviewMissing&&<p role="alert" className="text-xs text-amber-700 dark:text-amber-300">Penilaian calon belum “Sesuai lapangan”. Periksa kembali sebelum menyimpan.</p>}
      <p className="text-xs"><b>A:</b> {prepared.a.label}<br/><b>B:</b> {prepared.b.label}</p>
      <fieldset disabled={writing||mismatch||reviewMissing} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <label>Node sambung fisik<select aria-label="Node sambung fisik" required className={field} value={form.node_id} onChange={e=>chooseNode(e.target.value)}><option value="">Pilih node sambung</option>{prepared.junction_nodes.map(n=><option key={n.id} value={n.id}>{n.node_type} · {n.code?`${n.code} · `:''}{n.name}</option>)}</select></label>
        <label>Arah sinyal<select aria-label="Arah sinyal" required className={field} value={form.direction} onChange={e=>patch({direction:e.target.value,confirmed:false})}><option value="">Pilih arah dari sisi OLT</option><option value="a_to_b">A → B</option><option value="b_to_a">B → A</option></select></label>
        <label>Jenis sambungan<select aria-label="Jenis sambungan" required className={field} value={form.connection_type} onChange={e=>patch({connection_type:e.target.value,confirmed:false})}><option value="">Pilih jenis sambungan</option>{Object.entries(types).filter(([key])=>prepared.node_id||key!=='termination').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>OLT sumber<select aria-label="OLT sumber" required className={field} value={form.olt_id} onChange={e=>patch({olt_id:e.target.value,confirmed:false})}><option value="">Pilih OLT</option>{prepared.olts.map(olt=><option key={olt.id} value={olt.id}>{olt.name}</option>)}</select></label>
        <label>Port PON<input aria-label="Port PON" required maxLength={50} placeholder="Contoh: 1/3/1" className={field} value={form.pon} onChange={e=>patch({pon:e.target.value,confirmed:false})}/></label>
        {['a','b'].filter(side=>prepared[side].kind==='cable').map(side=><label key={side}>Core sisi {side.toUpperCase()} · {prepared[side].label}<input aria-label={`Core sisi ${side.toUpperCase()}`} type="number" min="1" max={prepared.cables.find(c=>c.id===prepared[side].cable_id)?.core_count_total||undefined} placeholder="Kosongkan bila belum diketahui" className={field} value={form['core_'+side]} onChange={e=>patch({['core_'+side]:e.target.value,confirmed:false})}/></label>)}
        <label className="md:col-span-2">Catatan pemeriksaan<textarea aria-label="Catatan validasi tersimpan" required minLength={5} maxLength={2000} rows={3} className={field} value={form.note} onChange={e=>patch({note:e.target.value,confirmed:false})}/></label>
        <label className="md:col-span-2 flex items-start gap-2"><input aria-label="Konfirmasi sambungan sesuai lapangan" type="checkbox" required checked={form.confirmed} onChange={e=>patch({confirmed:e.target.checked})}/><span>Saya memastikan sambungan, node, arah, dan OLT/PON di atas sesuai pemeriksaan lapangan.</span></label>
      </fieldset>
      {!prepared.junction_nodes.length&&<p className="text-xs text-amber-700 dark:text-amber-300">Belum ada node sambung dalam jarak 100 meter dari kedua titik. Tambahkan atau perbaiki node fisiknya melalui infrastruktur jaringan, lalu muat ulang pratinjau.</p>}
      <p className="text-[11px] text-black/60 dark:text-white/60">Core yang kosong ditandai belum lengkap. Sambungan ini tidak mengubah rute, panjang kabel, penggunaan core, atau parent node. Ekspor penilaian sesi tetap terpisah dari penyimpanan ini.</p>
      <div className="flex flex-wrap gap-2"><button className={button} type="submit" disabled={writing||mismatch||reviewMissing||!form.confirmed||!form.node_id}>{writing?'Menyimpan...':'Simpan Hubungan Tervalidasi'}</button><button className={button} type="button" disabled={writing} onClick={()=>{setPrepared(null);setForm({});setError('');}}>Batalkan formulir</button></div>
    </form>}
    {opened&&<div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs"><label>Status hubungan<select aria-label="Status hubungan tersimpan" className={field} disabled={writing} value={state} onChange={e=>{setState(e.target.value);setPage(1);}}><option value="verified">Tervalidasi</option><option value="revoked">Dibatalkan</option><option value="all">Semua status</option></select></label><button className={button} disabled={loading||writing} onClick={()=>setReload(v=>v+1)}>Segarkan Daftar Hubungan</button></div>
      {loading&&<p role="status" className="text-xs">Memuat hubungan tersimpan...</p>}{listError&&<p role="alert" className="text-xs text-red-700 dark:text-red-300">{listError} Daftar sebelumnya mungkin belum terbaru.</p>}
      <div className="overflow-auto border border-black/20 dark:border-white/20 rounded-md"><table aria-label="Daftar hubungan tervalidasi" className="w-full min-w-[780px] text-xs text-left"><thead className="bg-black/5 dark:bg-white/10"><tr>{['Hubungan & Arah','Node & OLT/PON','Status','Pemeriksa','Aksi'].map(t=><th key={t} className="p-3">{t}</th>)}</tr></thead><tbody className="divide-y divide-black/15 dark:divide-white/15">{listing?.data.map(row=><tr key={row.id}><td className="p-3 max-w-sm"><p className="font-semibold">#{row.id} · {arrow(row.definition)}</p><p className="mt-1">{types[row.definition.connection_type]} · {coreSummary(row.definition)}</p><p className="mt-1 text-black/60 dark:text-white/60 break-words">{row.definition.note}</p></td><td className="p-3">{row.definition.junction.name}<br/>{row.definition.olt_name}<br/>PON {row.definition.pon}</td><td className="p-3"><p>{row.state==='verified'?'Tervalidasi':'Dibatalkan'}</p>{!row.source_current&&<p className="mt-1 text-amber-700 dark:text-amber-300">Sumber berubah · perlu validasi ulang</p>}{!row.definition.core_details_complete&&<p className="mt-1 text-amber-700 dark:text-amber-300">Core belum lengkap</p>}<p className="mt-1 text-black/60 dark:text-white/60">Belum dipakai deteksi</p></td><td className="p-3">{row.created_by_name}<br/>{date(row.created_at)}</td><td className="p-3"><div className="flex flex-wrap gap-2"><button className={button} disabled={writing||historyBusy} onClick={()=>loadHistory(row.id)}>Riwayat #{row.id}</button>{canWrite&&row.state==='verified'&&<button className={button} disabled={writing} onClick={()=>{setRevoke(row);setReason('');setError('');}}>Batalkan #{row.id}</button>}</div></td></tr>)}{listing&&!listing.data.length&&<tr><td colSpan={5} className="p-6 text-center">Belum ada hubungan pada filter ini.</td></tr>}</tbody></table></div>
      {listing&&<div className="flex flex-wrap justify-between items-center gap-2 text-xs"><span>Halaman {listing.current_page} dari {listing.last_page} · {listing.total} hubungan</span><div className="flex gap-2"><button className={button} disabled={writing||loading||page<=1} onClick={()=>setPage(p=>p-1)}>Hubungan sebelumnya</button><button className={button} disabled={writing||loading||page>=listing.last_page} onClick={()=>setPage(p=>p+1)}>Hubungan berikutnya</button></div></div>}
      {historyError&&<p role="alert" className="text-xs text-red-700 dark:text-red-300">{historyError}</p>}
      {history&&<div className="border border-black/30 dark:border-white/30 rounded-md p-3 space-y-3 text-xs"><div className="flex justify-between gap-2"><h3 className="font-semibold">Riwayat hubungan #{history.id}</h3><button className="underline" onClick={()=>setHistory(null)}>Tutup riwayat</button></div>{history.events.map(event=><div key={event.id}><p className="font-semibold">{event.action==='verified'?'Divalidasi':'Dibatalkan'} · {event.actor_name} · {date(event.created_at)}</p><p>{event.reason}</p><p className="text-black/60 dark:text-white/60">{arrow(event.definition)} · {coreSummary(event.definition)} · {event.definition.olt_name} / {event.definition.pon}</p></div>)}</div>}
    </div>}
    {revoke&&<form onSubmit={cancelSaved} className="border border-amber-500 rounded-md p-3 space-y-3 text-xs"><h3 className="font-semibold">Batalkan hubungan #{revoke.id}</h3><p>{revoke.definition.title}</p><p>Hubungan dikeluarkan dari topologi tervalidasi; data kabel/node tetap ada. Riwayat dipertahankan.</p><label>Alasan pembatalan<textarea aria-label="Alasan pembatalan hubungan" required minLength={5} maxLength={2000} rows={2} className={field} disabled={writing} value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="flex gap-2"><button type="submit" className={button} disabled={writing||reason.trim().length<5}>{writing?'Memproses...':'Konfirmasi Pembatalan'}</button><button type="button" className={button} disabled={writing} onClick={()=>setRevoke(null)}>Tutup tanpa membatalkan</button></div></form>}
  </section>;
}
