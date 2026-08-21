import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Home, Calendar, List, Plus, X, Bell, Camera, ChevronLeft, ChevronRight, Trash2, Settings } from 'lucide-react';

const STORAGE_KEYS = { SCHEDULES: 'schedules', DDAYS: 'ddays', PHOTOS: 'photos', SETTINGS: 'settings' };
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_KO = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const DDAY_EMOJIS = ['📌', '❤️', '💍', '🎂', '✈️', '🎉', '🏠', '👶', '🐶', '⭐'];
const TAPE_COLORS = ['#2F80ED', '#56CCF2', '#6B8EDE'];
const ROTATIONS = [-3, 2, -1.5, 3, -2, 1.5, -2.5, 2.5];

const CUSTOM_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap');

.cs-app { font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif; background:#F7F9FC; color:#1F2937; }
.cs-app * { box-sizing: border-box; }
.cs-app button { cursor: pointer; font-family: inherit; }
.cs-app button:focus-visible, .cs-app input:focus-visible, .cs-app select:focus-visible, .cs-app textarea:focus-visible { outline: 2px solid #2F80ED; outline-offset: 2px; }
.cs-serif, .cs-hand { font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif; }
.cs-card { background:#FFFFFF; border-radius:14px; box-shadow:0 2px 10px rgba(31,41,55,0.06); border:1px solid #E8EEF5; text-align:left; }
.cs-p1 { background-color:#2F80ED; }
.cs-p1-text { color:#2F80ED; }
.cs-p1-soft { background-color:#EAF3FF; }
.cs-p2 { background-color:#56CCF2; }
.cs-p2-text { color:#1598C4; }
.cs-p2-soft { background-color:#EAF9FE; }
.cs-both { background-color:#5B6FE8; }
.cs-both-text { color:#4A5CC7; }
.cs-both-soft { background-color:#EEF0FF; }
.cs-input { width:100%; padding:11px 13px; border-radius:10px; border:1.5px solid #DCE5EF; background:#FFFFFF; font-size:14px; color:#1F2937; outline:none; font-family:inherit; }
.cs-input:focus { border-color:#2F80ED; }
.cs-label { font-size:12px; font-weight:700; color:#64748B; margin-bottom:6px; display:block; }
.cs-btn-primary { background:#2F80ED; color:#fff; border:none; border-radius:10px; padding:13px; font-size:15px; font-weight:700; width:100%; }
.cs-btn-primary:disabled { opacity:0.5; }
.cs-btn-secondary { background:#FFFFFF; color:#64748B; border:1.5px solid #DCE5EF; border-radius:10px; padding:13px; font-size:14px; font-weight:600; width:100%; }
.cs-scroll::-webkit-scrollbar { display:none; }
.cs-scroll { scrollbar-width:none; }
`;

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function formatDisplayDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}월 ${d}일 (${WEEKDAYS[dt.getDay()]})`;
}
function formatTodayHeader() {
  const now = new Date();
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAYS[now.getDay()]}요일`;
}
function calcDday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'D-DAY';
  return diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`;
}
function personColorClass(person, variant) {
  const map = {
    p1: { solid: 'cs-p1', text: 'cs-p1-text', soft: 'cs-p1-soft' },
    p2: { solid: 'cs-p2', text: 'cs-p2-text', soft: 'cs-p2-soft' },
    both: { solid: 'cs-both', text: 'cs-both-text', soft: 'cs-both-soft' },
  };
  return (map[person] || map.both)[variant];
}
function personLabel(person, settings) {
  if (person === 'p1') return settings.person1Name;
  if (person === 'p2') return settings.person2Name;
  return '함께';
}
function getEventDateTime(s) {
  const [y, m, d] = s.date.split('-').map(Number);
  if (s.time) {
    const [hh, mm] = s.time.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm);
  }
  return new Date(y, m - 1, d, 23, 59);
}
function getReminderDateTime(s) {
  if (!s.reminder || s.reminder === 'none') return null;
  const [y, m, d] = s.date.split('-').map(Number);
  const eventDt = getEventDateTime(s);
  switch (s.reminder) {
    case '10m': return new Date(eventDt.getTime() - 10 * 60000);
    case '30m': return new Date(eventDt.getTime() - 30 * 60000);
    case '1h': return new Date(eventDt.getTime() - 3600000);
    case '1d': return new Date(eventDt.getTime() - 86400000);
    case 'morning': return new Date(y, m - 1, d, 9, 0);
    default: return null;
  }
}
function resizeImage(file, maxSize = 720, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w >= h && w > maxSize) { h = Math.round((h * maxSize) / w); w = maxSize; }
        else if (h > w && h > maxSize) { w = Math.round((w * maxSize) / h); h = maxSize; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try { resolve(canvas.toDataURL('image/jpeg', quality)); } catch (err) { reject(err); }
      };
      img.onerror = () => reject(new Error('image load failed'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}
function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function BottomNav({ view, setView }) {
  const items = [
    { key: 'home', icon: Home, label: '홈' },
    { key: 'calendar', icon: Calendar, label: '캘린더' },
    { key: 'list', icon: List, label: '리스트' },
  ];
  return (
    <nav style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', background: '#FFFFFF', borderTop: '1px solid #E8EEF5', zIndex: 40 }}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = view === item.key;
        return (
          <button key={item.key} onClick={() => setView(item.key)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '11px 0 9px', background: 'none', border: 'none', color: active ? '#2F80ED' : '#94A3B8' }}>
            <Icon size={22} strokeWidth={active ? 2.5 : 2} />
            <span style={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ReminderBanner({ reminders, onDismiss }) {
  if (reminders.length === 0) return null;
  return (
    <div style={{ padding: '6px 20px 0', flexShrink: 0 }}>
      {reminders.map((r) => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', borderRadius: 14, padding: '10px 12px', marginBottom: 6, borderLeft: '4px solid #2F80ED', boxShadow: '0 2px 8px rgba(47,59,46,0.1)' }}>
          <Bell size={16} color="#2F80ED" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, color: '#1F2937', minWidth: 0 }}>
            <strong>{r.title}</strong> 일정이 곧 있어요{r.time ? ` (${r.time})` : ''}
          </div>
          <button onClick={() => onDismiss(r.id)} style={{ flexShrink: 0, background: 'none', border: 'none' }}>
            <X size={14} color="#94A3B8" />
          </button>
        </div>
      ))}
    </div>
  );
}

function DdayCard({ dday, index, onClick }) {
  const rot = ROTATIONS[index % ROTATIONS.length];
  return (
    <button onClick={onClick} className="cs-card" style={{ minWidth: 128, padding: '20px 14px 14px', flexShrink: 0, position: 'relative', transform: `rotate(${rot}deg)` }}>
      <span style={{ position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: '#2F80ED', boxShadow: '0 2px 3px rgba(47,59,46,0.3)' }} />
      <div style={{ fontSize: 22 }}>{dday.emoji}</div>
      <div style={{ fontSize: 12, color: '#64748B', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dday.title}</div>
      <div className="cs-serif" style={{ fontSize: 19, fontWeight: 700, marginTop: 3 }}>{calcDday(dday.date)}</div>
    </button>
  );
}

function scheduleCategory(schedule) {
  if (schedule.category) return schedule.category;
  if (schedule.person === 'both') return 'shared';
  return 'personal';
}

function scheduleCategoryLabel(schedule) {
  const category = scheduleCategory(schedule);
  if (category === 'application') return '청약일정';
  if (category === 'personal') return '개인일정';
  return '공유일정';
}

function scheduleCategoryClass(schedule) {
  const category = scheduleCategory(schedule);
  if (category === 'application') return 'cs-p2';
  if (category === 'personal') return 'cs-p1';
  return 'cs-both';
}

function ScheduleListItem({ schedule, settings, onClick }) {
  return (
    <div onClick={onClick} className="cs-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', marginBottom: 8, cursor: 'pointer' }}>
      <div className={scheduleCategoryClass(schedule)} style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{schedule.title}</div>
        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>
          {scheduleCategoryLabel(schedule)} · {schedule.time ? schedule.time : '하루 종일'}{schedule.reminder !== 'none' ? ' · 🔔' : ''}
        </div>
      </div>
    </div>
  );
}

function UpcomingPreview({ schedules, settings, onSeeAll, onItemClick }) {
  const upcoming = useMemo(() => {
    const todayStr = formatDateKey(new Date());
    return [...schedules]
      .filter((s) => s.date >= todayStr)
      .sort((a, b) => (a.date + (a.time || '00:00')).localeCompare(b.date + (b.time || '00:00')))
      .slice(0, 9);
  }, [schedules]);

  const categories = [
    { key: 'application', label: '청약일정', cls: 'cs-p2' },
    { key: 'personal', label: '개인일정', cls: 'cs-p1' },
    { key: 'shared', label: '공유일정', cls: 'cs-both' },
  ];

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h3 className="cs-serif" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>다가오는 일정</h3>
        <button onClick={onSeeAll} style={{ fontSize: 12, color: '#64748B', background: 'none', border: 'none' }}>전체보기</button>
      </div>
      {categories.map((cat) => {
        const items = upcoming.filter((s) => scheduleCategory(s) === cat.key).slice(0, 3);
        return (
          <div key={cat.key} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
              <span className={cat.cls} style={{ width: 7, height: 7, borderRadius: '50%' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{cat.label}</span>
            </div>
            {items.length === 0 ? (
              <div className="cs-card" style={{ padding: '12px 14px', color: '#94A3B8', fontSize: 12 }}>예정된 일정이 없어요</div>
            ) : (
              items.map((s) => <ScheduleListItem key={s.id} schedule={s} settings={settings} onClick={() => onItemClick(s)} />)
            )}
          </div>
        );
      })}
    </section>
  );
}

function PhotoFrame({ photo, index, onClick }) {
  const rot = ROTATIONS[index % ROTATIONS.length];
  const tape = TAPE_COLORS[index % TAPE_COLORS.length];
  return (
    <button onClick={onClick} style={{ background: '#FFFFFF', padding: '10px 10px 26px', borderRadius: 3, boxShadow: '0 4px 12px rgba(47,59,46,0.2)', transform: `rotate(${rot}deg)`, border: 'none', position: 'relative' }}>
      <span style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%) rotate(-3deg)', width: 34, height: 14, background: tape, opacity: 0.8, borderRadius: 2 }} />
      <img src={photo.dataUrl} alt={photo.caption || ''} style={{ width: 108, height: 108, objectFit: 'cover', display: 'block' }} />
      {photo.caption ? (
        <div className="cs-hand" style={{ fontSize: 14, marginTop: 6, color: '#334155', maxWidth: 108, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo.caption}</div>
      ) : null}
    </button>
  );
}

function HomeView({ ddays, photos, schedules, settings, onAddDday, onEditDday, onAddPhoto, onViewPhoto, onSeeAllSchedules, onItemClick }) {
  return (
    <div>
      <section style={{ paddingTop: 6 }}>
        <h3 className="cs-serif" style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>D-DAY</h3>
        <div className="cs-scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, paddingTop: 4 }}>
          {ddays.map((d, i) => (
            <DdayCard key={d.id} dday={d} index={i} onClick={() => onEditDday(d)} />
          ))}
          <button onClick={onAddDday} style={{ minWidth: 90, borderRadius: 16, border: '2px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#94A3B8', background: 'transparent' }}>
            <Plus size={22} />
          </button>
        </div>
      </section>

      <UpcomingPreview schedules={schedules} settings={settings} onSeeAll={onSeeAllSchedules} onItemClick={onItemClick} />

      <section style={{ marginTop: 28, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <h3 className="cs-serif" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>앨범</h3>
          <button onClick={onAddPhoto} style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none' }}>
            <Camera size={14} /> 사진 추가
          </button>
        </div>
        {photos.length === 0 ? (
          <button onClick={onAddPhoto} style={{ width: '100%', padding: '36px 0', border: '2px dashed #CBD5E1', borderRadius: 16, color: '#94A3B8', background: 'transparent' }}>
            <Camera size={26} style={{ margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontSize: 13 }}>첫 사진을 추가해보세요</div>
          </button>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, padding: '14px 4px 8px' }}>
            {photos.map((p, i) => (
              <PhotoFrame key={p.id} photo={p} index={i} onClick={() => onViewPhoto(p)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CalendarViewComp({ schedules, currentMonth, setCurrentMonth, selectedDate, setSelectedDate, settings, onAddClick, onItemClick }) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = formatDateKey(new Date());

  const schedulesByDate = useMemo(() => {
    const map = {};
    schedules.forEach((s) => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [schedules]);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedList = selectedDate ? (schedulesByDate[selectedDate] || []) : [];

  return (
    <div style={{ paddingTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} style={{ padding: 8, background: 'none', border: 'none' }}>
          <ChevronLeft size={20} color="#64748B" />
        </button>
        <div className="cs-serif" style={{ fontSize: 17, fontWeight: 700 }}>{year}년 {MONTHS_KO[month]}</div>
        <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} style={{ padding: 8, background: 'none', border: 'none' }}>
          <ChevronRight size={20} color="#64748B" />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', textAlign: 'center', marginBottom: 6 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', padding: '4px 0' }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const dateStr = formatDateKey(new Date(year, month, d));
          const daySchedules = schedulesByDate[dateStr] || [];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          return (
            <button key={dateStr} onClick={() => setSelectedDate(dateStr)} style={{
              aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              borderRadius: 12, border: 'none',
              background: isSelected ? '#2F80ED' : (isToday ? '#EEF0FF' : 'transparent'),
              color: isSelected ? '#fff' : '#1F2937',
            }}>
              <span style={{ fontSize: 13, fontWeight: (isToday || isSelected) ? 800 : 500 }}>{d}</span>
              <div style={{ display: 'flex', gap: 2, height: 4 }}>
                {daySchedules.slice(0, 3).map((s) => (
                  <span key={s.id} className={scheduleCategoryClass(s)} style={{ width: 4, height: 4, borderRadius: '50%' }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 className="cs-serif" style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{selectedDate ? formatDisplayDate(selectedDate) : '날짜를 선택해주세요'}</h3>
          {selectedDate && (
            <button onClick={() => onAddClick(selectedDate)} style={{ fontSize: 12, color: '#2F80ED', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2, background: 'none', border: 'none' }}>
              <Plus size={14} /> 추가
            </button>
          )}
        </div>
        {selectedDate && selectedList.length === 0 && (
          <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>등록된 일정이 없어요</div>
        )}
        {selectedList.map((s) => (
          <ScheduleListItem key={s.id} schedule={s} settings={settings} onClick={() => onItemClick(s)} />
        ))}
      </div>
    </div>
  );
}

function ListViewComp({ schedules, settings, onItemClick }) {
  const { map, order } = useMemo(() => {
    const sorted = [...schedules].sort((a, b) => (a.date + (a.time || '00:00')).localeCompare(b.date + (b.time || '00:00')));
    const m = {};
    const o = [];
    sorted.forEach((s) => {
      if (!m[s.date]) { m[s.date] = []; o.push(s.date); }
      m[s.date].push(s);
    });
    return { map: m, order: o };
  }, [schedules]);

  if (order.length === 0) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#94A3B8' }}>
        <div style={{ fontSize: 14 }}>아직 등록된 일정이 없어요</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>오른쪽 아래 + 버튼으로 추가해보세요</div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 6 }}>
      {order.map((date) => (
        <div key={date} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 8 }}>{formatDisplayDate(date)}</div>
          {map[date].map((s) => (
            <ScheduleListItem key={s.id} schedule={s} settings={settings} onClick={() => onItemClick(s)} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ModalWrapper({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,37,29,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: '#F7F9FC', width: '100%', maxWidth: 480, maxHeight: '86vh', overflowY: 'auto', borderRadius: '24px 24px 0 0', padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 className="cs-serif" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none' }}>
            <X size={20} color="#64748B" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ScheduleModal({ initial, defaultDate, settings, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [date, setDate] = useState(initial?.date || defaultDate);
  const [allDay, setAllDay] = useState(initial ? !initial.time : true);
  const [time, setTime] = useState(initial?.time || '09:00');
  const [category, setCategory] = useState(initial?.category || 'shared');
  const [reminder, setReminder] = useState(initial?.reminder || 'none');
  const [memo, setMemo] = useState(initial?.memo || '');

  function handleSubmit() {
    if (!title.trim()) return;
    onSave({
      id: initial?.id || genId('s'),
      title: title.trim(),
      date,
      time: allDay ? null : time,
      person: category === 'personal' ? 'p1' : category === 'shared' ? 'both' : 'p2',
      category,
      reminder,
      memo: memo.trim(),
      createdAt: initial?.createdAt || Date.now(),
    });
  }

  const categoryOptions = [
    { key: 'application', label: '청약일정', cls: 'cs-p2' },
    { key: 'personal', label: '개인일정', cls: 'cs-p1' },
    { key: 'shared', label: '공유일정', cls: 'cs-both' },
  ];

  return (
    <ModalWrapper title={initial ? '일정 수정' : '일정 추가'} onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <label className="cs-label">제목</label>
        <input className="cs-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 병원 예약" autoFocus />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="cs-label">날짜</label>
        <input type="date" className="cs-input" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#334155', marginBottom: allDay ? 0 : 10 }}>
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          하루 종일
        </label>
        {!allDay && <input type="time" className="cs-input" value={time} onChange={(e) => setTime(e.target.value)} />}
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="cs-label">일정 선택</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {categoryOptions.map((opt) => {
            const active = category === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setCategory(opt.key)}
                className={active ? opt.cls : ''}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none',
                  background: active ? undefined : '#FFFFFF',
                  color: active ? '#fff' : '#64748B',
                  boxShadow: active ? 'none' : 'inset 0 0 0 1.5px #DCE5EF',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="cs-label">알림</label>
        <select className="cs-input" value={reminder} onChange={(e) => setReminder(e.target.value)}>
          <option value="none">알림 없음</option>
          <option value="10m">10분 전</option>
          <option value="30m">30분 전</option>
          <option value="1h">1시간 전</option>
          <option value="1d">하루 전</option>
          <option value="morning">당일 아침 9시</option>
        </select>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label className="cs-label">메모 (선택)</label>
        <textarea className="cs-input" rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} style={{ resize: 'none' }} />
      </div>
      <button className="cs-btn-primary" onClick={handleSubmit} disabled={!title.trim()}>저장</button>
      {initial && (
        <button className="cs-btn-secondary" style={{ marginTop: 8, color: '#DC4C64' }} onClick={() => onDelete(initial.id)}>
          삭제
        </button>
      )}
    </ModalWrapper>
  );
}

function DdayModal({ initial, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [date, setDate] = useState(initial?.date || formatDateKey(new Date()));
  const [emoji, setEmoji] = useState(initial?.emoji || DDAY_EMOJIS[0]);

  function handleSubmit() {
    if (!title.trim()) return;
    onSave({ id: initial?.id || genId('d'), title: title.trim(), date, emoji, createdAt: initial?.createdAt || Date.now() });
  }

  return (
    <ModalWrapper title={initial ? 'D-day 수정' : 'D-day 추가'} onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <label className="cs-label">아이콘</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DDAY_EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => setEmoji(e)} style={{
              width: 40, height: 40, borderRadius: 12, fontSize: 18,
              border: emoji === e ? '2px solid #2F80ED' : '1.5px solid #DCE5EF',
              background: emoji === e ? '#EEF0FF' : '#FFFFFF',
            }}>{e}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="cs-label">제목</label>
        <input className="cs-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 결혼기념일" autoFocus />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label className="cs-label">날짜</label>
        <input type="date" className="cs-input" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <button className="cs-btn-primary" onClick={handleSubmit} disabled={!title.trim()}>저장</button>
      {initial && (
        <button className="cs-btn-secondary" style={{ marginTop: 8, color: '#DC4C64' }} onClick={() => onDelete(initial.id)}>
          삭제
        </button>
      )}
    </ModalWrapper>
  );
}

function PhotoModal({ onClose, onSave }) {
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setProcessing(true);
    setError('');
    try {
      const dataUrl = await resizeImage(file);
      setPreview(dataUrl);
    } catch (err) {
      setError('이미지를 불러오지 못했어요');
    } finally {
      setProcessing(false);
    }
  }

  function handleSubmit() {
    if (!preview) return;
    onSave({ id: genId('p'), dataUrl: preview, caption: caption.trim(), createdAt: Date.now() });
  }

  return (
    <ModalWrapper title="사진 추가" onClose={onClose}>
      {!preview ? (
        <label style={{ display: 'block', border: '2px dashed #CBD5E1', borderRadius: 16, padding: '36px 0', textAlign: 'center', color: '#94A3B8', cursor: 'pointer' }}>
          <Camera size={26} style={{ margin: '0 auto 8px', display: 'block' }} />
          <div style={{ fontSize: 13 }}>{processing ? '불러오는 중...' : '사진 선택하기'}</div>
          <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        </label>
      ) : (
        <div style={{ marginBottom: 14, textAlign: 'center' }}>
          <img src={preview} alt="preview" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 12 }} />
          <button onClick={() => setPreview(null)} style={{ fontSize: 12, color: '#64748B', marginTop: 8, background: 'none', border: 'none' }}>다시 선택</button>
        </div>
      )}
      {error && <div style={{ color: '#DC4C64', fontSize: 12, marginTop: 8 }}>{error}</div>}
      {preview && (
        <>
          <div style={{ margin: '14px 0' }}>
            <label className="cs-label">캡션 (선택)</label>
            <input className="cs-input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="사진에 짧은 메모를 남겨보세요" />
          </div>
          <button className="cs-btn-primary" onClick={handleSubmit}>저장</button>
        </>
      )}
    </ModalWrapper>
  );
}

function PhotoViewModal({ photo, onClose, onDelete }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(24,30,23,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, width: '100%' }}>
        <img src={photo.dataUrl} alt={photo.caption || ''} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
        {photo.caption && <div className="cs-hand" style={{ color: '#fff', textAlign: 'center', marginTop: 12, fontSize: 16 }}>{photo.caption}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} className="cs-btn-secondary" style={{ flex: 1 }}>닫기</button>
          <button onClick={() => onDelete(photo.id)} style={{ flex: 1, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 14, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Trash2 size={14} /> 삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ settings, onClose, onSave }) {
  const [p1, setP1] = useState(settings.person1Name);
  const [p2, setP2] = useState(settings.person2Name);
  return (
    <ModalWrapper title="설정" onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <label className="cs-label">아내이름/별칭</label>
        <input className="cs-input" value={p1} onChange={(e) => setP1(e.target.value)} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label className="cs-label">남편의 이름/별칭</label>
        <input className="cs-input" value={p2} onChange={(e) => setP2(e.target.value)} />
      </div>
      <button className="cs-btn-primary" onClick={() => onSave({ person1Name: p1.trim() || '나', person2Name: p2.trim() || '남편' })}>저장</button>
    </ModalWrapper>
  );
}

export default function CoupleScheduleApp() {
  const [view, setView] = useState('home');
  const [schedules, setSchedules] = useState([]);
  const [ddays, setDdays] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [settings, setSettings] = useState({ person1Name: '나', person2Name: '남편' });
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [modalDefaultDate, setModalDefaultDate] = useState(formatDateKey(new Date()));
  const [showDdayModal, setShowDdayModal] = useState(false);
  const [editingDday, setEditingDday] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(null);

  const [dueReminders, setDueReminders] = useState([]);
  const dismissedRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      try {
        const results = await Promise.allSettled([
          window.storage.get(STORAGE_KEYS.SCHEDULES, true),
          window.storage.get(STORAGE_KEYS.DDAYS, true),
          window.storage.get(STORAGE_KEYS.PHOTOS, true),
          window.storage.get(STORAGE_KEYS.SETTINGS, true),
        ]);
        if (cancelled) return;
        const [sRes, dRes, pRes, stRes] = results;
        if (sRes.status === 'fulfilled' && sRes.value) {
          try {
            const loaded = JSON.parse(sRes.value.value);
            setSchedules(Array.isArray(loaded) ? loaded.map((s) => ({
              ...s,
              category: s.category || (s.person === 'both' ? 'shared' : 'personal')
            })) : []);
          } catch (e) {}
        }
        if (dRes.status === 'fulfilled' && dRes.value) {
          try { setDdays(JSON.parse(dRes.value.value)); } catch (e) {}
        }
        if (pRes.status === 'fulfilled' && pRes.value) {
          try { setPhotos(JSON.parse(pRes.value.value)); } catch (e) {}
        }
        if (stRes.status === 'fulfilled' && stRes.value) {
          try { setSettings(JSON.parse(stRes.value.value)); } catch (e) {}
        }
      } catch (e) {
        console.error('load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function check() {
      const now = Date.now();
      const due = schedules.filter((s) => {
        const remindAt = getReminderDateTime(s);
        if (!remindAt) return false;
        const eventAt = getEventDateTime(s);
        return now >= remindAt.getTime() && now <= eventAt.getTime() + 3600000 && !dismissedRef.current.has(s.id);
      });
      setDueReminders(due);
    }
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [schedules]);

  async function persist(key, value) {
    try {
      await window.storage.set(key, JSON.stringify(value), true);
    } catch (e) {
      console.error('persist failed', key, e);
    }
  }

  function handleDismissReminder(id) {
    dismissedRef.current.add(id);
    setDueReminders((prev) => prev.filter((s) => s.id !== id));
  }

  function openAddSchedule(dateStr) {
    setEditingSchedule(null);
    setModalDefaultDate(dateStr || formatDateKey(new Date()));
    setShowScheduleModal(true);
  }
  function openEditSchedule(schedule) {
    setEditingSchedule(schedule);
    setShowScheduleModal(true);
  }
  function handleSaveSchedule(schedule) {
    const exists = schedules.some((s) => s.id === schedule.id);
    const next = exists ? schedules.map((s) => (s.id === schedule.id ? schedule : s)) : [...schedules, schedule];
    setSchedules(next);
    persist(STORAGE_KEYS.SCHEDULES, next);
    setShowScheduleModal(false);
    setEditingSchedule(null);
  }
  function handleDeleteSchedule(id) {
    const next = schedules.filter((s) => s.id !== id);
    setSchedules(next);
    persist(STORAGE_KEYS.SCHEDULES, next);
    setShowScheduleModal(false);
    setEditingSchedule(null);
  }

  function openAddDday() {
    setEditingDday(null);
    setShowDdayModal(true);
  }
  function openEditDday(dday) {
    setEditingDday(dday);
    setShowDdayModal(true);
  }
  function handleSaveDday(dday) {
    const exists = ddays.some((d) => d.id === dday.id);
    const next = exists ? ddays.map((d) => (d.id === dday.id ? dday : d)) : [...ddays, dday];
    setDdays(next);
    persist(STORAGE_KEYS.DDAYS, next);
    setShowDdayModal(false);
    setEditingDday(null);
  }
  function handleDeleteDday(id) {
    const next = ddays.filter((d) => d.id !== id);
    setDdays(next);
    persist(STORAGE_KEYS.DDAYS, next);
    setShowDdayModal(false);
    setEditingDday(null);
  }

  function handleAddPhoto(photo) {
    const next = [photo, ...photos];
    setPhotos(next);
    persist(STORAGE_KEYS.PHOTOS, next);
    setShowPhotoModal(false);
  }
  function handleDeletePhoto(id) {
    const next = photos.filter((p) => p.id !== id);
    setPhotos(next);
    persist(STORAGE_KEYS.PHOTOS, next);
    setViewingPhoto(null);
  }

  function handleSaveSettings(newSettings) {
    setSettings(newSettings);
    persist(STORAGE_KEYS.SETTINGS, newSettings);
    setShowSettingsModal(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F7F9FC', display: 'flex', justifyContent: 'center' }}>
        <div className="cs-app" style={{ width: '100%', maxWidth: 480, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{CUSTOM_CSS}</style>
          <div style={{ color: '#94A3B8', fontSize: 14 }}>불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9FC', display: 'flex', justifyContent: 'center' }}>
      <div className="cs-app" style={{ width: '100%', maxWidth: 480, height: '100vh', position: 'relative', display: 'flex', flexDirection: 'column', background: '#F7F9FC', overflow: 'hidden' }}>
        <style>{CUSTOM_CSS}</style>

        <header style={{ padding: '22px 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <div className="cs-serif" style={{ fontSize: 20, fontWeight: 800 }}>한솔유진 부부 캘린더 ♥</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{formatTodayHeader()}</div>
          </div>
          <button onClick={() => setShowSettingsModal(true)} style={{ padding: 6, background: 'none', border: 'none' }}>
            <Settings size={20} color="#94A3B8" />
          </button>
        </header>

        <ReminderBanner reminders={dueReminders} onDismiss={handleDismissReminder} />

        <main className="cs-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 110px' }}>
          {view === 'home' && (
            <HomeView
              ddays={ddays} photos={photos} schedules={schedules} settings={settings}
              onAddDday={openAddDday} onEditDday={openEditDday}
              onAddPhoto={() => setShowPhotoModal(true)} onViewPhoto={setViewingPhoto}
              onSeeAllSchedules={() => setView('list')} onItemClick={openEditSchedule}
            />
          )}
          {view === 'calendar' && (
            <CalendarViewComp
              schedules={schedules} currentMonth={currentMonth} setCurrentMonth={setCurrentMonth}
              selectedDate={selectedDate} setSelectedDate={setSelectedDate} settings={settings}
              onAddClick={openAddSchedule} onItemClick={openEditSchedule}
            />
          )}
          {view === 'list' && (
            <ListViewComp schedules={schedules} settings={settings} onItemClick={openEditSchedule} />
          )}
        </main>

        <button onClick={() => openAddSchedule()} style={{
          position: 'absolute', right: 20, bottom: 88, width: 56, height: 56, borderRadius: 28,
          background: '#2F80ED', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(173,125,42,0.4)', border: 'none', zIndex: 40,
        }}>
          <Plus size={26} />
        </button>

        <BottomNav view={view} setView={setView} />

        {showScheduleModal && (
          <ScheduleModal
            initial={editingSchedule} defaultDate={modalDefaultDate} settings={settings}
            onClose={() => { setShowScheduleModal(false); setEditingSchedule(null); }}
            onSave={handleSaveSchedule} onDelete={handleDeleteSchedule}
          />
        )}
        {showDdayModal && (
          <DdayModal
            initial={editingDday}
            onClose={() => { setShowDdayModal(false); setEditingDday(null); }}
            onSave={handleSaveDday} onDelete={handleDeleteDday}
          />
        )}
        {showPhotoModal && <PhotoModal onClose={() => setShowPhotoModal(false)} onSave={handleAddPhoto} />}
        {showSettingsModal && (
          <SettingsModal settings={settings} onClose={() => setShowSettingsModal(false)} onSave={handleSaveSettings} />
        )}
        {viewingPhoto && (
          <PhotoViewModal photo={viewingPhoto} onClose={() => setViewingPhoto(null)} onDelete={handleDeletePhoto} />
        )}
      </div>
    </div>
  );
}
