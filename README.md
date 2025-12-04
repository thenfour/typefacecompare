

# style guide

For code contributors.

## Code should read like a story

The design intent should always be clear. If we describe a feature, that description
should largely be reflected directly in code. If "The page has 3 sections", then
I expect the code to show a page with 3 sections -- and they should almost certainly
be their own component.

## Reuse existing library code, never embed algorithms

### Inlining algorithms

Algorithms are not always huge complex libraries. They are also as small as an expression or pattern.

For example it may be tempting to write code like, `if (abs(x - y) < eps) ...`.
But this is not a story, it's a pattern. The story-like descriptive code shall read more something like,
`if (WithinDistance(x, y, eps))` or `if (Distance(x, y) < eps)` or `if (FloatEquals(x, y))` depending on the intent.

Similarly, `Average(a, b, c)` is better than `((a + b + c) / 3)`. We want descriptive code.

### Functions should have a meaningful names

Conceptual functions are verbs, classes are nouns, mostly. (React components are often expressed as functions; this counts as a noun)

Some exceptions can be made for very obvious things,
like when the function is a mathematical calculation.

```js
// acceptable:
function distance(x, y) { ... }
```


## Symbol names can be long, that's OK.

* Don't abbreviate too much, don't be ambiguous for the sake of brevity.
* Applies to all symbol names. classes, functions, variables, components, libraries, CSS class names, filenames...
* The bigger the scope of the symbol name, the more strict this rule must be.
* Short-lived temporaries are basically excluded from this rule. E.g., `for (int i = 0; i < itemCount; ++ i) { ... }` is acceptable when there's only 1 iterator (or `x` and `y` for x/y iterators et al). Or the block is very short (max a handful of lines)

## Magic numbers should be tweakable and descriptive

* Never bury magic numbers / heuristic constants / tweakable values deep in the code.
* Make these values exposed hopefully in a configurable way, at least at the top of the file.
* Never hard-code the value; it should be given a proper descriptive symbol name.
* For calculated constants, the code should make clear how this value was calculated / derived. If it was the result of experimentation, explanation of how this value came to be the accepted value should be added as a comment.

## Componentize

Components/classes/functions/et al should do one thing. When adding a new
feature that does another thing, it should live in its own component.

## Keep modular, incremental refactoring

For example you have a component like, 

```jsx
function MyPage() {
    return <div>
        {/* image manipulation controls */}
    </div>;
}
```

Then when adding a feature like "let's add a new section for exporting the image",
do NOT just lump the new feature into the existing component.

```jsx
// BAD:
function MyPage() {
    return <div>
        {/* image manipulation controls */}
        {/* image export controls */}
    </div>;
}
```

Better to refactor slightly so the main component stays clean and the features
are tight, modular and descriptive.

```jsx
// BETTER:
function MyPage() {
    return <div>
        <ImageManipulationControls ... />
        <ImageExportControls ... />
    </div>;
}
```

## No redundant error checking

Never use overly-verbose and redundant error-checking.

```C++
// bad:
if (FileExists(file))
{
    bool wasSuccessful = DeleteFile(file);
    // ... handle failure
}

// better:
bool wasSuccessful = DeleteFile(file);
// ... handle failure, including file doesn't exist.
```

### Avoid fallbacks or catches

* Use asserts at maximum, let exceptions reveal bugs.
* Never hide bugs by using catch-all handlers, casting to `any` / `void*` / etc.
* Never hide bugs by using fallback values (`if (value is not valid) return 0;`). Let the exception reveal the bug so it can be fixed. Never deny a bug the chance to reveal itself as early as possible. This is why we prefer strong typing (bugs to reveal at compile time), and why we prefer hard exceptions rather than runtime fallbacks.

## Strong typing always

* Bugs need to be revealed aggressively; strong typing enforces this intent.
* Never cast to `any` / `void*` / etc; use strong types where possible.
* When typing absolutely cannot be enforced, do the proper early runtime checks (e.g. using Zod)

## If it's not clear why a decision is made, or unconventional or less-than-perfect approach is taken, the code should describe why.

* Design intent, design intent, design intent. This should always be clear from the code itself.
* If design deviates from a reasonable expectation, a comment needs to exist

## Always be clear about units and ranges.

Symbol names should hint at the data they contain, beyond the technical datatype. For example
`rgb` is ambiguous when dealing with web colors in javascript. `rgb01` is clearer, indicating that the channels are 0-1 normalized. `rgb255` communicates a 0-255 integral scale.

```js
// Bad:
const rgb = GetColor(img, x, y);
const value = GetAudioValue(waveform, t);

// Better:
const rgb255 = GetColor(img, x, y); // even better would be if GetColor also makes clear what units it's using.
const ampDb = GetAudioValueDecibels(waveform, t);
```


## Never introduce new algorithms in existing code blocks

For example say we have a `ProcessBitmap` function that currently makes a bitmap image grayscale.

```js
// baseline function
function ProcessBitmap(bitmap)
{
    const ret = new Bitmap(bitmap.width, bitmap.height);
    for (let y = 0; y < bitmap.height; ++ y) {
        for (let x = 0; x < bitmap.width; ++ x) {
            ret[x, y] = ToGrayscale(bitmap[x, y]);
        }
    }
    return ret;
}

```

We need to add a gamma correction.

```js
// Bad:
function ProcessBitmap(bitmap, gamma)
{
    const ret = new Bitmap(bitmap.width, bitmap.height);
    for (let y = 0; y < bitmap.height; ++y) {
        for (let x = 0; x < bitmap.width; ++x) {
            ret[x, y] = Math.round(
                Math.pow(
                    ToGrayscale(bitmap[x, y]) / 255.0,
                    1.0 / gamma
                ) * 255.0
            );
        }
    }

    return ret;
}

// Better:
function ProcessBitmap(bitmap, gamma)
{
    const ret = new Bitmap(bitmap.width, bitmap.height);
    for (let y = 0; y < bitmap.height; ++ y) {
        for (let x = 0; x < bitmap.width; ++ x) {
            let grayscaled = ToGrayscale(bitmap[x, y]);
            ret[x, y] = ApplyGammaCorrection(grayscaled, gamma);
        }
    }
    return ret;
}

```









# how was this project started...

```
C:\root\git\thenfour>npx create-next-app@latest typefacecompare3
Need to install the following packages:
create-next-app@15.1.0
Ok to proceed? (y) y

√ Would you like to use TypeScript? ... Yes
√ Would you like to use ESLint? ... Yes
√ Would you like to use Tailwind CSS? ... No
√ Would you like your code inside a `src/` directory? ... Yes
√ Would you like to use App Router? (recommended) ... No
√ Would you like to use Turbopack for `next dev`? ... Yes
√ Would you like to customize the import alias (`@/*` by default)? ... No
Creating a new Next.js app in C:\root\git\thenfour\typefacecompare3.


```