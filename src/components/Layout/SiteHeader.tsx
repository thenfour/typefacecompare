import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";

export type SiteNavLink = {
    label: string;
    href: string;
    visible?: boolean;
};

export const SITE_NAV_LINKS: SiteNavLink[] = [
    { label: "Typeface Tool", href: "/" },
    { label: "Dither Gradient", href: "/DitherGradient" },
    { label: "Palette Lab", href: "/PaletteLab" },
    { label: "Palette Definition", href: "/PaletteDefinition" },
    { label: "Component Tester", href: "/ComponentTester" },
];

export function SiteHeader() {
    const router = useRouter();
    const navLinks = useMemo(() => SITE_NAV_LINKS.filter((link) => link.visible !== false), []);

    return (
        <header className="site-header">
            <div className="site-header__inner">
                <nav className="site-header__nav" aria-label="Primary">
                    {navLinks.map(({ href, label }) => {
                        const isActive = router.pathname === href;
                        const className = ["site-header__nav-link", isActive ? "is-active" : ""].filter(Boolean).join(" ");
                        return (
                            <Link key={href} href={href} className={className} aria-current={isActive ? "page" : undefined}>
                                {label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
}
