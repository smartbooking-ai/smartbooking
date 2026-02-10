"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, Button, Input } from "@/components/ui/ui";

export default function CustomersPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState("");

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
      .from("customers")
      .select("id,name,phone,email,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) setErr(error.message);
    else setCustomers(data || []);

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;

    return customers.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      return name.includes(s) || phone.includes(s) || email.includes(s);
    });
  }, [q, customers]);

  const deleteCustomer = async (id) => {
    const ok = confirm("Ștergi clientul? (șterge doar clientul, nu și programările)");
    if (!ok) return;

    setErr("");
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) setErr(error.message);
    else await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clienți</h1>
          <p className="text-sm text-gray-600 mt-1">
            Listă clienți (max 200), cu căutare rapidă.
          </p>
        </div>
        <Button variant="secondary" onClick={load}>
          Refresh
        </Button>
      </div>

      <Card
        title="Căutare"
        subtitle="Caută după nume, telefon sau email"
      >
        <Input
          placeholder="ex: 07..., Popescu, email..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {err && <p className="mt-3 text-sm text-red-600">Eroare: {err}</p>}
      </Card>

      <Card
        title="Lista clienți"
        subtitle="Din programări se creează automat clienți (după telefon)"
        right={
          <div className="text-sm text-gray-500">
            {loading ? "..." : `${filtered.length} afișați`}
          </div>
        }
      >
        {loading && <p className="text-gray-600">Se încarcă...</p>}

        {!loading && filtered.length === 0 && !err && (
          <p className="text-gray-600">Nu ai clienți încă.</p>
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Tel: <b>{c.phone}</b>
                    {c.email ? ` • Email: ${c.email}` : ""}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Creat: {new Date(c.created_at).toLocaleString()}
                  </div>
                </div>

                <Button variant="danger" onClick={() => deleteCustomer(c.id)}>
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
