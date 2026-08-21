import { supabase } from './supabaseClient.js';

const SETTINGS_ROW_ID = 'main';
const PHOTOS_BUCKET = 'photos';

// ---------- 매핑 헬퍼: DB(snake_case) <-> 앱(camelCase) ----------

function eventFromRow(r) {
  return {
    id: r.id,
    title: r.title,
    date: r.start_date,
    endDate: r.end_date,
    time: r.start_time,
    person: r.person,
    category: r.category,
    reminder: r.reminder,
    memo: r.memo,
    createdAt: r.created_at,
  };
}
function eventToRow(s) {
  return {
    id: s.id,
    title: s.title,
    start_date: s.date,
    end_date: s.endDate,
    start_time: s.time,
    person: s.person,
    category: s.category,
    reminder: s.reminder,
    memo: s.memo,
    created_at: s.createdAt,
  };
}

function ddayFromRow(r) {
  return { id: r.id, title: r.title, date: r.date, createdAt: r.created_at };
}
function ddayToRow(d) {
  return { id: d.id, title: d.title, date: d.date, created_at: d.createdAt };
}

function photoFromRow(r) {
  // App.jsx는 photo.dataUrl 을 <img src>로 그대로 사용하므로,
  // 실제로는 base64가 아니라 Storage 공개 URL을 dataUrl 필드에 담아준다.
  return { id: r.id, dataUrl: r.url, caption: r.caption, createdAt: r.created_at };
}

function settingsFromRow(r) {
  return { person1Name: r.person1_name || '나', person2Name: r.person2_name || '남편' };
}

// ---------- 전체 로드 ----------

export async function loadAll() {
  const [eventsRes, ddaysRes, albumsRes, settingsRes] = await Promise.allSettled([
    supabase.from('events').select('*').order('created_at', { ascending: true }),
    supabase.from('ddays').select('*').order('created_at', { ascending: true }),
    supabase.from('albums').select('*').order('created_at', { ascending: false }),
    supabase.from('settings').select('*').eq('id', SETTINGS_ROW_ID).maybeSingle(),
  ]);

  const schedules =
    eventsRes.status === 'fulfilled' && !eventsRes.value.error && eventsRes.value.data
      ? eventsRes.value.data.map(eventFromRow)
      : [];
  const ddays =
    ddaysRes.status === 'fulfilled' && !ddaysRes.value.error && ddaysRes.value.data
      ? ddaysRes.value.data.map(ddayFromRow)
      : [];
  const photos =
    albumsRes.status === 'fulfilled' && !albumsRes.value.error && albumsRes.value.data
      ? albumsRes.value.data.map(photoFromRow)
      : [];
  const settings =
    settingsRes.status === 'fulfilled' && !settingsRes.value.error && settingsRes.value.data
      ? settingsFromRow(settingsRes.value.data)
      : { person1Name: '나', person2Name: '남편' };

  [eventsRes, ddaysRes, albumsRes, settingsRes].forEach((r) => {
    if (r.status === 'fulfilled' && r.value.error) console.error('supabase load error', r.value.error);
    if (r.status === 'rejected') console.error('supabase load rejected', r.reason);
  });

  return { schedules, ddays, photos, settings };
}

// ---------- 일정 (events) ----------

export async function upsertSchedule(schedule) {
  const { error } = await supabase.from('events').upsert(eventToRow(schedule));
  if (error) console.error('upsertSchedule failed', error);
  return !error;
}
export async function deleteScheduleRow(id) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) console.error('deleteSchedule failed', error);
  return !error;
}

// ---------- 디데이 (ddays) ----------

export async function upsertDday(dday) {
  const { error } = await supabase.from('ddays').upsert(ddayToRow(dday));
  if (error) console.error('upsertDday failed', error);
  return !error;
}
export async function deleteDdayRow(id) {
  const { error } = await supabase.from('ddays').delete().eq('id', id);
  if (error) console.error('deleteDday failed', error);
  return !error;
}

// ---------- 사진 (albums + storage) ----------

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(',');
  const mimeMatch = meta.match(/data:(.*);base64/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// photo: { id, dataUrl(base64 preview), caption, createdAt } 를 받아
// Storage에 업로드하고, 실제 공개 URL이 채워진 photo 객체를 돌려준다.
export async function addPhotoWithUpload(photo) {
  try {
    const blob = dataUrlToBlob(photo.dataUrl);
    const path = `${photo.id}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
    const publicUrl = publicUrlData.publicUrl;

    const { error: insertError } = await supabase.from('albums').insert({
      id: photo.id,
      url: publicUrl,
      caption: photo.caption || null,
      created_at: photo.createdAt,
    });
    if (insertError) throw insertError;

    return { ...photo, dataUrl: publicUrl };
  } catch (e) {
    console.error('addPhotoWithUpload failed', e);
    return null;
  }
}

export async function deletePhotoRow(id) {
  const path = `${id}.jpg`;
  const { error: storageError } = await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
  if (storageError) console.error('delete storage object failed', storageError);
  const { error } = await supabase.from('albums').delete().eq('id', id);
  if (error) console.error('deletePhoto failed', error);
  return !error;
}

// ---------- 설정 (settings) ----------

export async function upsertSettings(settings) {
  const { error } = await supabase.from('settings').upsert({
    id: SETTINGS_ROW_ID,
    person1_name: settings.person1Name,
    person2_name: settings.person2Name,
  });
  if (error) console.error('upsertSettings failed', error);
  return !error;
}

