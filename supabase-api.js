/* NODAF Städportalen – endast den publika Supabase-nyckeln finns i webbläsaren. */
(() => {
  'use strict';
  const base = 'https://dismkfrewrzsagctwvvi.supabase.co';
  const key = 'sb_publishable_lxaJImpvqhrNM_7mhBv0FA_Aq-U3ENG';
  const sessionKey = 'nodaf-supervisor-session';
  let session = null;
  try { session = JSON.parse(localStorage.getItem(sessionKey) || 'null'); } catch { /* invalid session */ }

  async function request(endpoint, { method = 'GET', body, token, prefer } = {}) {
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (prefer) headers.Prefer = prefer;
    const response = await fetch(base + endpoint, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    if (!response.ok) throw new Error(data?.message || data?.msg || data?.error_description || data?.error || `Serverfel (${response.status})`);
    return data;
  }

  async function token() {
    if (!session?.access_token) return null;
    if (Date.now() < session.expires_at * 1000 - 60000) return session.access_token;
    try {
      const next = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
      session = { ...next, expires_at: Math.floor(Date.now() / 1000) + next.expires_in };
      localStorage.setItem(sessionKey, JSON.stringify(session));
      return session.access_token;
    } catch {
      session = null;
      localStorage.removeItem(sessionKey);
      return null;
    }
  }

  const mapRecord = r => ({ id: r.id, objectId: r.object_id, employee: r.employee, at: r.at, kind: r.kind, slot: r.slot, comment: r.comment || '', void: r.void });
  const query = (table, params, accessToken) => request(`/rest/v1/${table}?${params}`, { token: accessToken });
  async function bootstrap(admin) {
    const accessToken = admin ? await token() : null;
    const [objects, staff, config, messages] = await Promise.all([
      query('cleaning_objects', 'select=id,name,days,location,active&order=name.asc', accessToken),
      query('cleaning_staff', 'select=name&order=name.asc', accessToken),
      query('cleaning_config', 'select=anchor&id=eq.true', accessToken),
      query('cleaning_messages', 'select=id,title,body,expires_on,created_at&order=created_at.desc', accessToken)
    ]);
    const records = admin ? (await query('cleaning_records', 'select=id,object_id,employee,at,kind,slot,comment,void&order=at.desc', accessToken)).map(mapRecord) : [];
    return { objects, staff: staff.map(x => x.name), messages, records, audit: [], anchor: config[0]?.anchor || '2026-11-23' };
  }

  async function supervisor() {
    const accessToken = await token();
    if (!accessToken) return false;
    try { return Boolean((await query('cleaning_supervisors', 'select=user_id&limit=1', accessToken)).length); }
    catch { return false; }
  }

  async function adminWrite(table, method, data, filter) {
    const accessToken = await token();
    if (!accessToken || !(await supervisor())) throw new Error('Arbetsledarinloggning krävs.');
    const tail = filter ? `?${filter}` : '';
    return request(`/rest/v1/${table}${tail}`, { method, token: accessToken, body: data, prefer: 'return=representation' });
  }

  window.stadApi = async (path, data) => {
    if (path === '/api/bootstrap') return bootstrap(false);
    if (path === '/api/admin/state') {
      if (!(await supervisor())) throw new Error('Du saknar arbetsledarbehörighet.');
      return bootstrap(true);
    }
    if (path === '/api/me') return { supervisor: await supervisor() };
    if (path === '/api/login') {
      const auth = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: data.email, password: data.password } });
      session = { ...auth, expires_at: Math.floor(Date.now() / 1000) + auth.expires_in };
      localStorage.setItem(sessionKey, JSON.stringify(session));
      if (!(await supervisor())) {
        await window.stadApi('/api/logout', {});
        throw new Error('Kontot saknar arbetsledarbehörighet.');
      }
      return { supervisor: true };
    }
    if (path === '/api/logout') {
      const accessToken = await token();
      if (accessToken) await request('/auth/v1/logout', { method: 'POST', token: accessToken }).catch(() => {});
      session = null; localStorage.removeItem(sessionKey); return {};
    }
    if (path === '/api/report') {
      return request('/rest/v1/rpc/cleaning_report_run', { method: 'POST', body: { p_object_id: data.objectId, p_employee: data.employee, p_extra: Boolean(data.extra), p_comment: data.comment || '' } });
    }
    if (path === '/api/admin/object') {
      const object = { name: data.name, days: data.days, location: data.location };
      if (data.id) return adminWrite('cleaning_objects', 'PATCH', object, `id=eq.${encodeURIComponent(data.id)}`);
      object.id = crypto.randomUUID();
      return adminWrite('cleaning_objects', 'POST', object);
    }
    if (path === '/api/admin/staff') {
      if (data.remove) return adminWrite('cleaning_staff', 'DELETE', undefined, `name=eq.${encodeURIComponent(data.name)}`);
      return adminWrite('cleaning_staff', 'POST', { name: data.name });
    }
    if (path === '/api/admin/archive-object') {
      return adminWrite('cleaning_objects', 'PATCH', { active: false }, `id=eq.${encodeURIComponent(data.id)}`);
    }
    if (path === '/api/admin/message') {
      const row = { title: data.title, body: data.body, expires_on: data.expiresOn };
      if (data.id) return adminWrite('cleaning_messages', 'PATCH', row, `id=eq.${encodeURIComponent(data.id)}`);
      const accessToken = await token();
      const user = await request('/auth/v1/user', { token: accessToken });
      return adminWrite('cleaning_messages', 'POST', { ...row, created_by: user.id });
    }
    if (path === '/api/admin/delete-message') {
      return adminWrite('cleaning_messages', 'DELETE', undefined, `id=eq.${encodeURIComponent(data.id)}`);
    }
    if (path === '/api/admin/record') {
      const row = { object_id: data.objectId, employee: data.employee, at: data.at, kind: data.extra ? 'extra' : 'ordinary', slot: null, comment: data.comment || '', void: Boolean(data.void) };
      if (data.id) return adminWrite('cleaning_records', 'PATCH', row, `id=eq.${encodeURIComponent(data.id)}`);
      return adminWrite('cleaning_records', 'POST', row);
    }
    throw new Error('Okänd åtgärd: ' + path);
  };
})();
