"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";

// LOGICA CORE 

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const ANCHOR = new Date(2026, 2, 5);

export function getShiftForDate(date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const anchor = new Date(ANCHOR); anchor.setHours(0, 0, 0, 0);
  const diff = Math.round((d - anchor) / 86400000);
  const cycleIdx = ((diff % 6) + 6) % 6;
  const dow = d.getDay();
  const isShortDay = dow === 2 || dow === 4 || dow === 6;
  const isMonday = dow === 1;
  switch (cycleIdx) {
    case 0: return isMonday
      ? { type: "riposo", cycleDay: 1, start: null, end: null, mondayRest: true }
      : { type: "diurno", cycleDay: 1, start: "08:00", end: isShortDay ? "18:00" : "18:30" };
    case 1: return { type: "diurno", cycleDay: 2, start: "08:00", end: "18:30" };
    case 2: return { type: "notte1", cycleDay: 3, start: "18:30", end: "00:00" };
    case 3: return { type: "notte2", cycleDay: 4, start: "00:00", end: "08:00" };
    case 4: return { type: "riposo", cycleDay: 5, start: null, end: null };
    case 5: return { type: "riposo", cycleDay: 6, start: null, end: null };
  }
}

// HELPERS TEMPO 

function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function calcOvertimeMinutes(shift, ot) {
  if (!ot) return 0;
  let mins = 0;
  if (shift.type === "riposo") {
    const s = timeToMin(ot.start || "08:00");
    const e = timeToMin(ot.end || "18:30");
    mins = e - s;
    if (mins < 0) mins += 1440;
    mins = Math.max(0, mins - 60); // sottrai pausa pranzo
    return mins;
  }
  if (ot.start && ot.start !== shift.start) {
    const diff = timeToMin(shift.start) - timeToMin(ot.start);
    if (diff > 0) mins += diff;
  }
  if (ot.end && ot.end !== shift.end) {
    if (shift.type === "notte2") {
      const diff = timeToMin(ot.end) - timeToMin(shift.end);
      if (diff > 0) mins += diff;
    } else {
      const diff = timeToMin(ot.end) - timeToMin(shift.end);
      if (diff > 0) mins += diff;
    }
  }
  return mins;
}

function formatHM(totalMinutes) {
  if (totalMinutes <= 0) return "0h 00m";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

// COSTANTI

const MONTHS_IT = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const DAYS_LONG = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

const META = {
  diurno: { label: "Diurno", icon: "☀️", bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-800", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400", calBg: "#fffbeb" },
  notte1: { label: "Notte", icon: "🌙", bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-800", badge: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-400", calBg: "#eef2ff" },
  notte2: { label: "Notte", icon: "🌙", bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-800", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500", calBg: "#f5f3ff" },
  riposo: { label: "Riposo", icon: "😴", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-400", badge: "bg-slate-100 text-slate-400", dot: "bg-slate-300", calBg: "#f8fafc" },
  mondayRest: { label: "Riposone", icon: "😴", bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-600", badge: "bg-sky-100 text-sky-600", dot: "bg-sky-300", calBg: "#f0f9ff" },
  ferie: { label: "Ferie", icon: "🌴", bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400", calBg: "#ecfdf5" },
};

function fmt(date) {
  return `${DAYS_LONG[date.getDay()]} ${date.getDate()} ${MONTHS_IT[date.getMonth()]}`;
}

function cycleLabel(shift) {
  if (shift.mondayRest) return "Riposone";
  switch (shift.cycleDay) {
    case 1: return "Primo";
    case 2: return "Secondo";
    case 3: return "Notte";
    case 4: return "Smonto";
    case 5: return "";
    case 6: return "";
    default: return "";
  }
}

// PANNELLO MODIFICA GIORNO

function DayEditPanel({ selectedKey, panelDate, shift, overtime, isFerie, onSaveOvertime, onRemoveOvertime, onAddFeria, onRemoveFeria, onClose }) {
  const existing = overtime[selectedKey];
  const isRiposo = shift.type === "riposo" && !shift.mondayRest;

  const [tab, setTab] = useState(isFerie ? "ferie" : "straordinario");
  const [startVal, setStartVal] = useState(existing?.start ?? shift.start ?? "08:00");
  const [endVal, setEndVal] = useState(existing?.end ?? shift.end ?? "18:30");

  const baseStart = shift.start ?? "08:00";
  const baseEnd = shift.end ?? "18:30";

  const handleSave = () => {
    if (tab === "ferie") {
      if (existing) onRemoveOvertime(selectedKey);
      onAddFeria(selectedKey);
    } else if (tab === "straordinario") {
      if (isFerie) onRemoveFeria(selectedKey);
      onSaveOvertime(selectedKey, { start: startVal, end: endVal });
    }
    onClose();
  };

  // preview minuti straordinario per riposo
  const previewMins = isRiposo
    ? Math.max(0, (timeToMin(endVal) - timeToMin(startVal)) - 60)
    : 0;

  return (
    <div className="bg-white border-2 border-stone-300 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-stone-50 border-b border-stone-200">
        <div>
          <h3 className="font-bold text-stone-800 text-sm uppercase tracking-wider">✏️ Modifica giorno</h3>
          <p className="text-xs text-stone-500 mt-0.5">{fmt(panelDate)} · {META[shift.mondayRest ? "mondayRest" : shift.type].label}</p>
        </div>
        <button onClick={onClose} type="button" className="text-stone-400 hover:text-stone-600 text-xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-200 transition-colors">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-100">
        {[
          { key: "ferie", icon: "🌴", label: "Ferie" },
          { key: "straordinario", icon: "⚡", label: "Straordinario" },
        ].map(({ key, icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-all border-b-2
              ${tab === key
                ? key === "ferie"
                  ? "border-emerald-500 text-emerald-700 bg-emerald-50"
                  : "border-red-500 text-red-700 bg-red-50"
                : "border-transparent text-stone-500 hover:bg-stone-50 hover:text-stone-700"
              }`}
          >
            <span className="text-base">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Contenuto tab */}
      <div className="p-5">
        {tab === "straordinario" && (
          <div className="space-y-3">
              <p className="text-xs text-stone-500">
                Orario base: <span className="font-mono text-stone-700">{baseStart} - {baseEnd}</span>
              </p>

            <div className="flex gap-3">
              <label className="flex-1">
                <span className="text-xs text-stone-500 uppercase tracking-wide">Inizio</span>
                <input type="time" value={startVal} onChange={e => setStartVal(e.target.value)}
                  className="block w-full mt-1 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300" />
                {!isRiposo && startVal < baseStart && (
                  <span className="text-xs lg:text-s text-red-500 mt-0.5 block">+{formatHM(timeToMin(baseStart) - timeToMin(startVal))}</span>
                )}
              </label>
              <label className="flex-1">
                <span className="text-xs text-stone-500 uppercase tracking-wide">Fine</span>
                <input type="time" value={endVal} onChange={e => setEndVal(e.target.value)}
                  className="block w-full mt-1 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300" />
                {!isRiposo && endVal > baseEnd && (
                  <span className="text-xs lg:text-s text-red-500 mt-0.5 block">+{formatHM(timeToMin(endVal) - timeToMin(baseEnd))}</span>
                )}
              </label>
            </div>
            {isRiposo && previewMins > 0 && (
              <p className="text-xs text-red-600 font-mono font-bold">
                Straordinario: {formatHM(previewMins)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 lg:flex lg:justify-center">
        <button
          type="button"
          onClick={handleSave}
          className={`w-full lg:w-auto lg:p-3 text-sm font-semibold py-2.5 rounded-xl transition-colors
            ${tab === "ferie" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}
        >
          {tab === "ferie" ? "🌴 Segna come ferie" : "Salva straordinario"}
        </button>
      </div>
    </div>
  );
}

// COMPONENTE PRINCIPALE

export default function MuseoOrari() {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayKey = dateKey(today);
  const todayShift = getShiftForDate(today);
  const todayMeta = META[todayShift.mondayRest ? "mondayRest" : todayShift.type];

  const [viewMode, setViewMode] = useState("month");
  const [monthOffset, setMonthOffset] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYearPage, setPickerYearPage] = useState(today.getFullYear());
  const [overtimeOpen, setOvertimeOpen] = useState(false);

  // Utente corrente
  const [user, setUser] = useState("marco");
  const switchUser = (u) => {
    setUser(u);
    setSelectedKey(null);
    setPanelDate(null);
  };

  // Straordinari per utente: { marco: { "YYYY-MM-DD": {...} }, giada: {...} }
  const [overtimeByUser, setOvertimeByUser] = useState({ marco: {}, giada: {} });
  // Ferie per utente:     { marco: Set<string>, giada: Set<string> }
  const [ferieByUser, setFerieByUser] = useState({ marco: new Set(), giada: new Set() });

  const overtime = overtimeByUser[user];
  const ferieSet = ferieByUser[user];

  const [selectedKey, setSelectedKey] = useState(null);
  const [panelDate, setPanelDate] = useState(null);

  // handlers straordinari
  const handleSaveOvertime = useCallback((key, data) => {
    setOvertimeByUser(prev => ({
      ...prev,
      [user]: { ...prev[user], [key]: data },
    }));
  }, [user]);

  const handleRemoveOvertime = useCallback((key) => {
    setOvertimeByUser(prev => {
      const next = { ...prev[user] };
      delete next[key];
      return { ...prev, [user]: next };
    });
  }, [user]);

  // handlers ferie
  const handleAddFeria = useCallback((key) => {
    setFerieByUser(prev => ({
      ...prev,
      [user]: new Set([...prev[user], key]),
    }));
  }, [user]);

  const handleRemoveFeria = useCallback((key) => {
    setFerieByUser(prev => {
      const next = new Set(prev[user]);
      next.delete(key);
      return { ...prev, [user]: next };
    });
  }, [user]);

  const closePanel = useCallback(() => { setSelectedKey(null); setPanelDate(null); }, []);
  const handleDayClick = useCallback((dateObj) => {
    setSelectedKey(dateKey(dateObj));
    setPanelDate(dateObj);
  }, []);

  // calendario
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const padding = (firstDow + 6) % 7;
  const calDays = [];
  for (let i = 0; i < padding; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calDays.push(d);

  // prossimo turno
  const nextWork = useMemo(() => {
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      const s = getShiftForDate(d);
      if (s.type !== "riposo") return { date: d, ...s };
    }
    return null;
  }, [today]);

  // scroll infinito
  const [listCount, setListCount] = useState(60);
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (viewMode !== "list") return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setListCount(c => c + 30); },
      { threshold: 0.1 }
    );
    const el = sentinelRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [viewMode]);
  useEffect(() => { if (viewMode === "list") setListCount(60); }, [viewMode]);

  const listItems = useMemo(() => Array.from({ length: listCount }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() + i); d.setHours(0, 0, 0, 0);
    return { date: d, ...getShiftForDate(d) };
  }), [today, listCount]);

  // ore straordinario
  const monthOvertimeMinutes = useMemo(() => {
    let total = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(viewYear, viewMonth, d);
      const key = dateKey(dateObj);
      const ot = overtime[key];
      if (!ot) continue;
      total += calcOvertimeMinutes(getShiftForDate(dateObj), ot);
    }
    return total;
  }, [overtime, viewYear, viewMonth, daysInMonth]);

  const currentMonthOvertimeMinutes = useMemo(() => {
    const yr = today.getFullYear(), mo = today.getMonth();
    const dim = new Date(yr, mo + 1, 0).getDate();
    let total = 0;
    for (let d = 1; d <= dim; d++) {
      const dateObj = new Date(yr, mo, d);
      const key = dateKey(dateObj);
      const ot = overtime[key];
      if (!ot) continue;
      total += calcOvertimeMinutes(getShiftForDate(dateObj), ot);
    }
    return total;
  }, [overtime, today]);

  // helpers render
  function effectiveShift(dateObj) {
    const key = dateKey(dateObj);
    const base = getShiftForDate(dateObj);
    const ot = overtime[key];
    if (!ot) return { ...base, hasOT: false };
    if (base.type === "riposo" && ot.start)
      return { ...base, isOTDay: true, start: ot.start, end: ot.end, hasOT: true };
    return { ...base, start: ot.start ?? base.start, end: ot.end ?? base.end, hasOT: true };
  }

  function metaKey(shift, key) {
    if (ferieSet.has(key)) return "ferie";
    if (shift.mondayRest) return "mondayRest";
    return shift.type;
  }

  return (
    <div style={{ fontFamily: "'Georgia','Times New Roman',serif" }}
      className="min-h-screen bg-stone-100 p-4 md:p-8">
      <div className="mx-auto space-y-5">

        {/*HEADER*/}
        <div className="text-center pt-2">
          <h1 style={{ letterSpacing: "0.18em" }}
            className="text-2xl md:text-3xl font-bold text-stone-800 uppercase">
            <span className="text-yellow-600">Recupero - </span><span className="text-violet-500">Riposo</span>
          </h1>
          <div className="flex items-center justify-center gap-2 mt-4">
            {["marco", "giada"].map(u => (
              <button key={u} type="button" onClick={() => switchUser(u)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all capitalize tracking-wide ${user === u
                  ? "bg-stone-800 text-white shadow-md"
                  : "bg-white text-stone-500 border border-stone-200 hover:border-stone-400 hover:text-stone-700"
                  }`}>
                {u === user ? "● " : ""}{u.charAt(0).toUpperCase() + u.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/*CARD OGGI*/}
        <div className={`rounded-2xl border-2 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm ${todayMeta.bg} ${todayMeta.border}`}>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest text-stone-400 mb-0.5">Oggi, {fmt(today)}</div>
            <div className={`text-xl font-bold ${todayMeta.text}`}>{todayMeta.label}</div>
            {todayShift.type !== "riposo" ? (
              <div className="text-sm mt-0.5 flex flex-wrap items-center gap-2">
                <span className="font-mono">{todayShift.start} - {todayShift.end}</span>
              </div>
            ) : nextWork && (
              <div className="text-stone-500 text-sm mt-0.5">
                Prossimo turno: <strong>{fmt(nextWork.date)}</strong>
                <span className="font-mono text-xs ml-2">{nextWork.start}-{nextWork.end}</span>
              </div>
            )}
          </div>
          <div className={`text-xs px-3 py-1 rounded-full font-mono shrink-0 ${todayMeta.badge}`}>
            Giorno {todayShift.cycleDay}/6
          </div>
        </div>

        {/*BARRA STRAORDINARI*/}
        <div className="bg-white rounded-2xl border-2 border-red-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setOvertimeOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3 bg-red-50 hover:bg-red-100/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="text-left">
                <h2 className="text-sm font-bold text-red-800 uppercase tracking-wide">
                  Straordinari
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-3 text-right">
                {monthOffset === 0 && <div className="text-center">
                  <div className="text-xs text-black uppercase tracking-wide">Questo mese</div>
                  <div className={`text-base font-bold font-mono ${currentMonthOvertimeMinutes > 0 ? "text-red-600" : "text-stone-400"}`}>
                    {formatHM(currentMonthOvertimeMinutes)}
                  </div>
                </div>}
                {monthOffset !== 0 && (
                  <div className="text-center">
                    <div className="text-xs uppercase tracking-wide">{MONTHS_IT[viewMonth]}</div>
                    <div className={`text-base font-bold font-mono ${monthOvertimeMinutes > 0 ? "text-red-600" : "text-stone-400"}`}>
                      {formatHM(monthOvertimeMinutes)}
                    </div>
                  </div>
                )}
              </div>
              <span className={`text-stone-400 text-sm transition-transform duration-200 ${overtimeOpen ? "rotate-180" : ""}`}>▾</span>
            </div>
          </button>

          {overtimeOpen && (
            Object.keys(overtime).length > 0 ? (
              <div className="divide-y divide-red-50">
                {Object.entries(overtime).sort(([a], [b]) => a.localeCompare(b)).map(([key, ot]) => {
                  const [yr, mo, dy] = key.split("-").map(Number);
                  const d = new Date(yr, mo - 1, dy);
                  const shift = getShiftForDate(d);
                  const mins = calcOvertimeMinutes(shift, ot);
                  const isRip = shift.type === "riposo";
                  return (
                    <div key={key}
                      className="flex items-center gap-3 px-5 py-2.5 hover:bg-red-50/50 cursor-pointer transition-colors"
                      onClick={() => handleDayClick(d)}>
                      <div className="text-base">{isRip ? "📋" : "⚡"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-stone-700">{fmt(d)}</div>
                        <div className="text-xs font-mono text-stone-500">
                          {isRip
                            ? `Turno straord. ${ot.start}-${ot.end}`
                            : `${ot.start ?? shift.start} - ${ot.end ?? shift.end}`}
                        </div>
                      </div>
                      <div className="text-sm font-bold font-mono text-red-600 shrink-0">+{formatHM(mins)}</div>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleRemoveOvertime(key); }}
                        className="text-stone-300 hover:text-red-400 text-lg leading-none transition-colors ml-1">×</button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-4 text-xs text-stone-400 italic">
                Nessuno straordinario registrato
              </div>
            )
          )}
        </div>

        {/*PANNELLO MODIFICA GIORNO*/}
        {selectedKey && panelDate && (
          <DayEditPanel
            selectedKey={selectedKey}
            panelDate={panelDate}
            shift={getShiftForDate(panelDate)}
            overtime={overtime}
            isFerie={ferieSet.has(selectedKey)}
            onSaveOvertime={handleSaveOvertime}
            onRemoveOvertime={handleRemoveOvertime}
            onAddFeria={handleAddFeria}
            onRemoveFeria={handleRemoveFeria}
            onClose={closePanel}
          />
        )}

        {/*TABS*/}
        <div className="flex gap-2">
          {[["month", "Calendario"], ["list", "Elenco dei giorni"]].map(([m, l]) => (
            <button type="button" key={m} onClick={() => setViewMode(m)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${viewMode === m
                ? "bg-stone-800 text-white shadow"
                : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
                }`}>{l}</button>
          ))}
        </div>

        {/*CALENDARIO*/}
        {viewMode === "month" && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 relative">
              <button type="button" onClick={() => setMonthOffset(o => o - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 text-xl">‹</button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setPickerOpen(p => !p); setPickerYearPage(viewYear); }}
                  className="group flex items-center gap-1.5 px-3 py-1 rounded-xl hover:bg-stone-100 transition-colors"
                >
                  <h2 style={{ letterSpacing: "0.1em" }} className="text-sm lg:text-lg font-bold text-stone-800 uppercase group-hover:text-stone-600">
                    {MONTHS_IT[viewMonth]} {viewYear}
                  </h2>
                  <span className={`text-stone-400 text-xs transition-transform ${pickerOpen ? "rotate-180" : ""}`}>▾</span>
                </button>
              </div>

              <button type="button" onClick={() => setMonthOffset(o => o + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 text-xl">›</button>

              {/* Overlay picker */}
              {pickerOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
              )}

              {/* Popup picker */}
              {pickerOpen && (
                <div className="absolute top-full left-1/2 z-50 mt-1 bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden"
                  style={{ transform: "translateX(-50%)", width: "clamp(280px,90vw,340px)" }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
                    <button type="button" onClick={() => setPickerYearPage(y => y - 4)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-200 text-stone-500 text-base">‹</button>
                    <div className="flex gap-1">
                      {Array.from({ length: 4 }, (_, i) => pickerYearPage + i - 1).map(yr => (
                        <button key={yr}
                          type="button"
                          onClick={() => { setMonthOffset((yr - today.getFullYear()) * 12 + viewMonth - today.getMonth()); setPickerYearPage(yr); }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${yr === viewYear ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-200"}`}>
                          {yr}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setPickerYearPage(y => y + 4)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-200 text-stone-500 text-base">›</button>
                  </div>
                  <div className="grid grid-cols-3 gap-1 p-3">
                    {MONTHS_IT.map((name, mi) => {
                      const isCurrentView = mi === viewMonth && pickerYearPage === viewYear;
                      const isThisMonth = mi === today.getMonth() && pickerYearPage === today.getFullYear();
                      return (
                        <button key={mi}
                          type="button"
                          onClick={() => { setMonthOffset((pickerYearPage - today.getFullYear()) * 12 + mi - today.getMonth()); setPickerOpen(false); }}
                          className={`py-2 px-1 rounded-xl text-xs font-medium transition-colors
                            ${isCurrentView ? "bg-stone-800 text-white"
                              : isThisMonth ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "text-stone-700 hover:bg-stone-100"}`}>
                          {name.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-3 pb-3">
                    <button type="button" onClick={() => { setMonthOffset(0); setPickerOpen(false); }}
                      className="w-full py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-medium transition-colors">
                      Torna al mese corrente
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-7 border-b border-stone-100">
              {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(d => (
                <div key={d} className="text-center text-xs uppercase tracking-widest text-stone-400 py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calDays.map((day, idx) => {
                if (!day) return <div key={`p${idx}`} className="h-20 border-b border-r border-stone-50 bg-stone-50/50" />;
                const dateObj = new Date(viewYear, viewMonth, day);
                const key = dateKey(dateObj);
                const eff = effectiveShift(dateObj);
                const base = getShiftForDate(dateObj);
                const isFeria = ferieSet.has(key);
                const mk = metaKey(base, key);
                const m = META[mk];
                const isToday = key === todayKey;
                const isWE = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                const hasOT = eff.hasOT && !isFeria;
                const isOTRiposo = hasOT && base.type === "riposo";

                return (
                  <div key={day}
                    style={{ backgroundColor: isFeria ? "#ecfdf5" : hasOT ? "#fff1f2" : m.calBg }}
                    onClick={() => handleDayClick(dateObj)}
                    className={`h-20 border-b border-r cursor-pointer transition-all select-none hover:brightness-95
                      ${isFeria ? "border-emerald-300" : hasOT ? "border-red-300" : "border-stone-100"}
                      ${isToday ? "ring-2 ring-inset ring-stone-800" : ""}
                      ${selectedKey === key ? "ring-2 ring-inset ring-stone-500" : ""}
                    `}>
                    <div className="p-1.5 flex flex-col h-full justify-between">
                      <div>
                        <div className={`text-xs font-bold ${isToday ? "text-stone-900" : isWE ? "text-rose-400" : "text-stone-500"}`}>
                          {day}
                          {isFeria && <span className="ml-1">🌴</span>}
                        </div>
                        <div className={`text-[9px] lg:text-[14px] font-bold leading-tight mt-0.5 ${isFeria ? "text-emerald-500" : m.text} opacity-70`}>
                          {cycleLabel(base)}
                        </div>
                      </div>
                      {!isFeria && (base.type !== "riposo" || isOTRiposo) && (
                        <div className="leading-snug">
                          {hasOT ? (
                            <div className="text-[10px] font-mono text-red-600 leading-snug">
                              <div>{eff.start}</div><div>{eff.end}</div>
                            </div>
                          ) : (
                            <div className={`text-[10px] font-mono leading-snug ${m.text}`}>
                              <div>{base.start}</div>
                              <div>
                                {base.end}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex justify-end items-end gap-1">
                        {hasOT && !isFeria && (
                          <div className="text-[9px] font-mono text-red-400 font-bold">
                            +{formatHM(calcOvertimeMinutes(base, overtime[key]))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/*ELENCO GIORNI (scroll infinito) */}
        {viewMode === "list" && (
          <div className="space-y-1.5">
            {listItems.map((s, i) => {
              const key = dateKey(s.date);
              const eff = effectiveShift(s.date);
              const isFeria = ferieSet.has(key);
              const hasOT = eff.hasOT && !isFeria;
              const mk = metaKey(s, key);
              const m = META[mk];
              const isToday = key === todayKey;
              const otMins = hasOT ? calcOvertimeMinutes(s, overtime[key]) : 0;
              const prevDate = i > 0 ? listItems[i - 1].date : null;
              const showSep = !prevDate || s.date.getMonth() !== prevDate.getMonth();

              return (
                <div key={key}>
                  {showSep && (
                    <div className="flex items-center gap-3 pt-4 pb-1 px-1">
                      <div className="text-xs font-bold uppercase tracking-widest text-stone-400">
                        {MONTHS_IT[s.date.getMonth()]} {s.date.getFullYear()}
                      </div>
                      <div className="flex-1 h-px bg-stone-200" />
                    </div>
                  )}
                  <div
                    onClick={() => handleDayClick(s.date)}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-2.5 cursor-pointer transition-all
                      ${isFeria ? "bg-emerald-50 border-emerald-300 hover:bg-emerald-100/50"
                        : hasOT ? "bg-red-50 border-red-300 hover:bg-red-100/50"
                          : `${m.bg} ${m.border} hover:brightness-95`}
                      ${isToday ? "shadow-md" : ""}
                      ${selectedKey === key ? "ring-2 ring-stone-500" : ""}
                    `}>
                    <div className="text-lg w-7 text-center leading-none">
                      {isFeria ? "🌴" : m.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold flex flex-wrap items-center gap-2 ${isFeria ? "text-emerald-700" : hasOT ? "text-red-800" : m.text}`}>
                        {fmt(s.date)}
                        {isToday && <span className="text-xs bg-stone-800 text-white px-2 py-0.5 rounded-full">oggi</span>}
                        {isFeria && <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">ferie</span>}
                        {hasOT && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">straord.</span>}
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {isFeria
                          ? <span className="text-emerald-600 italic">Ferie</span>
                          : s.type !== "riposo" || (hasOT && overtime[key]?.start)
                            ? <span className={`font-mono ${hasOT ? "text-red-600 font-bold" : ""}`}>
                              {eff.start} - {eff.end}
                              {!hasOT && s.type === "diurno" && s.end === "18:00" ? "" : ""}
                            </span>
                            : "Riposo"}
                      </div>
                    </div>
                    {hasOT && !isFeria && (
                      <div className="text-sm font-bold font-mono text-red-500 shrink-0">+{formatHM(otMins)}</div>
                    )}
                    <div className={`text-xs px-2 py-0.5 rounded-full ${m.badge} hidden sm:block shrink-0`}>{m.label}</div>
                    <div className="text-xs text-stone-400 font-medium shrink-0">{cycleLabel(s)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={sentinelRef} className="flex items-center justify-center py-6 gap-2 text-stone-400">
              <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              <span className="text-xs">Caricamento giorni…</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}