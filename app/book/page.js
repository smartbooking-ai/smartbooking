"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, Button, Input, Select, Badge } from "@/components/ui/ui";

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Local date key: yyyy-mm-dd
function localDateKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

// Build local Date from yyyy-mm-dd and "HH:MM"
function dateTimeLocal(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0); // LOCAL
}

function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60000);
}

function startOfLocalDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function startOfNextLocalDay(dateStr) {
  const s = startOfLocalDay(dateStr);
  s.setDate(s.getDate() + 1);
  return s;
}

function dayKeyFromDateStr(dateStr) {
  // 0=Sun..6=Sat (same as JS getDay)
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return String(dt.getDay());
}

export default function BookPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState(null);
  const [services, setServices] = useState([]);

  // form
  const [serviceId, setServiceId] = useState("");
  const [durationMin, setDurationMin] = useState(30);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [dateStr, setDateStr] = useState(""); // yyyy-mm-dd
  const [selectedTime, setSelectedTime] = useState(""); // HH:MM

  const [availableSlots, setAvailableSlots] = useState([]); // [{time, start, end}]

  const loadInitial = async () => {
    setLoading(true);
    setErr("");
    setOkMsg("");

    // settings singleton
    const { data: st, error: stErr } = await supabase
      .from("settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (stErr) {
      setErr(stErr.message);
      setLoading(false);
      return;
    }
    setSettings(st);

    // services active
    const { data: svc, error: svcErr } = await supabase
      .from("services")
      .select("id,name,duration_min,active")
      .eq("active", true)
      .order("name", { ascending: true });

    if (svcErr) {
      setErr(svcErr.message);
      setLoading(false);
      return;
    }

    setServices(svc || []);
    if ((svc || []).length > 0) {
      setServiceId(svc[0].id);
      setDurationMin(svc[0].duration_min || 30);
    }

    // default date: today (local)
    const todayKey = localDateKey(new Date());
    setDateStr(todayKey);

    setLoading(false);
  };

  useEffect(() => {
    loadInitial();
  }, []);

  const onChangeService = (id) => {
    setServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc?.duration_min) setDurationMin(svc.duration_min);
    setSelectedTime("");
  };

  const dateLimits = useMemo(() => {
    if (!settings) return { min: "", max: "" };
    const today = new Date();
    const min = localDateKey(today);

    const maxDays = Number(settings.max_days_ahead ?? 30);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + maxDays);
    const max = localDateKey(maxDate);

    return { min, max };
  }, [settings]);

  const workingHoursForDate = useMemo(() => {
    if (!settings || !dateStr) return null;
    const wh = settings.working_hours || {};
    const dk = dayKeyFromDateStr(dateStr); // "0".."6"
    return wh[dk] || null; // {open, close} or null
  }, [settings, dateStr]);

  const computeSlots = async () => {
    setErr("");
    setOkMsg("");
    setAvailableSlots([]);
    setSelectedTime("");

    if (!settings) return;
    if (!serviceId) return;
    if (!dateStr) return;

    // check working day
    if (!workingHoursForDate) {
      setAvailableSlots([]);
      return;
    }

    const openStr = workingHoursForDate.open;   // "09:00"
    const closeStr = workingHoursForDate.close; // "18:00"

    const slotInterval = Number(settings.slot_interval_min ?? 30) || 30; // user chose 30
    const bufferMin = Number(settings.buffer_min ?? 0) || 0;
    const minNoticeHours = Number(settings.min_notice_hours ?? 0) || 0;

    const open = dateTimeLocal(dateStr, openStr);
    const close = dateTimeLocal(dateStr, closeStr);

    // service end must fit before close
    const duration = Number(durationMin) || 30;

    // min notice check
    const now = new Date();
    const minStartAllowed = addMinutes(now, minNoticeHours * 60);

    // fetch existing bookings for that day (block pending+confirmed; ignore canceled)
    const dayStart = startOfLocalDay(dateStr);
    const dayEnd = startOfNextLocalDay(dateStr);

    const { data: existing, error: exErr } = await supabase
      .from("bookings")
      .select("start_at,end_at,status")
      .gte("start_at", dayStart.toISOString())
      .lt("start_at", dayEnd.toISOString())
      .neq("status", "canceled")
      .order("start_at", { ascending: true });

    if (exErr) {
      setErr(exErr.message);
      return;
    }

    // normalize existing intervals with buffer both sides
    const busy = (existing || []).map((b) => {
      const s = new Date(b.start_at);
      const e = new Date(b.end_at);
      const startBuffered = addMinutes(s, -bufferMin);
      const endBuffered = addMinutes(e, bufferMin);
      return { start: startBuffered, end: endBuffered };
    });

    const overlaps = (slotStart, slotEnd) => {
      for (const x of busy) {
        if (slotStart < x.end && slotEnd > x.start) return true;
      }
      return false;
    };

    // generate slots
    const slots = [];
    let cur = new Date(open);

    while (true) {
      const slotStart = new Date(cur);
      const slotEnd = addMinutes(slotStart, duration);

      // must end <= close
      if (slotEnd > close) break;

      // must respect min notice
      if (slotStart >= minStartAllowed) {
        // must not overlap
        if (!overlaps(slotStart, slotEnd)) {
          const time = `${pad2(slotStart.getHours())}:${pad2(slotStart.getMinutes())}`;
          slots.push({ time, start: slotStart, end: slotEnd });
        }
      }

      cur = addMinutes(cur, slotInterval);
    }

    setAvailableSlots(slots);
  };

  // recompute when date/service/settings change
  useEffect(() => {
    if (!loading && settings && services.length > 0 && dateStr && serviceId) {
      computeSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, settings, serviceId, durationMin, dateStr]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setOkMsg("");

    if (!settings) return setErr("Settings lipsesc (verifică tabela settings).");
    if (!serviceId) return setErr("Alege un serviciu.");
    if (!name.trim()) return setErr("Completează numele.");

    if (settings.require_phone && !phone.trim()) return setErr("Completează telefonul.");
    if (!dateStr) return setErr("Alege ziua.");
    if (!selectedTime) return setErr("Alege un interval disponibil.");

    setSaving(true);

    const phoneClean = phone.trim();
    const nameClean = name.trim();

    // customer upsert (by phone if present, else create dummy unique by timestamp)
    let customerId = null;

    if (phoneClean) {
      const { data: existing, error: exErr } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", phoneClean)
        .limit(1);

      if (exErr) {
        setSaving(false);
        return setErr(exErr.message);
      }

      if (existing && existing.length > 0) {
        customerId = existing[0].id;
        await supabase.from("customers").update({ name: nameClean }).eq("id", customerId);
      } else {
        const { data: created, error: cErr } = await supabase
          .from("customers")
          .insert([{ name: nameClean, phone: phoneClean }])
          .select("id")
          .single();

        if (cErr) {
          setSaving(false);
          return setErr(cErr.message);
        }
        customerId = created.id;
      }
    } else {
      // fallback: create customer without phone (not ideal, but safe for MVP)
      const { data: created, error: cErr } = await supabase
        .from("customers")
        .insert([{ name: nameClean }])
        .select("id")
        .single();

      if (cErr) {
        setSaving(false);
        return setErr(cErr.message);
      }
      customerId = created.id;
    }

    const slotStart = dateTimeLocal(dateStr, selectedTime);
    const slotEnd = addMinutes(slotStart, Number(durationMin) || 30);

    // FINAL SAFETY CHECK (no overlap) right before insert
    const bufferMin = Number(settings.buffer_min ?? 0) || 0;
    const checkStart = addMinutes(slotStart, -bufferMin).toISOString();
    const checkEnd = addMinutes(slotEnd, bufferMin).toISOString();

    // any booking that overlaps: start_at < checkEnd AND end_at > checkStart
    const { data: conflicts, error: confErr } = await supabase
      .from("bookings")
      .select("id,start_at,end_at,status")
      .neq("status", "canceled")
      .lt("start_at", checkEnd)
      .gt("end_at", checkStart)
      .limit(1);

    if (confErr) {
      setSaving(false);
      return setErr(confErr.message);
    }

    if (conflicts && conflicts.length > 0) {
      setSaving(false);
      await computeSlots(); // refresh slots
      return setErr("Intervalul a fost luat între timp. Alege alt slot.");
    }

    const status = settings.allow_pending ? "pending" : "confirmed";

    const { error: bErr } = await supabase.from("bookings").insert([
      {
        service_id: serviceId,
        customer_id: customerId,
        start_at: slotStart.toISOString(),
        end_at: slotEnd.toISOString(),
        status,
      },
    ]);

    if (bErr) {
      setSaving(false);
      return setErr(bErr.message);
    }

    setOkMsg(
      status === "pending"
        ? "Cererea ta a fost trimisă! Vei primi confirmare."
        : "Programarea ta a fost creată!"
    );

    setName("");
    setPhone("");
    setSelectedTime("");
    await computeSlots();

    setSaving(false);
  };

  const headerTitle = useMemo(() => {
    const bn = settings?.business_name || "SmartBooking";
    return bn;
  }, [settings]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl space-y-4">
        <div>
          <h1 className="text-3xl font-bold">{headerTitle}</h1>
          <p className="text-sm text-gray-600 mt-1">
            Alege un serviciu și un interval disponibil.
          </p>
        </div>

        <Card
          title="Programare"
          subtitle="Sloturi la 30 min (conform Setări). Fără suprapuneri."
          right={
            settings ? (
              <Badge tone={workingHoursForDate ? "green" : "yellow"}>
                {workingHoursForDate ? "program deschis" : "zi nelucrătoare"}
              </Badge>
            ) : null
          }
        >
          {loading ? (
            <p className="text-gray-600">Se încarcă...</p>
          ) : (
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <div className="text-xs text-gray-500 mb-1">Serviciu</div>
                <Select value={serviceId} onChange={(e) => onChangeService(e.target.value)}>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_min} min)
                    </option>
                  ))}
                </Select>
                <div className="text-xs text-gray-500 mt-2">
                  Durată: <b>{durationMin} min</b> • Buffer: <b>{settings?.buffer_min ?? 0} min</b> • Notice:{" "}
                  <b>{settings?.min_notice_hours ?? 0}h</b>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Nume</div>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Popescu Ion" />
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">
                  Telefon {settings?.require_phone ? "(obligatoriu)" : "(opțional)"}
                </div>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07..." />
              </div>

              <div className="md:col-span-2">
                <div className="text-xs text-gray-500 mb-1">Zi</div>
                <Input
                  type="date"
                  value={dateStr}
                  min={dateLimits.min}
                  max={dateLimits.max}
                  onChange={(e) => setDateStr(e.target.value)}
                />
                <div className="text-xs text-gray-500 mt-2">
                  Program:{" "}
                  <b>
                    {workingHoursForDate ? `${workingHoursForDate.open}–${workingHoursForDate.close}` : "închis"}
                  </b>
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="text-xs text-gray-500 mb-2">Intervale disponibile</div>

                {!workingHoursForDate && (
                  <div className="text-sm text-gray-600">Zi nelucrătoare. Alege altă zi.</div>
                )}

                {workingHoursForDate && availableSlots.length === 0 && (
                  <div className="text-sm text-gray-600">
                    Nu sunt sloturi disponibile (sau e prea din scurt). Alege altă zi.
                  </div>
                )}

                {workingHoursForDate && availableSlots.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {availableSlots.map((s) => {
                      const active = selectedTime === s.time;
                      return (
                        <button
                          key={s.time}
                          type="button"
                          onClick={() => setSelectedTime(s.time)}
                          className={`px-3 py-2 rounded-lg border text-sm transition ${
                            active
                              ? "bg-black text-white border-black"
                              : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {s.time}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedTime && (
                  <div className="text-xs text-gray-500 mt-2">
                    Selectat: <b>{selectedTime}</b>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 flex items-center justify-between gap-3 mt-2">
                <div className="text-xs text-gray-500">
                  Status:{" "}
                  <b>{settings?.allow_pending ? "pending (confirmare necesară)" : "confirmed"}</b>
                </div>
                <Button disabled={saving}>{saving ? "Trimit..." : "Trimite"}</Button>
              </div>

              {err && <p className="md:col-span-2 text-sm text-red-600">Eroare: {err}</p>}
              {okMsg && <p className="md:col-span-2 text-sm text-green-700">{okMsg}</p>}
            </form>
          )}
        </Card>

        <div className="text-xs text-gray-500">
          * Dacă nu vezi sloturi, verifică în Dashboard → Setări: zile active + ore + max days ahead + min notice.
        </div>
      </div>
    </div>
  );
}
