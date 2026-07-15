export function SidebarNavIcon({ id }: { id: string }) {
  const props = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "dashboard": return <svg {...props}><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>;
    case "disk": return <svg {...props}><circle cx="8" cy="8" r="6.5" /><circle cx="8" cy="8" r="2.5" /></svg>;
    case "docker": return <svg {...props}><rect x="2" y="4" width="12" height="10" rx="1.5" /><path d="M5 4V2h6v2" /><line x1="2" y1="8" x2="14" y2="8" /></svg>;
    case "cleanup": return <svg {...props}><path d="M3 4h10l-1 10H4L3 4z" /><path d="M1 4h14" /><path d="M6 4V2h4v2" /><line x1="6.5" y1="7" x2="7" y2="12" /><line x1="9.5" y1="7" x2="9" y2="12" /></svg>;
    case "process": return <svg {...props}><polyline points="1,12 4,8 7,10 10,4 13,6 15,2" /><line x1="1" y1="14" x2="15" y2="14" /></svg>;
    case "apps": return <svg {...props}><rect x="1" y="1" width="4" height="4" rx="0.5" /><rect x="6" y="1" width="4" height="4" rx="0.5" /><rect x="11" y="1" width="4" height="4" rx="0.5" /><rect x="1" y="6" width="4" height="4" rx="0.5" /><rect x="6" y="6" width="4" height="4" rx="0.5" /><rect x="11" y="6" width="4" height="4" rx="0.5" /><rect x="1" y="11" width="4" height="4" rx="0.5" /><rect x="6" y="11" width="4" height="4" rx="0.5" /><rect x="11" y="11" width="4" height="4" rx="0.5" /></svg>;
    case "devtools": return <svg {...props}><rect x="2" y="3" width="12" height="10" rx="2" /><path d="M6 13v2M10 13v2M5 15h6" /><path d="M5 6l-2 2 2 2M11 6l2 2-2 2" /></svg>;
    case "timeline": return <svg {...props}><circle cx="8" cy="8" r="6.5" /><polyline points="8,4 8,8 11,10" /></svg>;
    case "settings": return <svg {...props}><circle cx="8" cy="8" r="2.5" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4" /></svg>;
    default: return null;
  }
}
