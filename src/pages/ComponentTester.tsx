import Head from "next/head";
import { ChangeEvent, useCallback, useEffect, useState } from "react";

import { Tooltip, TooltipPlacement } from "@/components/Tooltip";

const placements: TooltipPlacement[] = ["top", "right", "bottom", "left"];

const parseNumber = (event: ChangeEvent<HTMLInputElement>) => Number(event.target.value) || 0;

export default function ComponentTester() {
    const [tooltipText, setTooltipText] = useState("This tooltip uses the shared <Tooltip> component.");
    const [placement, setPlacement] = useState<TooltipPlacement>("top");
    const [enterDelay, setEnterDelay] = useState(150);
    const [leaveDelay, setLeaveDelay] = useState(100);
    const [offset, setOffset] = useState(8);
    const [arrow, setArrow] = useState(true);
    const [interactive, setInteractive] = useState(false);
    const [disableHover, setDisableHover] = useState(false);
    const [disableFocus, setDisableFocus] = useState(false);
    const [controlled, setControlled] = useState(false);
    const [manualOpen, setManualOpen] = useState(false);
    const [eventLog, setEventLog] = useState<string[]>([]);
    const [interactiveClicks, setInteractiveClicks] = useState(0);

    useEffect(() => {
        if (!controlled) {
            setManualOpen(false);
        }
    }, [controlled]);

    const logEvent = useCallback((entry: string) => {
        setEventLog(current => [entry, ...current].slice(0, 5));
    }, []);

    const tooltipContent = interactive
        ? (
            <div className="tooltipInteractive">
                <p>{tooltipText || "Interactive tooltip body"}</p>
                <button type="button" onClick={() => setInteractiveClicks(count => count + 1)}>
                    Clicked {interactiveClicks} {interactiveClicks === 1 ? "time" : "times"}
                </button>
            </div>
        )
        : (tooltipText || "");

    const playgroundTooltipProps = {
        title: tooltipContent,
        placement,
        enterDelay,
        leaveDelay,
        arrow,
        interactive,
        disableHoverListener: disableHover,
        disableFocusListener: disableFocus,
        offset,
        onOpen: () => logEvent("Tooltip opened"),
        onClose: () => logEvent("Tooltip closed"),
        ...(controlled ? { open: manualOpen } : {})
    };

    return (
        <>
            <Head>
                <title>Component Tester</title>
            </Head>
            <main className="componentTesterMain">
                <h1>Component Tester</h1>

                <section className="componentTesterCard">
                    <h2>Tooltip Playground</h2>
                    <p>Use the controls to exercise the shared tooltip component with different placements, delays, and behaviors.</p>

                    <div className="tooltipPlayground">
                        <div className="tooltipControls">
                            <label className="controlField">
                                <span>Tooltip content</span>
                                <textarea value={tooltipText} onChange={event => setTooltipText(event.target.value)} />
                            </label>

                            <label className="controlField">
                                <span>Placement</span>
                                <select value={placement} onChange={event => setPlacement(event.target.value as TooltipPlacement)}>
                                    {placements.map(option => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="controlField">
                                <span>Enter delay (ms)</span>
                                <input type="number" min={0} value={enterDelay} onChange={event => setEnterDelay(parseNumber(event))} />
                            </label>

                            <label className="controlField">
                                <span>Leave delay (ms)</span>
                                <input type="number" min={0} value={leaveDelay} onChange={event => setLeaveDelay(parseNumber(event))} />
                            </label>

                            <label className="controlField">
                                <span>Offset (px)</span>
                                <input type="number" min={0} value={offset} onChange={event => setOffset(parseNumber(event))} />
                            </label>

                            <label className="controlCheckbox">
                                <input type="checkbox" checked={arrow} onChange={event => setArrow(event.target.checked)} />
                                <span>Show arrow</span>
                            </label>

                            <label className="controlCheckbox">
                                <input type="checkbox" checked={interactive} onChange={event => setInteractive(event.target.checked)} />
                                <span>Interactive content</span>
                            </label>

                            <label className="controlCheckbox">
                                <input type="checkbox" checked={disableHover} onChange={event => setDisableHover(event.target.checked)} />
                                <span>Disable hover listener</span>
                            </label>

                            <label className="controlCheckbox">
                                <input type="checkbox" checked={disableFocus} onChange={event => setDisableFocus(event.target.checked)} />
                                <span>Disable focus listener</span>
                            </label>

                            <label className="controlCheckbox">
                                <input type="checkbox" checked={controlled} onChange={event => setControlled(event.target.checked)} />
                                <span>Controlled open</span>
                            </label>

                            {controlled && (
                                <div className="controlInline">
                                    <button type="button" onClick={() => setManualOpen(state => !state)}>
                                        {manualOpen ? "Close" : "Open"} tooltip
                                    </button>
                                    <span className="controlHint">State: {manualOpen ? "open" : "closed"}</span>
                                </div>
                            )}
                        </div>

                        <div className="tooltipPreview">
                            <Tooltip {...playgroundTooltipProps}>
                                <button type="button" className="previewTarget">
                                    Hover or focus to inspect tooltip
                                </button>
                            </Tooltip>

                            <div className="eventLog">
                                <strong>Recent events</strong>
                                {eventLog.length === 0 && <p>No events yet.</p>}
                                {eventLog.map((entry, index) => (
                                    <p key={`${entry}-${index}`}>{entry}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="componentTesterCard">
                    <h2>Placement Quick Look</h2>
                    <div className="placementGrid">
                        {placements.map(option => (
                            <Tooltip
                                key={option}
                                title={`Tooltip on ${option}`}
                                placement={option}
                                arrow
                            >
                                <button type="button" className="placementButton">
                                    {option}
                                </button>
                            </Tooltip>
                        ))}
                    </div>
                </section>
            </main>
        </>
    );
}
