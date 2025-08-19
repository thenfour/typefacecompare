import { useEffect } from "react";

// A curated list of commonly used keys:
export const KNOWN_KEYS = [
    // Navigation
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',

    // Editing/Control
    'Backspace',
    'Tab',
    'Enter',
    'Escape',
    'Delete',
    'Shift',
    'Control',
    'Alt',
    'Meta',  // Command on Mac

    // Locks and toggles
    'CapsLock',

    // Whitespace and formatting
    'Space',

    // Page and document navigation
    'PageUp',
    'PageDown',
    'Home',
    'End',

    // Function keys
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
    'F7', 'F8', 'F9', 'F10', 'F11', 'F12',

    // Alphanumeric (just lower-case here; the event key is often reported in lowercase)
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
    'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
    'u', 'v', 'w', 'x', 'y', 'z',

    // Digits
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
] as const;

// Derived union type of all known keys:
export type KnownKey = typeof KNOWN_KEYS[number];


const downKeys = new Set<string>();

export function addKey(key: string) {
    downKeys.add(key.toLowerCase());
}

export function removeKey(key: string) {
    downKeys.delete(key.toLowerCase());
}

export function isKeyDown(key: string) {
    return downKeys.has(key.toLowerCase());
}

export function getDownKeys() {
    return Array.from(downKeys);
}



interface KeyCommandOptions {
    keys: KnownKey[];           // array of keys required (e.g. ['Control', 'K'])
    onTrigger: () => void;    // callback to invoke when combo is matched
    eventType?: 'keydown' | 'keyup'; // defaults to 'keydown'
}

function downKeysToString(downKeys: Set<string>): string {
    return Array.from(downKeys).join('+');
}


export function useKeyCommand({ keys, onTrigger, eventType = 'keydown' }: KeyCommandOptions) {
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            addKey(event.key);

            const down = getDownKeys().map(k => k.toLowerCase());
            if (keys.every(k => down.includes(k.toLowerCase()))) {
                onTrigger();
            }
        }

        function handleKeyUp(event: KeyboardEvent) {
            removeKey(event.key);
        }

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [keys, onTrigger, eventType]);
}