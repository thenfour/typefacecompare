import { ReactNode, useId, useState } from "react";

interface AccordionSectionProps {
    title: string;
    subtitle?: string;
    defaultExpanded?: boolean;
    children: ReactNode;
    actions?: ReactNode;
    className?: string;
    bodyClassName?: string;
    sectionId?: string;
}

export function AccordionSection({
    title,
    subtitle,
    defaultExpanded = true,
    children,
    actions,
    className,
    bodyClassName,
    sectionId,
}: AccordionSectionProps) {
    const autoId = useId();
    const contentId = sectionId ?? `${autoId}-panel`;
    const headerId = `${contentId}-header`;
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const rootClassNames = ["dither-gradient-card", "accordion-section", className].filter(Boolean).join(" ");
    const bodyClassNames = ["accordion-section__body", bodyClassName].filter(Boolean).join(" ");

    return (
        <section className={rootClassNames} data-collapsed={!isExpanded}>
            <div className="accordion-section__header">
                <button
                    type="button"
                    className="accordion-section__trigger"
                    aria-expanded={isExpanded}
                    aria-controls={contentId}
                    id={headerId}
                    onClick={() => setIsExpanded((previous) => !previous)}
                >
                    <div className="accordion-section__labels">
                        <strong>{title}</strong>
                        {subtitle && <span>{subtitle}</span>}
                    </div>
                    <span className="accordion-section__chevron" aria-hidden="true" />
                </button>
                {actions && <div className="accordion-section__actions">{actions}</div>}
            </div>
            <div
                id={contentId}
                role="region"
                aria-labelledby={headerId}
                className={bodyClassNames}
                hidden={!isExpanded ? true : undefined}
                style={{ display: isExpanded ? "none" : undefined }}
            >
                {children}
            </div>
        </section>
    );
}
