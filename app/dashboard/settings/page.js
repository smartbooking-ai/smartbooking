"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, Button, Input, Select, Badge } from "@/components/ui/ui";

const DAYS = [
  { key: "1", label: "Luni" },
  { key: "2", label: "Marți" },
  { key: "3", label: "Miercuri" },
  { key: "4", label: "Joi" },
  { key: "5", label: "Vineri" },
  { key: "6", label: "Sâmbătă" },
  { key: "0", label: "Duminică" },
];

const DEFAULT_HOURS = {
  "1": { open: "09:00", close: "18:00" },
  "2": { open: "09:00", close: "18:00" },
  "3": { open: "09:00", close: "18:00" },
  "4": { open: "09:00", close: "18:00" },
  "5": { open: "09:00", close: "18:00" },
};

function safeJson(obj, fallback) {
  if (obj && typeof obj === "object") return obj;
  return fallback;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // settings state
  const [businessName, setBusinessName] = useState("SmartBooking");
  const [businessPhone, setBusinessPhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("Europe/Bucharest");

  const [slotIntervalMin, setSlotIntervalMin] = useState(30);
  const [bufferMin, setBufferMin] = useState(0);
  const [maxDaysAhead, setMaxDaysAhead] = useState(30);
  const [minNoticeHours, setMinNoticeHours] = useState(2);

  const [allowPending, setAllowPending] = useState(true);
  const [requirePhone, setRequirePhone] = useState(true);

  const [workingHours, setWorkingHours] = useState(DEFAULT_HOURS);

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
    setOk("");

    const okAuth = await requireAuth();
    if (!okAuth) return;

    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    setBusinessName(data.business_name || "SmartBooking");
    setBusinessPhone(data.business_phone || "");
    setWhatsappPhone(data.whatsapp_phone || "");
    setAddress(data.address || "");
    setTimezone(data.timezone || "Europe/Bucharest");

    setSlotIntervalMin(data.slot_interval_min ?? 30);
    setBufferMin(data.buffer_min ?? 0);
    setMaxDaysAhead(data.max_days_ahead ?? 30);
    setMinNoticeHours(data.min_notice_hours ?? 2);

    setAllowPending(data.allow_pending ?? true);
    setRequirePhone(data.require_phone ?? true);

    setWorkingHours(safeJson(data.working_hours, DEFAULT_HOURS));

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    setErr("");
    setOk("");

    const payload = {
      id: 1,
      business_name: businessName?.trim() || "SmartBooking",
      business_phone: businessPhone?.trim() || null,
      whatsapp_phone: whatsappPhone?.trim() || null,
      address: address?.trim() || null,
      timezone: timezone?.trim() || "Europe/Bucharest",

      slot_interval_min: Number(slotIntervalMin) || 30,
      buffer_min: Number(bufferMin) || 0,
      max_days_ahead: Number(maxDaysAhead) || 30,
      min_notice_hours: Number(minNoticeHours) || 2,

      allow_pending: !!allowPending,
      require_phone: !!requirePhone,

      working_hours: workingHours || {},
    };

    const { error } = await supabase.from("settings").upsert(payload, { onConflict: "id" });

    if (error) setErr(error.message);
    else setOk("Salvat ✅");

    setSaving(false);
  };

  const setDayEnabled = (dayKey, enabled) => {
    setWorkingHours((prev) => {
      const next = { ...safeJson(prev, {}) };
      if (!enabled) {
        delete next[dayKey];
      } else {
        next[dayKey] = next[dayKey] || { open: "09:00", close: "18:00" };
      }
      return next;
    });
  };

  const setDayTime = (dayKey, which, value) => {
    setWorkingHours((prev) => {
      const next = { ...safeJson(prev, {}) };
      next[dayKey] = next[dayKey] || { open: "09:00", close: "18:00" };
      next[dayKey] = { ...next[dayKey], [which]: value };
      return next;
    });
  };

  const enabledDaysCount = useMemo(() => Object.keys(workingHours || {}).length, [workingHours]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Setări</h1>
          <p className="text-sm text-gray-600 mt-1">
            Program firmă, intervale de booking, reguli /book și date de contact.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={load}>Refresh</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvez..." : "Save"}
          </Button>
        </div>
      </div>

      {err && <div className="text-sm text-red-600">Eroare: {err}</div>}
      {ok && <div className="text-sm text-green-700">{ok}</div>}

      {loading ? (
        <p className="text-gray-600">Se încarcă...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Date firmă" subtitle="Apar în /book (și mai târziu în WhatsApp)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <div className="text-xs text-gray-500 mb-1">Nume firmă</div>
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Telefon</div>
                <Input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} placeholder="07..." />
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">WhatsApp</div>
                <Input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} placeholder="07..." />
              </div>

              <div className="md:col-span-2">
                <div className="text-xs text-gray-500 mb-1">Adresă</div>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Strada..., oraș..." />
              </div>

              <div className="md:col-span-2">
                <div className="text-xs text-gray-500 mb-1">Timezone</div>
                <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  <option value="Europe/Bucharest">Europe/Bucharest</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="Europe/Berlin">Europe/Berlin</option>
                </Select>
                <div className="text-xs text-gray-500 mt-2">
                  (Păstrăm simplu acum. Important pentru orele din programări.)
                </div>
              </div>
            </div>
          </Card>

          <Card
            title="Reguli booking"
            subtitle="Cum se comportă /book + cât de departe poți primi cereri"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Slot interval (minute)</div>
                <Select
                  value={slotIntervalMin}
                  onChange={(e) => setSlotIntervalMin(Number(e.target.value))}
                >
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                </Select>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Buffer între programări (min)</div>
                <Input
                  type="number"
                  min="0"
                  step="5"
                  value={bufferMin}
                  onChange={(e) => setBufferMin(Number(e.target.value))}
                />
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Max zile în avans</div>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={maxDaysAhead}
                  onChange={(e) => setMaxDaysAhead(Number(e.target.value))}
                />
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Min notice (ore)</div>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={minNoticeHours}
                  onChange={(e) => setMinNoticeHours(Number(e.target.value))}
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-between border rounded-xl p-3">
                <div>
                  <div className="font-semibold">/book → status pending</div>
                  <div className="text-sm text-gray-600">Cererile din /book intră ca pending (tu le accepți).</div>
                </div>
                <input
                  type="checkbox"
                  checked={allowPending}
                  onChange={(e) => setAllowPending(e.target.checked)}
                  className="w-5 h-5"
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-between border rounded-xl p-3">
                <div>
                  <div className="font-semibold">Telefon obligatoriu</div>
                  <div className="text-sm text-gray-600">Când activ, /book cere telefon mereu.</div>
                </div>
                <input
                  type="checkbox"
                  checked={requirePhone}
                  onChange={(e) => setRequirePhone(e.target.checked)}
                  className="w-5 h-5"
                />
              </div>

              <div className="md:col-span-2 text-xs text-gray-500">
                Tip: setările astea le vom folosi imediat când facem /book cu sloturi disponibile + fără suprapuneri.
              </div>
            </div>
          </Card>

          <Card
            title="Program de lucru"
            subtitle="Activezi zilele lucrătoare și orele. (Acestea vor controla sloturile din /book)"
            right={<Badge tone={enabledDaysCount ? "green" : "yellow"}>{enabledDaysCount} zile active</Badge>}
          >
            <div className="space-y-2">
              {DAYS.map((d) => {
                const enabled = !!workingHours?.[d.key];
                const open = workingHours?.[d.key]?.open || "09:00";
                const close = workingHours?.[d.key]?.close || "18:00";

                return (
                  <div key={d.key} className="border rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{d.label}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">activ</span>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setDayEnabled(d.key, e.target.checked)}
                          className="w-5 h-5"
                        />
                      </div>
                    </div>

                    {enabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Deschide</div>
                          <Input
                            type="time"
                            value={open}
                            onChange={(e) => setDayTime(d.key, "open", e.target.value)}
                          />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Închide</div>
                          <Input
                            type="time"
                            value={close}
                            onChange={(e) => setDayTime(d.key, "close", e.target.value)}
                          />
                        </div>
                        <div className="md:col-span-2 text-xs text-gray-500">
                          Ex: dacă închizi la 18:00 și ai serviciu de 60 min, ultimul start valid va fi 17:00.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Ce urmează" subtitle="Legăm setările de /book și blocăm suprapunerile">
            <div className="text-sm text-gray-700 space-y-2">
              <div>✅ Ai setări salvate în DB.</div>
              <div>🔜 Următorul pas: facem <b>/book</b> să arate sloturi disponibile (15/30 min) folosind:</div>
              <ul className="list-disc pl-5 text-sm text-gray-600">
                <li>Program de lucru</li>
                <li>Slot interval</li>
                <li>Buffer</li>
                <li>Min notice</li>
                <li>Max days ahead</li>
              </ul>
              <div className="text-xs text-gray-500">
                După asta: WhatsApp + AI.
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
