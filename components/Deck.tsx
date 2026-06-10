// components/Deck.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookmarkIcon, BrowseIcon, HomeIcon, ScanReticle, UserIcon,
} from "./icons";
import s from "./Deck.module.css";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/browse", label: "Browse", Icon: BrowseIcon },
  { href: "/saved", label: "Saved", Icon: BookmarkIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
];

export function Deck() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className={s.deck} aria-label="Primary">
      <div className={s.row}>
        {TABS.slice(0, 2).map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${s.tab}${isActive(href) ? ` ${s.active}` : ""}`}
            aria-current={isActive(href) ? "page" : undefined}
          >
            <Icon size={22} />
            <span>{label}</span>
          </Link>
        ))}

        <Link href="/scan" className={s.fab} aria-label="Scan a menu">
          <ScanReticle size={26} />
        </Link>

        {TABS.slice(2).map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${s.tab}${isActive(href) ? ` ${s.active}` : ""}`}
            aria-current={isActive(href) ? "page" : undefined}
          >
            <Icon size={22} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
