"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, Button, Input, Select, Badge } from "@/components/ui/ui";

function statusTone(status) {
  if (status === "confirmed") return "green";
  if (status === "pending") return "yellow";
  if (status === "canceled") return "red";
  return "gray";
}

// LOCAL date key (not UTC)
function localDateKey(d) {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun ... 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // back to Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0); // LOCAL midnight
  return date;
}

function endOfWeekMonday(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setHours(0, 0, 0, 0);
  return end;
}

function dayLabel(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60000);
}

export default function BookingsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [services, setServices] = useState([]);
  const [bookingsLatest, setBookingsLatest] = useState([]);
  const [bookingsWeek, setBookingsWeek] = useState([]);

  // settings (we need buffer for overlap checks)
  const [bufferMin, setBufferMin] = useState(0);

  // week selector for the day-grid
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeekMonday(new Date())
  );
  const weekEnd = useMemo(() => endOfWeekMonday(weekStart), [weekStart]);

  // "Day details" modal/panel
  const [openDayKey, setOpenDayKey] = useState(""); // yyyy-mm-dd
  const [openDayLabel, setOpenDayLabel] = useState("");
  const [openDayItems, setOpenDayItems] = useState([]);

  // form fields
  const [serviceId, setServiceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [startAt, setStartAt] = useState(""); // datetime-local
  const [durationMin, setDurationMin] = useState(30);
  const [saving, setSaving] = useState(false);

  const requireAuth = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      window.location.href = "/login";
      return false;
    }
    return true;
  };

  const loadAll = async () => {
    setLoading(true);
    setErr("");

    const ok = await requireAuth();
    if (!ok) return;

    // load settings singleton (buffer)
    const { data: st, error: stErr } = await supabase
      .from("settings")
      .select("buffer_min")
      .eq("id", 1)
      .single();

    if (!stErr) {
      setBufferMin(Number(st?.buffer_min ?? 0) || 0);
    }

    // services
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
    if (!serviceId && (svc || []).length > 0) {
      setServiceId(svc[0].id);
      setDurationMin(svc[0].duration_min || 30);
    }

    // latest bookings (last 50)
    const { data: b, error: bErr } = await supabase
      .from("bookings")
      .select(
        "id,start_at,end_at,status,notes, services(name), customers(name,phone)"
      )
      .order("start_at", { ascending: false })
      .limit(50);

    if (bErr) {
      setErr(bErr.message);
      setLoading(false);
      return;
    }
    setBookingsLatest(b || []);

    // bookings for selected week (for grid)
    const { data: bw, error: bwErr } = await supabase
      .from("bookings")
      .select("id,start_at,end_at,status, services(name), customers(name,phone)")
      .gte("start_at", weekStart.toISOString())
      .lt("start_at", weekEnd.toISOString())
      .order("start_at", { ascending: true });

    if (bwErr) {
      setErr(bwErr.message);
      setLoading(false);
      return;
    }
    setBookingsWeek(bw || []);

    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  // keep day panel in sync if it's open
  useEffect(() => {
    if (!openDayKey) return;
    const list = bookingsWeek
      .filter((x) => localDateKey(new Date(x.start_at)) === openDayKey)
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    setOpenDayItems(list);
  }, [bookingsWeek, openDayKey]);

  const onChangeService = (id) => {
    setServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc?.duration_min) setDurationMin(svc.duration_min);
  };

  // ✅ Overlap check (uses bufferMin from settings)
  const hasConflict = async (slotStart, slotEnd) => {
    const checkStart = addMinutes(slotStart, -bufferMin).toISOString();
    const checkEnd = addMinutes(slotEnd, bufferMin).toISOString();

    // overlap rule: existing.start < checkEnd AND existing.end > checkStart
    const { data: conflicts, error } = await supabase
      .from("bookings")
      .select("id")
      .neq("status", "canceled")
      .lt("start_at", checkEnd)
      .gt("end_at", checkStart)
      .limit(1);

    if (error) throw new Error(error.message);
    return conflicts && conflicts.length > 0;
  };

  const addBooking = async (e) => {
    e.preventDefault();
    setErr("");

    if (!serviceId) return setErr("Alege un serviciu.");
    if (!customerName.trim()) return setErr("Completează numele clientului.");
    if (!customerPhone.trim()) return setErr("Completează telefonul.");
    if (!startAt) return setErr("Alege data și ora.");

    setSaving(true);

    // 1) customer upsert by phone
    const phone = customerPhone.trim();
    const name = customerName.trim();

    let customerId = null;

    const { data: existing, error: exErr } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", phone)
      .limit(1);

    if (exErr) {
      setSaving(false);
      return setErr(exErr.message);
    }

    if (existing && existing.length > 0) {
      customerId = existing[0].id;
      await supabase.from("customers").update({ name }).eq("id", customerId);
    } else {
      const { data: created, error: cErr } = await supabase
        .from("customers")
        .insert([{ name, phone }])
        .select("id")
        .single();

      if (cErr) {
        setSaving(false);
        return setErr(cErr.message);
      }
      customerId = created.id;
    }

    // 2) compute end time
    const start = new Date(startAt);
    const end = new Date(
      start.getTime() + (Number(durationMin) || 30) * 60000
    );

    // ✅ conflict check (prevents overlapping)
    try {
      const conflict = await hasConflict(start, end);
      if (conflict) {
        setSaving(false);
        return setErr(
          `Suprapunere detectată. Alege altă oră (buffer: ${bufferMin} min).`
        );
      }
    } catch (e2) {
      setSaving(false);
      return setErr(String(e2?.message || e2));
    }

    // 3) insert booking
    const { error: bErr } = await supabase.from("bookings").insert([
      {
        service_id: serviceId,
        customer_id: customerId,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        status: "confirmed",
      },
    ]);

    if (bErr) setErr(bErr.message);
    else {
      setCustomerName("");
      setCustomerPhone("");
      setStartAt("");
      await loadAll();
    }

    setSaving(false);
  };

  const setStatus = async (id, status) => {
    setErr("");
    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id);
    if (error) setErr(error.message);
    else await loadAll();
  };

  const deleteBooking = async (id) => {
    const ok = confirm("Ștergi programarea?");
    if (!ok) return;

    setErr("");
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) setErr(error.message);
    else await loadAll();
  };

  // week grid helpers
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const bookingsByDay = useMemo(() => {
    const map = new Map();
    for (const d of weekDays) map.set(localDateKey(d), []);
    for (const b of bookingsWeek) {
      const key = localDateKey(new Date(b.start_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
      map.set(k, arr);
    }
    return map;
  }, [bookingsWeek, weekDays]);

  const weekTitle = useMemo(() => {
    const startLabel = weekStart.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "2-digit",
    });
    const endLabel = new Date(weekEnd.getTime() - 1).toLocaleDateString(
      undefined,
      { day: "2-digit", month: "2-digit" }
    );
    return `${startLabel} – ${endLabel}`;
  }, [weekStart, weekEnd]);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(startOfWeekMonday(d));
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(startOfWeekMonday(d));
  };

  const thisWeek = () => setWeekStart(startOfWeekMonday(new Date()));

  const openDay = (key, label) => {
    const list = (bookingsByDay.get(key) || []).slice();
    setOpenDayKey(key);
    setOpenDayLabel(label);
    setOpenDayItems(list);
  };

  const closeDay = () => {
    setOpenDayKey("");
    setOpenDayLabel("");
    setOpenDayItems([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Programări</h1>
          <p className="text-sm text-gray-600 mt-1">
            Adaugă și gestionează programările (MVP).
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Anti-overlap: activ (buffer din Setări = <b>{bufferMin} min</b>)
          </p>
        </div>
        <Button variant="secondary" onClick={loadAll}>
          Refresh
        </Button>
      </div>

      <Card title="Adaugă programare" subtitle="Client + serviciu + dată/oră">
        <form
          onSubmit={addBooking}
          className="grid grid-cols-1 md:grid-cols-6 gap-3"
        >
          <div className="md:col-span-2">
            <Select
              value={serviceId}
              onChange={(e) => onChangeService(e.target.value)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_min} min)
                </option>
              ))}
            </Select>
          </div>

          <div className="md:col-span-1">
            <Input
              placeholder="Nume client"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div className="md:col-span-1">
            <Input
              placeholder="Telefon"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>

          <div className="md:col-span-1">
            <Input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>

          <div className="md:col-span-1 flex md:justify-end">
            <Button disabled={saving}>{saving ? "Salvez..." : "Add"}</Button>
          </div>
        </form>

        <div className="mt-2 text-xs text-gray-500">
          Durata se preia din serviciu (automat): <b>{durationMin} min</b>
        </div>

        {err && <p className="mt-3 text-sm text-red-600">Eroare: {err}</p>}
      </Card>

      <Card
        title="Programări pe săptămână"
        subtitle="Click pe o zi ca să vezi toate programările din ziua aia"
        right={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={prevWeek}>
              ←
            </Button>
            <Button variant="secondary" onClick={thisWeek}>
              Săpt. curentă
            </Button>
            <Button variant="secondary" onClick={nextWeek}>
              →
            </Button>
            <div className="text-sm text-gray-500 ml-2">{weekTitle}</div>
          </div>
        }
      >
        {loading ? (
          <p className="text-gray-600">Se încarcă...</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
            {weekDays.map((d) => {
              const key = localDateKey(d);
              const list = bookingsByDay.get(key) || [];
              const label = dayLabel(d);

              const preview = list.slice(0, 2);
              const more = list.length - preview.length;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openDay(key, label)}
                  className="text-left bg-gray-50 border rounded-xl p-3 hover:bg-gray-100 transition"
                >
                  <div className="font-semibold">{label}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {list.length} programări • click pentru detalii
                  </div>

                  <div className="mt-3 space-y-2">
                    {list.length === 0 && (
                      <div className="text-sm text-gray-500">—</div>
                    )}

                    {preview.map((b) => (
                      <div key={b.id} className="bg-white border rounded-xl p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold truncate">
                            {b.services?.name || "Serviciu"}
                          </div>
                          <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                        </div>

                        <div className="text-xs text-gray-600 mt-1">
                          {new Date(b.start_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>

                        <div className="text-xs text-gray-600 mt-1 truncate">
                          {b.customers?.name || "Client"}
                        </div>
                      </div>
                    ))}

                    {more > 0 && (
                      <div className="text-xs text-gray-600">
                        +{more} programări…
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        title="Ultimele programări"
        subtitle="Afișăm ultimele 50"
        right={
          <div className="text-sm text-gray-500">
            {loading ? "..." : `${bookingsLatest.length} afișate`}
          </div>
        }
      >
        {loading ? (
          <p className="text-gray-600">Se încarcă...</p>
        ) : bookingsLatest.length === 0 ? (
          <p className="text-gray-600">Nu ai programări încă.</p>
        ) : (
          <div className="space-y-2">
            {bookingsLatest.map((b) => (
              <div
                key={b.id}
                className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {b.services?.name || "Serviciu"} •{" "}
                    {b.customers?.name || "Client"}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {new Date(b.start_at).toLocaleString()} →{" "}
                    {new Date(b.end_at).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                    <span>Tel: {b.customers?.phone || "-"}</span>
                    <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {b.status !== "confirmed" && (
                    <Button onClick={() => setStatus(b.id, "confirmed")}>
                      Accept
                    </Button>
                  )}
                  {b.status !== "canceled" && (
                    <Button
                      variant="secondary"
                      onClick={() => setStatus(b.id, "canceled")}
                    >
                      Reject
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => deleteBooking(b.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Day Details Modal */}
      {openDayKey && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDay();
          }}
        >
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-lg border">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <div className="font-bold text-lg">
                  Programări — {openDayLabel}
                </div>
                <div className="text-sm text-gray-600">
                  Total: <b>{openDayItems.length}</b>
                </div>
              </div>
              <Button variant="secondary" onClick={closeDay}>
                Close
              </Button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-auto">
              {openDayItems.length === 0 ? (
                <p className="text-gray-600">Nu există programări în ziua asta.</p>
              ) : (
                <div className="space-y-2">
                  {openDayItems.map((b) => (
                    <div
                      key={b.id}
                      className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {b.services?.name || "Serviciu"} •{" "}
                          {b.customers?.name || "Client"}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {new Date(b.start_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" – "}
                          {new Date(b.end_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                          <span>Tel: {b.customers?.phone || "-"}</span>
                          <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {b.status !== "confirmed" && (
                          <Button onClick={() => setStatus(b.id, "confirmed")}>
                            Accept
                          </Button>
                        )}
                        {b.status !== "canceled" && (
                          <Button
                            variant="secondary"
                            onClick={() => setStatus(b.id, "canceled")}
                          >
                            Reject
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          onClick={() => deleteBooking(b.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Tip: click pe fundal (outside) ca să închizi.
              </div>
              <Button variant="secondary" onClick={closeDay}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
