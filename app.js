(() => {
  'use strict';
  const KEY='stadportalen-demo-objects-v2';
  const DAYS=['Mån','Tis','Ons','Tor','Fre','Lör','Sön'];
  const longDate=new Intl.DateTimeFormat('sv-SE',{day:'numeric',month:'long',year:'numeric'});
  const shortDate=new Intl.DateTimeFormat('sv-SE',{day:'numeric',month:'short'});
  const dateTime=new Intl.DateTimeFormat('sv-SE',{dateStyle:'short',timeStyle:'short'});
  const $=id=>document.getElementById(id);
  const today=()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate());};
  const add=(d,n)=>{const a=new Date(d);a.setDate(a.getDate()+n);return a;};
  const ymd=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const parse=s=>{const [y,m,d]=s.slice(0,10).split('-').map(Number);return new Date(y,m-1,d);};
  const dow=d=>(d.getDay()+6)%7;
  const startWeek=d=>add(d,-dow(d));
  const fmt=s=>shortDate.format(parse(s));
  const datetime=s=>dateTime.format(new Date(s));
  const uid=()=>globalThis.crypto?.randomUUID?.()??String(Date.now()+Math.random());
  const swedishNames=new Intl.Collator('sv-SE',{sensitivity:'base',numeric:true});
  const sortedObjects=()=>[...state.objects].filter(o=>o.active!==false).sort((a,b)=>swedishNames.compare(a.name,b.name));
  const filteredObjects=()=>sortedObjects().filter(o=>!$('location-filter').value||o.location===$('location-filter').value);
  const sortedStaff=()=>[...state.staff].sort(swedishNames.compare);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const seed=()=>{const t=today();return {
    objects:['Tallbacken','Älvdalsskolan Högstadiet','Sporthallen','Nodava','Tingshuset','Brandstationen','Tingshuset Toa','Turistbytån','Höghol','Gläntan','Ambulansen','Älvdalsskolan Mellanstadiet','Furuvägen','Porfytgårdsvägen','Älvdalsskolan Skurmaskin','Kommunhuset','Brotvägen','Gula Villan','Rot Skola','Fritte Rot','Tallkotten','Tallbacken Rum'].map((name,i)=>({id:'obj'+(i+1),name,days:[]})),
    staff:['Anna Andersson','Erik Eriksson','Maria Karlsson','Johan Nilsson'],
    records:[],audit:[],anchor:ymd(startWeek(t))};};
  let state={objects:[],staff:[],records:[],audit:[],anchor:ymd(startWeek(today()))};
  let isSupervisor=false;
  function updateLockedCards(){
    document.querySelectorAll('#home .portal-card[data-view="dashboard"],#home .portal-card[data-view="settings"]').forEach(card=>{
      card.disabled=!isSupervisor;
      card.classList.toggle('is-locked',!isSupervisor);
      card.setAttribute('aria-label',card.querySelector('strong').textContent+(isSupervisor?'':' (låst – arbetsledarinloggning krävs)'));
      let lock=card.querySelector('.card-lock');
      if(!lock){lock=document.createElement('span');lock.className='card-lock';lock.setAttribute('aria-hidden','true');lock.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';card.append(lock);}
      lock.hidden=isSupervisor;
    });
  }
  const api=(path,data)=>window.stadApi(path,data);
  const saveAdmin=async(path,data)=>{try{await api(path,data);await loadShared(true);notify('Ändringen sparades.');return true;}catch(e){notify(e.message);return false;}};
  async function loadShared(includeAdmin=false){const next=await api(includeAdmin?'/api/admin/state':'/api/bootstrap');state={...next,audit:next.audit||[]};if(!obj(selectedObject))selectedObject=state.objects[0]?.id||'';refresh();}
  function persist(){}
  const obj=id=>state.objects.find(x=>x.id===id);
  const slotsFor=(o,until=today())=>{const slots=[];for(let d=parse(state.anchor);d<=until;d=add(d,1))if(o.days.includes(dow(d)))slots.push(ymd(d));return slots;};
  function compute(){const result={};state.objects.forEach(o=>{const slots=slotsFor(o);const matched=new Set();const sorted=state.records.filter(r=>r.objectId===o.id&&r.kind!=='extra'&&!r.void).sort((a,b)=>a.at.localeCompare(b.at));sorted.forEach(r=>{const day=ymd(new Date(r.at));const slot=slots.find(s=>s<=day&&!matched.has(s));r.slot=slot||null;r.kind=slot?(slot===day?'ordinary':'late'):'extra';if(slot)matched.add(slot);});result[o.id]={slots,matched,missing:slots.filter(s=>!matched.has(s))};});return result;}
  let computed=compute();
  function classify(objectId,day=ymd(today())){const o=obj(objectId);if(!o)return {kind:'extra',slot:null};const st=computed[objectId];const slot=st?.missing.find(s=>s<=day);return slot?{kind:slot===day?'ordinary':'late',slot}:{kind:'extra',slot:null};}
  function badge(kind){return kind==='ordinary'?'<span class="badge">Ordinarie</span>':kind==='late'?'<span class="badge warn">Försenad</span>':kind==='extra'?'<span class="badge info">Extra</span>':'<span class="badge neutral">Makulerad</span>';}
  function notify(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.classList.remove('show'),3600);}
  function options(){let selected=$('object').value;let employee=$('employee').value;$('object').innerHTML='<option value="">Välj objekt</option>'+sortedObjects().map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');if(obj(selected))$('object').value=selected;$('employee').innerHTML='<option value="">Välj ditt namn</option>'+sortedStaff().map(s=>`<option>${esc(s)}</option>`).join('');if(state.staff.includes(employee))$('employee').value=employee;$('history-object').innerHTML='<option value="">Alla objekt</option>'+sortedObjects().map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');}
  function reportView(){const id=$('object').value;const o=obj(id);if(!o)return;
    $('schedule-object').textContent=o.name;$('schedule-days').innerHTML=DAYS.map((d,i)=>`<div class="day ${o.days.includes(i)?'selected':''}">${d}</div>`).join('');let next=null;for(let i=0;i<15;i++){const d=add(today(),i);if(o.days.includes(dow(d))){next=d;break;}}$('next-slot').textContent=next?`${DAYS[dow(next)]} ${shortDate.format(next)}`:'Inga schemadagar';
    $('recent-list').innerHTML=state.records.filter(r=>!r.void).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,3).map(r=>`<div class="recent-item"><div><strong>${esc(obj(r.objectId)?.name||'Borttaget objekt')}</strong><small>${esc(r.employee)} · ${r.kind==='extra'?'Extra':r.kind==='late'?'Försenad':'Ordinarie'}</small></div><time>${datetime(r.at)}</time></div>`).join('')||'<p class="empty">Inga körningar ännu.</p>';
  }
  let overviewMonth=new Date(today().getFullYear(),today().getMonth(),1),detailMonth=new Date(overviewMonth),selectedObject='obj1';
  const activeRecords=()=>state.records.filter(r=>!r.void);
  const weekSlots=(o)=>{const start=startWeek(today()),end=add(start,6);return Array.from({length:7},(_,i)=>add(start,i)).filter(d=>o.days.includes(dow(d))&&d>=parse(state.anchor)&&d<=end).map(ymd);};
  const weekly=objectId=>{const objects=objectId?[obj(objectId)].filter(Boolean):filteredObjects();const slots=objects.flatMap(o=>weekSlots(o).map(date=>({objectId:o.id,date})));const matched=slots.filter(s=>computed[s.objectId]?.matched.has(s.date)).length;return {done:matched,total:slots.length,pending:slots.length-matched};};
  const countMonth=(o,month)=>{let planned=0,done=0;for(let d=new Date(month.getFullYear(),month.getMonth(),1);d.getMonth()===month.getMonth();d=add(d,1)){const s=ymd(d);if(d>=parse(state.anchor)&&o.days.includes(dow(d))){planned++;if(computed[o.id]?.matched.has(s))done++;}}return {planned,done};};
  function monthCalendar(month,objectId){const first=new Date(month.getFullYear(),month.getMonth(),1);const offset=dow(first),days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();const headings=DAYS.map(d=>`<div class="calendar-weekday">${d}</div>`).join('');let cells='';const selected=objectId?[obj(objectId)].filter(Boolean):filteredObjects();
    for(let i=0;i<Math.ceil((offset+days)/7)*7;i++){const n=i-offset+1;if(n<1||n>days){cells+='<div class="calendar-day outside"></div>';continue;}const d=new Date(month.getFullYear(),month.getMonth(),n),key=ymd(d),scheduled=selected.filter(o=>d>=parse(state.anchor)&&o.days.includes(dow(d))),complete=scheduled.filter(o=>computed[o.id]?.matched.has(key));const due=scheduled.length-complete.length;const performed=activeRecords().filter(r=>selected.some(o=>o.id===r.objectId)&&ymd(new Date(r.at))===key);const extra=performed.filter(r=>r.kind==='extra').length;const late=performed.filter(r=>r.kind==='late').length;let marks='';const marker=(color,count,label)=>count?'<span class="mark '+color+'" title="'+count+' '+label+'" aria-label="'+count+' '+label+'"><span class="mark-dot"></span>'+(count>1?'<span class="mark-count">x '+count+'</span>':'')+'</span>':'';marks+=marker('green',complete.length,'utförda körningar');marks+=marker('amber',due,'planerade eller missade körningar');marks+=marker('blue',extra,'extra körningar');cells+=`<div class="calendar-day ${key===ymd(today())?'today':''}" title="${esc(key)}"><span class="calendar-date">${n}</span><div class="calendar-marks">${marks}</div></div>`;}
    return headings+cells;
  }
  function renderCalendars(){$('month-label').textContent=new Intl.DateTimeFormat('sv-SE',{month:'long',year:'numeric'}).format(overviewMonth);$('overview-calendar').innerHTML=monthCalendar(overviewMonth);$('detail-month-label').textContent=new Intl.DateTimeFormat('sv-SE',{month:'long',year:'numeric'}).format(detailMonth);$('detail-calendar').innerHTML=monthCalendar(detailMonth,selectedObject);}
  function detail(){const o=obj(selectedObject);if(!o)return;const w=weekly(o.id),m=countMonth(o,detailMonth),records=activeRecords().filter(r=>r.objectId===o.id).sort((a,b)=>b.at.localeCompare(a.at));$('detail-name').textContent=o.name;$('detail-subtitle').textContent='Schemalagt: '+(o.days.map(i=>DAYS[i]).join(', ')||'Inga dagar');$('detail-stats').innerHTML=[['Denna vecka',`${w.done} / ${w.total}`,'Schematillfällen'],['Denna månad',`${m.done} / ${m.planned}`,'Utförda schematillfällen'],['Extra körningar',records.filter(r=>r.kind==='extra').length,'Under demo-perioden']].map(([l,n,s])=>`<div class="panel stat"><div class="stat-label">${l}</div><div class="stat-number">${n}</div><small>${s}</small></div>`).join('');$('detail-history').innerHTML=records.slice(0,12).map(r=>`<div class="detail-history-row"><div><strong>${datetime(r.at)}</strong> · ${esc(r.employee)}</div><div>${badge(r.kind)}</div></div>`).join('')||'<p class="empty">Inga körningar registrerade.</p>';renderCalendars();}
  function dashboard(){const allowed=new Set(filteredObjects().map(o=>o.id));const active=activeRecords().filter(r=>allowed.has(r.objectId));const week=startWeek(today()),nextWeek=add(week,7);const extrasThisWeek=active.filter(r=>r.kind==='extra'&&new Date(r.at)>=week&&new Date(r.at)<nextWeek).length;const w=weekly();
    $('stats').innerHTML=[['Utförda / schemalagda',`${w.done} / ${w.total}`,'Denna vecka · ordinarie körningar','good'],['Extra körningar',extrasThisWeek,'Denna vecka · utöver schemat','']].map(([label,n,desc,cls],i)=>`<div class="panel stat"><div class="stat-label">${label}</div><div class="stat-number ${cls}">${n}</div><small>${desc}</small>${i===0?`<div class="progress stat-progress" role="progressbar" aria-label="Andel utförda schemalagda körningar" aria-valuenow="${w.done}" aria-valuemin="0" aria-valuemax="${w.total}"><span style="width:${w.total?100*w.done/w.total:0}%"></span></div>`:''}</div>`).join('');$('object-count').textContent=filteredObjects().length+' objekt';$('weekly-fraction').textContent=`${w.done} av ${w.total}`;$('weekly-label').textContent=`Vecka ${weekNumber(today())} · måndag–söndag`;$('weekly-progress').style.width=(w.total?100*w.done/w.total:0)+'%';$('weekly-detail').textContent=`${w.pending} planerade körningar återstår denna vecka. Extra körningar räknas inte mot veckomålet.`;
    $('object-rows').innerHTML=sortedObjects().map(o=>{const r=active.filter(x=>x.objectId===o.id).sort((a,b)=>b.at.localeCompare(a.at))[0];const c=computed[o.id];const past=c.missing.filter(s=>s<ymd(today())).length;const due=c.missing.includes(ymd(today()));const status=past?'<span class="badge danger">Försenad</span>':due?'<span class="badge warn">Ska köras idag</span>':'<span class="badge">I tid</span>';return `<tr><td><button class="object-link" data-detail="${esc(o.id)}">${esc(o.name)}</button></td><td>${o.days.map(i=>DAYS[i]).join(', ')||'Inga dagar'}</td><td>${r?datetime(r.at):'Ingen registrering'}</td><td>${c.missing.length}</td><td>${status}</td><td><button class="row-action" data-detail="${esc(o.id)}">Visa kalender</button></td></tr>`;}).join('');detail();renderCalendars();
  }
  function weekNumber(d){const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));x.setUTCDate(x.getUTCDate()+4-(x.getUTCDay()||7));const yearStart=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil((((x-yearStart)/86400000)+1)/7);}
  function history(){const oid=$('history-object').value,type=$('history-type').value;const arr=state.records.filter(r=>(!oid||r.objectId===oid)&&(!type||r.kind===type)).sort((a,b)=>b.at.localeCompare(a.at));$('history-rows').innerHTML=arr.map(r=>`<tr><td>${datetime(r.at)}${r.void?' <small>(makulerad)</small>':''}</td><td><strong>${esc(obj(r.objectId)?.name||'Borttaget objekt')}</strong></td><td>${esc(r.employee)}</td><td>${r.void?badge('void'):badge(r.kind)}${r.slot&&r.kind==='late'?`<br><small>Gäller ${fmt(r.slot)}</small>`:''}</td><td title="${esc(r.comment)}">${esc((r.comment||'–').slice(0,36))}</td><td><button class="row-action" data-edit="${esc(r.id)}">Ändra</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Inga körningar matchar filtret.</td></tr>';
  }
  function settings(){$('settings-objects').innerHTML=sortedObjects().map(o=>`<div class="setting-row"><div><strong>${esc(o.name)}</strong><small>${esc(o.location||'Ort ej angiven')} · ${o.days.map(i=>DAYS[i]).join(', ')||'Inga schemalagda dagar'}</small></div><div class="setting-actions"><button class="secondary" data-object="${esc(o.id)}">Redigera</button><button class="danger-button" data-archive-object="${esc(o.id)}">Ta bort</button></div></div>`).join('');$('staff-list').innerHTML=sortedStaff().map(s=>`<div class="setting-row"><strong>${esc(s)}</strong><button class="row-action" data-remove-staff="${esc(s)}">Ta bort</button></div>`).join('');}
  const messageReadKey='nodaf-read-messages-v1';
  function readMessageIds(){try{return new Set(JSON.parse(localStorage.getItem(messageReadKey)||'[]'));}catch{return new Set();}}
  function renderMessages(markRead=false){
    const live=(state.messages||[]).filter(m=>m.expires_on>=ymd(today()));
    const seen=readMessageIds();
    if(markRead){live.forEach(m=>seen.add(m.id));try{localStorage.setItem(messageReadKey,JSON.stringify([...seen]));}catch{}}
    const unread=live.filter(m=>!seen.has(m.id)).length;
    const badge=document.querySelector('#home [data-view="messages"] .message-count');
    if(badge){badge.hidden=!unread;badge.textContent=unread>99?'99+':String(unread);}
    $('new-message').hidden=!isSupervisor;
    $('message-list').innerHTML=live.length?live.map(m=>`<article class="panel message-card"><div class="message-card-head"><h2>${esc(m.title)}</h2><span class="message-until">Visas till ${esc(m.expires_on)}</span></div><p>${esc(m.body)}</p>${isSupervisor?`<div class="message-admin"><button class="secondary" data-edit-message="${esc(m.id)}">Redigera</button><button class="danger-button" data-remove-message="${esc(m.id)}">Ta bort</button></div>`:''}</article>`).join(''):'<div class="panel messages-empty"><h2>Inga meddelanden just nu</h2></div>';
  }
  function messageModal(id){
    const m=(state.messages||[]).find(item=>item.id===id);
    const expires=ymd(add(today(),7));
    openModal(m?'Redigera meddelande':'Nytt meddelande',`<label for="m-msg-title">Rubrik</label><input id="m-msg-title" maxlength="120" required value="${esc(m?.title||'')}"><label for="m-msg-body">Meddelande</label><textarea id="m-msg-body" rows="5" maxlength="3000" required>${esc(m?.body||'')}</textarea><label for="m-msg-expire">Visas till och med</label><input id="m-msg-expire" type="date" required min="${ymd(today())}" value="${esc(m?.expires_on||expires)}">`,async()=>{
      const title=$('m-msg-title').value.trim(),body=$('m-msg-body').value.trim(),expiresOn=$('m-msg-expire').value;
      if(!title||!body||expiresOn<ymd(today()))return false;
      return saveAdmin('/api/admin/message',{id:m?.id,title,body,expiresOn});
    });
  }
  $('new-message').onclick=()=>messageModal();
  $('message-list').onclick=async e=>{
    const edit=e.target.closest('[data-edit-message]'),remove=e.target.closest('[data-remove-message]');
    if(edit)messageModal(edit.dataset.editMessage);
    if(remove&&confirm('Ta bort meddelandet?'))await saveAdmin('/api/admin/delete-message',{id:remove.dataset.removeMessage});
  };
  $('location-filter').onchange=dashboard;
  const refresh=()=>{computed=compute();persist();options();reportView();dashboard();history();settings();renderMessages();};
  function show(view){if(['dashboard','object-detail','history','settings'].includes(view)&&!isSupervisor){notify('Logga in som arbetsledare för att öppna denna sida.');view='profile';}document.body.classList.toggle('home-mode',view==='home');document.querySelectorAll('.page').forEach(e=>e.classList.toggle('active',e.id===view));document.querySelectorAll('[data-view]').forEach(e=>e.classList.toggle('active',e.dataset.view===view));document.title=({'home':'Städportalen','messages':'Viktiga meddelanden','profile':'Mina sidor','report':'Rapportera körning','dashboard':'Uppföljning','object-detail':'Objekt','history':'Körningshistorik','settings':'Inställningar'})[view]+' – NODAF';window.scrollTo({top:0,behavior:'smooth'});if(view==='messages')renderMessages(true);}
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
  $('object-rows').addEventListener('click',e=>{const b=e.target.closest('[data-detail]');if(!b)return;selectedObject=b.dataset.detail;detailMonth=new Date(overviewMonth);detail();show('object-detail');});
  $('month-prev').onclick=()=>{overviewMonth=new Date(overviewMonth.getFullYear(),overviewMonth.getMonth()-1,1);renderCalendars();};
  $('month-next').onclick=()=>{overviewMonth=new Date(overviewMonth.getFullYear(),overviewMonth.getMonth()+1,1);renderCalendars();};
  $('detail-prev').onclick=()=>{detailMonth=new Date(detailMonth.getFullYear(),detailMonth.getMonth()-1,1);detail();};
  $('detail-next').onclick=()=>{detailMonth=new Date(detailMonth.getFullYear(),detailMonth.getMonth()+1,1);detail();};
  $('go-settings').onclick=()=>show('settings');$('object').onchange=()=>{$('extra').checked=false;reportView();};$('extra').onchange=reportView;
  $('report-form').onsubmit=async e=>{e.preventDefault();const o=obj($('object').value),name=$('employee').value;if(!o||!name)return notify('Välj namn och objekt.');const button=e.submitter;if(button)button.disabled=true;try{await api('/api/report',{objectId:o.id,employee:name,extra:$('extra').checked,comment:$('comment').value.trim()});$('comment').value='';$('extra').checked=false;await loadShared(isSupervisor);notify('✓ Körningen sparades för alla enheter.');}catch(err){notify('Kunde inte spara: '+err.message);}finally{if(button)button.disabled=false;}};
  $('history-object').onchange=history;$('history-type').onchange=history;
  $('export').onclick=()=>{const rows=[['Utförd','Objekt','Utförd av','Typ','Schematillfälle','Kommentar','Makulerad'],...state.records.map(r=>[datetime(r.at),obj(r.objectId)?.name||'',r.employee,r.kind,r.slot||'',r.comment||'',r.void?'Ja':'Nej'])];const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.download='skurportal-historik.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
  const modal=$('modal');let submitModal=null;const close=()=>modal.close();$('modal-close').onclick=close;$('modal-cancel').onclick=close;
  function openModal(heading,fields,onSave){$('modal-title').textContent=heading;$('modal-fields').innerHTML=fields;submitModal=onSave;modal.showModal();}
  $('modal-form').onsubmit=async e=>{e.preventDefault();$('modal-save').disabled=true;try{if(await submitModal?.())close();}finally{$('modal-save').disabled=false;}};
  function objectModal(id){const current=id?obj(id):null;openModal(current?'Redigera objekt':'Nytt objekt',`<label for="m-name">Objektnamn</label><input id="m-name" required maxlength="90" value="${esc(current?.name||'')}" placeholder="Exempel: Sporthallen"><label>Ort</label><div class="location-radios">${['Älvdalen','Särna','Idre'].map(place=>`<label><input type="radio" name="m-location" value="${place}" ${current?.location===place?'checked':''}> ${place}</label>`).join('')}</div><label>Schemalagda dagar</label><div class="day-checkboxes">${DAYS.map((day,i)=>`<label><input type="checkbox" data-day="${i}" ${current?.days.includes(i)?'checked':''}><span>${day}</span></label>`).join('')}</div>`,async()=>{const name=$('m-name').value.trim();if(!name)return false;const days=[...$('modal-fields').querySelectorAll('[data-day]:checked')].map(e=>Number(e.dataset.day));return saveAdmin('/api/admin/object',{id:current?.id,name,days,location:$('modal-fields').querySelector('[name="m-location"]:checked')?.value||null});});}
  $('add-object').onclick=()=>objectModal();$('settings-objects').onclick=async e=>{const b=e.target.closest('[data-object]');if(b){objectModal(b.dataset.object);return;}const remove=e.target.closest('[data-archive-object]');if(remove&&confirm('Ta bort objektet från aktiva listor? Tidigare körningar sparas i historiken.'))await saveAdmin('/api/admin/archive-object',{id:remove.dataset.archiveObject});};
  $('staff-form').onsubmit=async e=>{e.preventDefault();const name=$('staff-name').value.trim();if(!name)return;const done=await saveAdmin('/api/admin/staff',{name});if(done)$('staff-name').value='';};
  $('staff-list').onclick=async e=>{const b=e.target.closest('[data-remove-staff]');if(!b)return;const name=b.dataset.removeStaff;if(!confirm(`Ta bort ${name} från valbara namn? Historiken sparas.`))return;await saveAdmin('/api/admin/staff',{name,remove:true});};
  function dateInput(iso){const d=new Date(iso);const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,16);}
  const employeeSelect=s=>'<option value="">Välj medarbetare</option>'+sortedStaff().map(x=>`<option ${x===s?'selected':''}>${esc(x)}</option>`).join('');
  const objectSelect=id=>sortedObjects().map(o=>`<option value="${esc(o.id)}" ${o.id===id?'selected':''}>${esc(o.name)}</option>`).join('');
  function recordModal(id){const r=state.records.find(x=>x.id===id),isNew=!r;const datetimeValue=r?dateInput(r.at):dateInput(new Date().toISOString());openModal(isNew?'Efterregistrera körning':'Korrigera körning',`<label for="m-date">Datum och tid</label><input id="m-date" type="datetime-local" required value="${esc(datetimeValue)}"><label for="m-object">Objekt</label><select id="m-object">${objectSelect(r?.objectId)}</select><label for="m-employee">Utförd av</label><select id="m-employee" required>${employeeSelect(r?.employee)}</select><label class="checkline"><input id="m-extra" type="checkbox" ${r?.kind==='extra'?'checked':''}><span><strong>Extra körning</strong></span></label><label for="m-comment">Kommentar</label><textarea id="m-comment" rows="2">${esc(r?.comment||'')}</textarea>${r?`<label class="checkline"><input type="checkbox" id="m-void" ${r.void?'checked':''}><span><strong>Makulera rapport</strong></span></label>`:''}`,async()=>{const date=$('m-date').value,employee=$('m-employee').value;if(!date||!employee)return false;const at=new Date(date).toISOString();return saveAdmin('/api/admin/record',{id:r?.id,at,objectId:$('m-object').value,employee,extra:$('m-extra').checked,comment:$('m-comment').value.trim(),void:r?$('m-void').checked:false});});}
  $('add-retro').onclick=()=>recordModal(null);$('history-rows').onclick=e=>{const b=e.target.closest('[data-edit]');if(b)recordModal(b.dataset.edit);};
  $('reset').onclick=()=>notify('Gemensam testdata kan inte återställas från en enskild telefon.');
  let installPrompt=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
  window.addEventListener('appinstalled',()=>{installPrompt=null;});
  $('install-close').onclick=()=>$('install-dialog').close();
  $('install-app').onclick=async()=>{
    const installed=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
    if(installed){$('install-title').textContent='Appen är redan installerad';$('install-instructions').textContent='Du använder redan NODAF som app.';$('install-dialog').showModal();return;}
    if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();await prompt.userChoice;return;}
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
    $('install-title').textContent='Lägg till NODAF på hemskärmen';
    $('install-instructions').textContent=ios?'Öppna sidan i Safari. Tryck på Dela, välj Lägg till på hemskärmen och aktivera Öppna som webbapp. Tryck sedan på Lägg till.':'Öppna sidan i Chrome eller Edge, öppna webbläsarens meny och välj Installera app eller Lägg till på startskärmen.';
    $('install-dialog').showModal();
  };
  $('today').textContent='◷ '+longDate.format(today());
  async function updateProfile(){updateLockedCards();const profile=$('profile').querySelector('.profile-panel');profile.innerHTML=isSupervisor?'<div><h2>Arbetsledare</h2><p>Du är inloggad och kan hantera uppföljning, historik och inställningar.</p><button type="button" id="admin-logout" class="secondary">Logga ut</button></div>':'<div><h2>Arbetsledarinloggning</h2><p>Personalen rapporterar utan inloggning. Endast behöriga arbetsledare använder e-post och lösenord här.</p><form id="admin-login"><label for="admin-email">E-post</label><input id="admin-email" type="email" autocomplete="username" required><label for="admin-password">Lösenord</label><input id="admin-password" type="password" autocomplete="current-password" required><button type="submit" class="primary">Logga in</button></form></div>';if(isSupervisor){$('admin-logout').onclick=async()=>{await api('/api/logout',{});isSupervisor=false;await loadShared(false);updateProfile();show('home');};}else{$('admin-login').onsubmit=async e=>{e.preventDefault();const password=$('admin-password').value,email=$('admin-email').value.trim();try{await api('/api/login',{email,password});isSupervisor=true;await loadShared(true);updateProfile();show('dashboard');notify('Du är inloggad som arbetsledare.');}catch(err){notify(err.message);}};}}
  async function start(){updateLockedCards();try{const me=await api('/api/me');isSupervisor=Boolean(me.supervisor);await loadShared(isSupervisor);updateProfile();document.querySelector('.side-bottom p').textContent='Testversion med gemensam databas.';document.querySelector('.demo-indicator').textContent='TESTMILJÖ · DELAD DATA';document.querySelector('.access-note p').textContent='Endast inloggade arbetsledare kan ändra inställningarna. Ändringar sparas för alla telefoner.';}catch(e){notify('Kunde inte ansluta till servern: '+e.message);$('profile').querySelector('.profile-panel').textContent='Databasen är inte tillgänglig. Försök igen senare.';}show('home');}start();
})();
