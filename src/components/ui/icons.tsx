import type { SVGProps } from "react";

/**
 * Inline SVG ikonkalar (24×24, stroke 1.8) — tashqi kutubxonasiz.
 * `size` (px) va `className` orqali boshqariladi; rang — `currentColor`.
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  size?: number;
}

function make(name: string, path: React.ReactNode) {
  const Icon = ({ size = 18, ...rest }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      {path}
    </svg>
  );
  Icon.displayName = `Icon${name}`;
  return Icon;
}

export const ChevronDown = make("ChevronDown", <path d="m6 9 6 6 6-6" />);
export const ChevronUp = make("ChevronUp", <path d="m18 15-6-6-6 6" />);
export const ChevronLeft = make("ChevronLeft", <path d="m15 18-6-6 6-6" />);
export const ChevronRight = make("ChevronRight", <path d="m9 18 6-6-6-6" />);
export const ChevronsLeft = make("ChevronsLeft", <><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></>);
export const ChevronsRight = make("ChevronsRight", <><path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" /></>);
export const Check = make("Check", <path d="M20 6 9 17l-5-5" />);
export const X = make("X", <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const Plus = make("Plus", <><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const Minus = make("Minus", <path d="M5 12h14" />);
export const Search = make("Search", <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>);
export const Calendar = make("Calendar", <><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></>);
export const Clock = make("Clock", <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const Menu = make("Menu", <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>);
export const MoreHorizontal = make("MoreHorizontal", <><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></>);
export const PanelLeft = make("PanelLeft", <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></>);
export const Home = make("Home", <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>);
export const Book = make("Book", <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>);
export const BookOpen = make("BookOpen", <><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" /><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" /></>);
export const Library = make("Library", <><path d="m16 6 4 14" /><path d="M12 6v14" /><path d="M8 8v12" /><path d="M4 4v16" /></>);
export const FileText = make("FileText", <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></>);
export const Users = make("Users", <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>);
export const User = make("User", <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
export const Key = make("Key", <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" /></>);
export const ShieldCheck = make("ShieldCheck", <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>);
export const ShoppingBag = make("ShoppingBag", <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>);
export const Tag = make("Tag", <><path d="M12.6 2.6 21.4 11.4a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0L2.6 12.6V2.6z" /><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" /></>);
export const History = make("History", <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></>);
export const Bell = make("Bell", <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>);
export const Sun = make("Sun", <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const Moon = make("Moon", <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />);
export const Globe = make("Globe", <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18" /><path d="M12 3a14 14 0 0 0 0 18" /></>);
export const LogOut = make("LogOut", <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>);
export const Settings = make("Settings", <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const Upload = make("Upload", <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></>);
export const Download = make("Download", <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>);
export const Image = make("Image", <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>);
export const Trash = make("Trash", <><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></>);
export const Pencil = make("Pencil", <><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /><path d="m15 5 4 4" /></>);
export const Eye = make("Eye", <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>);
export const EyeOff = make("EyeOff", <><path d="M9.9 4.2A10.6 10.6 0 0 1 12 4c6.5 0 10 8 10 8a17.4 17.4 0 0 1-2.2 3.2" /><path d="M6.6 6.6A17.7 17.7 0 0 0 2 12s3.5 8 10 8a10.3 10.3 0 0 0 5.4-1.6" /><path d="m2 2 20 20" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>);
export const Play = make("Play", <path d="M6 4v16l14-8z" fill="currentColor" stroke="none" />);
export const ArrowRight = make("ArrowRight", <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>);
export const ArrowLeft = make("ArrowLeft", <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>);
export const ArrowUpRight = make("ArrowUpRight", <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></>);
export const Refresh = make("Refresh", <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></>);
export const Info = make("Info", <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>);
export const AlertTriangle = make("AlertTriangle", <><path d="m10.3 3.9-8.4 14A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.7-3l-8.4-14a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>);
export const CheckCircle = make("CheckCircle", <><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-4" /></>);
export const XCircle = make("XCircle", <><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></>);
export const Lock = make("Lock", <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const Smartphone = make("Smartphone", <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M12 18h.01" /></>);
export const Monitor = make("Monitor", <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></>);
export const Mail = make("Mail", <><rect x="2" y="4" width="20" height="16" rx="3" /><path d="m2 7 10 7 10-7" /></>);
export const Phone = make("Phone", <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />);
export const Filter = make("Filter", <path d="M22 3H2l8 9.5V19l4 2v-8.5z" />);
export const Layers = make("Layers", <><path d="m12 2 10 5-10 5L2 7z" /><path d="m2 12 10 5 10-5" /><path d="m2 17 10 5 10-5" /></>);
export const List = make("List", <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></>);
export const Grid = make("Grid", <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>);
export const Activity = make("Activity", <path d="M22 12h-4l-3 9L9 3l-3 9H2" />);
export const Sparkles = make("Sparkles", <><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 17v4M17 19h4" /></>);
export const Star = make("Star", <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />);
export const Bookmark = make("Bookmark", <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />);
export const Eraser = make("Eraser", <><path d="M19.4 12.6 12 20H7.5L4 16.5a2 2 0 0 1 0-2.8l7.6-7.6a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8z" /><path d="m8.5 9.5 6 6" /><path d="M12 20h9" /></>);
export const Highlighter = make("Highlighter", <><path d="m9 11-6 6v3h9l3-3" /><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4z" /></>);
export const ZoomIn = make("ZoomIn", <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /><path d="M11 8v6M8 11h6" /></>);
export const ZoomOut = make("ZoomOut", <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /><path d="M8 11h6" /></>);
export const Maximize = make("Maximize", <><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></>);
export const Send = make("Send", <><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>);
export const Wallet = make("Wallet", <><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" /><path d="M16 3H6a2 2 0 0 0-2 2v2" /><circle cx="17" cy="14" r="1.2" fill="currentColor" /></>);
export const Inbox = make("Inbox", <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z" /></>);
export const Hash = make("Hash", <><path d="M4 9h16" /><path d="M4 15h16" /><path d="M10 3 8 21" /><path d="m16 3-2 18" /></>);
export const Percent = make("Percent", <><path d="m19 5-14 14" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>);
export const Copy = make("Copy", <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>);
export const Columns = make("Columns", <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M12 4v16" /></>);
export const Rows = make("Rows", <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 12h18" /></>);
export const Loader = make("Loader", <><path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" /><path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" /><path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" /></>);
/* 33: lug'at */
export const Languages = make("Languages", <><path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" /></>);
export const Volume = make("Volume", <><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></>);
export const Shuffle = make("Shuffle", <><path d="M2 18h1.4a4 4 0 0 0 3.3-1.8l6.6-9.4A4 4 0 0 1 16.6 5H22" /><path d="m18 2 4 3-4 3" /><path d="M2 6h1.4a4 4 0 0 1 3.3 1.8l.8 1.2" /><path d="M22 19h-5.4a4 4 0 0 1-3.3-1.8l-.8-1.2" /><path d="m18 16 4 3-4 3" /></>);
export const RotateCcw = make("RotateCcw", <><path d="M3 12a9 9 0 1 0 2.6-6.4" /><path d="M3 3v6h6" /></>);
