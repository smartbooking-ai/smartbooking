import Link from "next/link";

export const metadata = {
  title: "SmartBooking",
  description: "Programări online simple pentru service-uri, clinici, frizerii și terenuri.",
};

function Feature({ title, desc }) {
  return (
    <div className="border border-gray-200 rounded-2xl p-5 bg-white">
      <div className="font-semibold text-lg">{title}</div>
      <div className="text-sm text-gray-600 mt-2">{desc}</div>
    </div>
  );
}

function Step({ n, title, desc }) {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold">
        {n}
      </div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-gray-600 mt-1">{desc}</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-black text-white flex items-center justify-center font-bold">
            SB
          </div>
          <div>
            <div className="font-bold leading-tight">SmartBooking</div>
            <div className="text-xs text-gray-500 -mt-0.5">Scheduling made simple</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/book"
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 transition text-sm font-semibold"
          >
            Fă o programare
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90 transition text-sm font-semibold"
          >
            Intră în Dashboard
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center mt-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-200 text-xs text-gray-600">
              <span className="font-semibold">MVP</span>
              <span>• programări + dashboard • sloturi la 30 min</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-4">
              Programări online, fără stres.
            </h1>

            <p className="text-gray-600 mt-4 text-lg leading-relaxed">
              SmartBooking e un sistem simplu de programări pentru service-uri, clinici, frizerii și
              alte servicii. Clientul alege un slot disponibil, iar tu confirmi cererea în dashboard.
            </p>

            <div className="flex flex-wrap gap-3 mt-6">
              <Link
                href="/book"
                className="px-5 py-3 rounded-2xl bg-black text-white hover:opacity-90 transition font-semibold"
              >
                Testează pagina publică (/book)
              </Link>
              <Link
                href="/login"
                className="px-5 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-100 transition font-semibold"
              >
                Vezi dashboard-ul (firmă)
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-xs text-gray-600">
              <span className="px-3 py-1 rounded-full bg-white border border-gray-200">
                ✅ sloturi disponibile
              </span>
              <span className="px-3 py-1 rounded-full bg-white border border-gray-200">
                ✅ fără suprapuneri
              </span>
              <span className="px-3 py-1 rounded-full bg-white border border-gray-200">
                ✅ pending / confirm
              </span>
              <span className="px-3 py-1 rounded-full bg-white border border-gray-200">
                ✅ program de lucru
              </span>
            </div>
          </div>

          {/* Preview card */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-lg">Cum funcționează</div>
                <div className="text-sm text-gray-600 mt-1">
                  Flux simplu: client → cerere → confirmare firmă
                </div>
              </div>
              <div className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                live pe localhost
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <Step
                n="1"
                title="Clientul alege serviciul și ziua"
                desc="Pe /book vede sloturi din 30 în 30, doar în programul de lucru."
              />
              <Step
                n="2"
                title="Sistemul blochează suprapunerile"
                desc="Nu poți avea două programări pe același interval (include buffer)."
              />
              <Step
                n="3"
                title="Firma confirmă în dashboard"
                desc="Accept/Reject/Delete, plus vedere pe zile și săptămână."
              />
            </div>

            <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Link
                href="/dashboard"
                className="px-4 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-100 transition text-center font-semibold"
              >
                Deschide Dashboard
              </Link>
              <Link
                href="/dashboard/settings"
                className="px-4 py-3 rounded-2xl bg-black text-white hover:opacity-90 transition text-center font-semibold"
              >
                Setări firmă
              </Link>
            </div>

            <div className="text-xs text-gray-500 mt-3">
              Tip: dacă nu ești logat, Dashboard te duce la Login.
            </div>
          </div>
        </div>

        {/* Features */}
        <section className="mt-14">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Ce primești</h2>
              <p className="text-sm text-gray-600 mt-1">
                Focus pe ce contează: programări rapide, clare și control total pentru firmă.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Feature
              title="Dashboard pentru firmă"
              desc="Servicii, clienți, programări, overview și acțiuni rapide."
            />
            <Feature
              title="Setări inteligente"
              desc="Program de lucru, slot interval, buffer, min notice și max zile în avans."
            />
            <Feature
              title="Pagină publică /book"
              desc="Clientul vede doar sloturile disponibile. Cererea intră pending sau confirmed."
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 border-t border-gray-200 pt-8 text-sm text-gray-600 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div>
            <span className="font-semibold text-gray-900">SmartBooking</span>{" "}
            <span className="text-gray-500">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link className="hover:text-gray-900" href="/book">
              /book
            </Link>
            <Link className="hover:text-gray-900" href="/login">
              /login
            </Link>
            <Link className="hover:text-gray-900" href="/dashboard">
              /dashboard
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
