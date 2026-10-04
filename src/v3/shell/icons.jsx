import {
  LayoutDashboard, Activity, ShieldCheck, Settings, ChevronLeft, Sun, Moon, LogIn, LogOut, Zap, Leaf, Cloud, Mountain, Star,
  Grid3x3, MessageSquareText, MessageSquareOff, Eye, EyeOff, X, FileText
} from 'lucide-react';

const BY_ID = {
  overview: LayoutDashboard, pro: Activity, admin: ShieldCheck, settings: Settings, collapse: ChevronLeft, sun: Sun, moon: Moon,
  signin: LogIn, signout: LogOut, bolt: Zap, leaf: Leaf, cloud: Cloud, mountain: Mountain, star: Star, panel: Grid3x3,
  hintsOn: MessageSquareText, hintsOff: MessageSquareOff, eye: Eye, eyeOff: EyeOff, close: X, file: FileText
};

/** Icons by the ids used in nav.js and avatars.js. Decorative: the label next to them (or aria-label on the button) names the control. */
export function Icon({ id, size = 21 }) {
  const Cmp = BY_ID[id] ?? LayoutDashboard;
  return <Cmp size={size} strokeWidth={1.8} aria-hidden="true" focusable="false" style={{ flex: '0 0 auto' }} />;
}
