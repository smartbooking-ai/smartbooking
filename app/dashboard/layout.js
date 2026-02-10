"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/ui";

export default function DashboardLayout({ children }) {
  const [email, setEmail] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        window.location.href = "/login";
        return;
      }
      setEmail(data.user.email || "");
    };
    load();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r hidden md:flex flex-col">
        <div className="px-4 py-4 border-b">
          <div className="font-bold text-lg">SmartBooking</div>
          <div className="text-xs text-gray-500">Admin Dashboard</div>
        </div>

        <nav className="p-3 space-y-1 text-sm">
          <a href="/dashboard" className="block px-3 py-2 rounded-lg hover:bg-gray-100">
            Overview
          </a>
          <a href="/dashboard/services" className="block px-3 py-2 rounded-lg hover:bg-gray-100">
            Servicii
          </a>
          <a href="/dashboard/bookings" className="block px-3 py-2 rounded-lg hover:bg-gray-100">
            Programări
          </a>
          <a href="/dashboard/customers" className="block px-3 py-2 rounded-lg hover:bg-gray-100">
            Clienți
          </a>
          <a href="/dashboard/settings" className="block px-3 py-2 rounded-lg hover:bg-gray-100">
            Setări
          </a>
        </nav>

        <div className="mt-auto p-3 text-xs text-gray-500">
          v0.1 • MVP
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1">
        {/* Header */}
        <header className="bg-white border-b">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">SmartBooking</div>
              <div className="text-xs text-gray-500">Admin</div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600 hidden sm:block">{email}</div>
              <Button variant="secondary" onClick={logout}>
                Logout
              </Button>
            </div>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
