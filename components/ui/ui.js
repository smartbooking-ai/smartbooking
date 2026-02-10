export function Card({ title, subtitle, children, right }) {
  return (
    <div className="bg-white border rounded-xl shadow-sm">
      {(title || subtitle || right) && (
        <div className="px-4 py-3 border-b flex items-start justify-between gap-3">
          <div>
            {title && <div className="font-semibold">{title}</div>}
            {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Button({ children, variant = "primary", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition border";
  const styles = {
    primary: "bg-black text-white border-black hover:bg-gray-900",
    secondary: "bg-white text-gray-900 border-gray-200 hover:bg-gray-50",
    danger: "bg-white text-red-600 border-red-200 hover:bg-red-50",
  };
  return (
    <button className={`${base} ${styles[variant]}`} {...props}>
      {children}
    </button>
  );
}

export function Input(props) {
  return (
    <input
      className="border border-gray-200 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-black/20"
      {...props}
    />
  );
}

export function Select(props) {
  return (
    <select
      className="border border-gray-200 rounded-lg px-3 py-2 w-full bg-white focus:outline-none focus:ring-2 focus:ring-black/20"
      {...props}
    />
  );
}

export function Badge({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${tones[tone]}`}>
      {children}
    </span>
  );
}
