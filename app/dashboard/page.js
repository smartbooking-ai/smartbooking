"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, Button, Badge } from "@/components/ui/ui";

function startOfWeekMonday(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfWeekMonday(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setHours(0, 0, 0, 0);
  return end;
}

function startOfMonth(d = new Date()) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonth(start) {
  const x = new Date(start);
  x.setMonth(x.getMonth() + 1);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfYear(d = new Date()) {
  const x = new Date(d);
  x.setMonth(0, 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfYear(start) {
  const x = new Date(start);
  x.setFullYear(x.getFullYear() + 1, 0, 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function DashboardOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const weekEnd = useMemo(() => endOfWeekMonday(weekStart), [weekStart]);

  const [services, setServices] = useState([]);

  const [weekBookings, setWeekBookings] = useState([]);
  const [monthBookings, setMonthBookings] = useState([]);
  const [yearBookings, setYearBookings] = useState([]);

  const requireAuth = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      window.location.href = "/login";
      return false;
    }
    return true;
  };

  const load = async () => {
    setLoading(true);
    setErr("");

    const ok = await requireAuth();
    if (!ok) return;

    // services
    const { data: svc, error: svcErr } = await supabase
      .from("services")
      .select("id,name,active,created_at")
      .order("created_at", { ascending: false });

    if (svcErr) {
      setErr(svcErr.message);
      setLoading(false);
      return;
    }
    setServices(svc || []);

    // week bookings (also used for "Top servicii pe sapt selectata")
    const { data: w, error: wErr } = await supabase
      .from("bookings")
      .select("id,start_at,status, service_id, customer_id, services(name), customers(name,phone)")
      .gte("start_at", weekStart.toISOString())
      .lt("start_at", weekEnd.toISOString())
      .order("start_at", { ascending: false });

    if (wErr) {
      setErr(wErr.message);
      setLoading(false);
      return;
    }
    setWeekBookings(w || []);

    // month bookings
    const mStart = startOfMonth(new Date());
    const mEnd = endOfMonth(mStart);
    const { data: m, error: mErr } = await supabase
      .from("bookings")
      .select("id,start_at,status, customer_id, customers(name,phone)")
      .gte("start_at", mStart.toISOString())
      .lt("start_at", mEnd.toISOString());

    if (mErr) {
      setErr(mErr.message);
      setLoading(false);
      return;
    }
    setMonthBookings(m || []);

    // year bookings
    const yStart = startOfYear(new Date());
    const yEnd = endOfYear(yStart);
    const { data: y, error: yErr } = await supabase
      .from("bookings")
      .select("id,start_at,status, customer_id, customers(name,phone)")
      .gte("start_at", yStart.toISOString())
      .lt("start_at", yEnd.toISOString());

    if (yErr) {
      setErr(yErr.message);
      setLoading(false);
      return;
    }
    setYearBookings(y || []);

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

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

  const weekTitle = useMemo(() => {
    const startLabel = weekStart.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
    const endLabel = new Date(weekEnd.getTime() - 1).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
    return `${startLabel} – ${endLabel}`;
  }, [weekStart, weekEnd]);

  const stats = useMemo(() => {
    const totalServices = services.length;
    const activeServices = services.filter((s) => s.active).length;

    const weekTotal = weekBookings.length;
    const monthTotal = monthBookings.length;
    const yearTotal = yearBookings.length;

    const weekPending = weekBookings.filter((b) => b.status === "pending").length;
    const weekConfirmed = weekBookings.filter((b) => b.status === "confirmed").length;
    const weekCanceled = weekBookings.filter((b) => b.status === "canceled").length;

    return {
      totalServices,
      activeServices,
      weekTotal,
      monthTotal,
      yearTotal,
      weekPending,
      weekConfirmed,
      weekCanceled,
    };
  }, [services, weekBookings, monthBookings, yearBookings]);

  const topServices = useMemo(() => {
    // top services for selected week
    const counts = new Map();
    for (const b of weekBookings) {
      const name = b.services?.name || "Unknown";
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    const arr = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const max = arr.length ? arr[0].count : 0;
    return { arr, max };
  }, [weekBookings]);

  const loyalCustomers = useMemo(() => {
    // "fideli" = cei cu cele mai multe programari (anul asta)
    // (poți schimba pe all-time mai târziu)
    const counts = new Map(); // key phone -> {name, phone, count}
    for (const b of yearBookings) {
      const phone = b.customers?.phone || "—";
      const name = b.customers?.name || "Client";
      if (!counts.has(phone)) counts.set(phone, { name, phone, count: 0 });
      counts.get(phone).count += 1;
    }
    const arr = Array.from(counts.values()).sort((a, b) => b.count - a.count);
    const max = arr.length ? arr[0].count : 0;
    return { arr, max };
  }, [yearBookings]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-gray-600 mt-1">
            KPI-uri + top servicii + top clienți fideli.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={prevWeek}>←</Button>
          <Button variant="secondary" onClick={thisWeek}>Săpt. curentă</Button>
          <Button variant="secondary" onClick={nextWeek}>→</Button>
          <Button variant="secondary" onClick={load}>Refresh</Button>
        </div>
      </div>

      {err && <div className="text-sm text-red-600">Eroare: {err}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Servicii">
          <div className="text-3xl font-bold">{stats.totalServices}</div>
          <div className="text-sm text-gray-600 mt-1">
            Active: <b>{stats.activeServices}</b>
          </div>
        </Card>

        <Card title="Programări">
          <div className="text-sm text-gray-600">Săptămâna asta: <b>{stats.weekTotal}</b> ({weekTitle})</div>
          <div className="text-sm text-gray-600 mt-1">Luna asta: <b>{stats.monthTotal}</b></div>
          <div className="text-sm text-gray-600 mt-1">Anul ăsta: <b>{stats.yearTotal}</b></div>

          <div className="flex gap-2 mt-3 text-sm">
            <Badge tone="green">confirmed: {stats.weekConfirmed}</Badge>
            <Badge tone="yellow">pending: {stats.weekPending}</Badge>
            <Badge tone="red">canceled: {stats.weekCanceled}</Badge>
          </div>
        </Card>

        <Card title="Shortcuts">
          <div className="text-sm text-gray-600">
            • Vezi agenda săptămânală în <b>Programări</b><br />
            • Cererile din <b>/book</b> apar ca <b>pending</b>
          </div>
          <div className="mt-3">
            <a href="/dashboard/bookings" className="text-sm underline hover:text-black">
              Deschide Programări →
            </a>
          </div>
        </Card>
      </div>

      {/* Top services (week) + Loyal customers (year) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="Top servicii programate"
          subtitle={`Pe săptămâna selectată (${weekTitle})`}
          right={<div className="text-sm text-gray-500">{loading ? "..." : "Top"}</div>}
        >
          {loading ? (
            <p className="text-gray-600">Se încarcă...</p>
          ) : topServices.arr.length === 0 ? (
            <p className="text-gray-600">Nu există programări în săptămâna aceasta.</p>
          ) : (
            <div className="space-y-3">
              {topServices.arr.slice(0, 8).map((s) => {
                const pct = topServices.max ? Math.round((s.count / topServices.max) * 100) : 0;
                return (
                  <div key={s.name}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-gray-600">{s.count}</div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
                      <div className="h-2 bg-black/80" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          title="Top clienți fideli"
          subtitle="După numărul de programări (anul ăsta)"
          right={<div className="text-sm text-gray-500">{loading ? "..." : "Top"}</div>}
        >
          {loading ? (
            <p className="text-gray-600">Se încarcă...</p>
          ) : loyalCustomers.arr.length === 0 ? (
            <p className="text-gray-600">Nu ai clienți încă.</p>
          ) : (
            <div className="space-y-3">
              {loyalCustomers.arr.slice(0, 8).map((c) => {
                const pct = loyalCustomers.max ? Math.round((c.count / loyalCustomers.max) * 100) : 0;
                return (
                  <div key={c.phone}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-gray-600">{c.count}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{c.phone}</div>
                    <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
                      <div className="h-2 bg-black/80" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
