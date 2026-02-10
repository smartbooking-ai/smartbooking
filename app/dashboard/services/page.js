"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, Button, Input, Badge } from "@/components/ui/ui";

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [saving, setSaving] = useState(false);

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

    const { data, error } = await supabase
      .from("services")
      .select("id,name,duration_min,active,created_at")
      .order("created_at", { ascending: false });

    if (error) setErr(error.message);
    else setServices(data || []);

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addService = async (e) => {
    e.preventDefault();
    setErr("");

    if (!name.trim()) {
      setErr("Completează numele serviciului.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("services").insert([
      {
        name: name.trim(),
        duration_min: Number(duration) || 30,
        active: true,
      },
    ]);

    if (error) setErr(error.message);
    else {
      setName("");
      setDuration(30);
      await load();
    }

    setSaving(false);
  };

  const deleteService = async (id) => {
    const ok = confirm("Ștergi serviciul?");
    if (!ok) return;

    setErr("");
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) setErr(error.message);
    else await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Servicii</h1>
          <p className="text-sm text-gray-600 mt-1">
            Administrează lista de servicii și duratele lor.
          </p>
        </div>
        <Button variant="secondary" onClick={load}>
          Refresh
        </Button>
      </div>

      <Card
        title="Adaugă serviciu"
        subtitle="Ex: Schimb anvelope, Echilibrare roți"
      >
        <form onSubmit={addService} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            placeholder="Nume serviciu"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            type="number"
            min="5"
            step="5"
            placeholder="Durată (minute)"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
          <Button disabled={saving}>
            {saving ? "Salvez..." : "Add"}
          </Button>
        </form>

        {err && <p className="mt-3 text-sm text-red-600">Eroare: {err}</p>}
      </Card>

      <Card
        title="Lista servicii"
        subtitle="Poți șterge servicii. Editarea o adăugăm imediat după."
        right={
          <div className="text-sm text-gray-500">
            {loading ? "..." : `${services.length} total`}
          </div>
        }
      >
        {loading && <p className="text-gray-600">Se încarcă...</p>}

        {!loading && services.length === 0 && !err && (
          <p className="text-gray-600">Nu ai servicii încă.</p>
        )}

        {!loading && services.length > 0 && (
          <div className="space-y-2">
            {services.map((s) => (
              <div
                key={s.id}
                className="border border-gray-100 rounded-xl p-3 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{s.name}</div>
                  <div className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                    <Badge tone={s.active ? "green" : "gray"}>
                      {s.active ? "active" : "inactive"}
                    </Badge>
                    <span>• {s.duration_min} min</span>
                    <span className="hidden sm:inline">
                      • {new Date(s.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <Button variant="danger" onClick={() => deleteService(s.id)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
