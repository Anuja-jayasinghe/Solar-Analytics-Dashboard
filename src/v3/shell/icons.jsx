import { LayoutDashboard, Activity, ShieldCheck, Settings, ChevronLeft, Sun, Moon, LogIn } from 'lucide-react';

const BY_ID = { overview: LayoutDashboard, pro: Activity, admin: ShieldCheck, settings: Settings, collapse: ChevronLeft, sun: Sun, moon: Moon, signin: LogIn };

/** Icons by the ids used in nav.js. Decorative: the label next to them (or aria-label on the button) names the control. */
export function Icon({ id, size = 21 }) {
  const Cmp = BY_ID[id] ?? LayoutDashboard;
  return <Cmp size={size} strokeWidth={1.8} aria-hidden="true" focusable="false" style={{ flex: '0 0 auto' }} />;
}
