

// "Adelle Sans",
// "Acumin Pro",
// "Inter",
// "LATO",
// "Roboto",
// "Noto Sans",
// "Source Sans Pro",
// //"Falling Sky",
// "Fira Sans",
// "Trade Gothic LT Std",
// "Optima",
// "Azo Sans Test",

// "Avenir Next LT Pro Regular",
// "Segoe UI Variable Text",
// "Dubai",
// "Azo Sans Test",
// "Jost",
// "Arial",
// "PT Sans",

// "Overpass",
// "Verdana",
// "DejaVu Sans",

// //"MaestroTimes",
// "Adelle",
// "Adobe Text Pro",
// "Palatino LT",
// "TT Rationalist Trl",
// "Literata",
// "Goudy Old Style",
// "Libre Caslon Text",
// "Times New Roman",

// //"Jutlandia Slab",
// //"Quicksand",



import { CSSProperties, useEffect, useState } from "react";
import { gDefaultTypefaceCompareConfig } from "./DefaultConfig";
import ABCJSWrapper from "./ABCJSWrapper";
import { ToggleButton } from "./ToggleButton";
import * as ReactSmoothDnd /*{ Container, Draggable, DropResult }*/ from "react-smooth-dnd";
import { Markdown, MarkdownEditor } from "./MarkdownWrapper";



export function moveItemInArray<T>(array: T[], oldIndex: number, newIndex: number): T[] {
    if (oldIndex === newIndex) {
        return array; // No need to move if oldIndex and newIndex are the same
    }

    if (oldIndex < 0 || oldIndex >= array.length || newIndex < 0 || newIndex >= array.length) {
        throw new Error("Invalid oldIndex or newIndex");
    }

    const itemToMove = array[oldIndex]!;
    const newArray = [...array]; // Create a copy of the original array

    // Remove the item from the old position
    newArray.splice(oldIndex, 1);

    // Insert the item at the new position
    newArray.splice(newIndex, 0, itemToMove);

    return newArray;
}


export const gCharMap = {
    UpArrow: () => '\u2191',
    DownArrow: () => '\u2193',
    HorizontalEllipses: () => '\u2026',
    VerticalEllipses: () => '\u22EE',
    Checkmark: () => '✓',
    RightTriangle: () => '▶',
    LeftTriangle: () => '◀',
    BustInSilhouette: () => <>&#x1F464;</>,
    Hamburger: () => `☰`,
    Alert: () => `⚠`,
} as const;


// https://github.com/kutlugsahin/react-smooth-dnd/issues/88
export const ReactSmoothDndContainer = (props: React.PropsWithChildren<any>) => {
    return <ReactSmoothDnd.Container {...props as any} />;
}
export const ReactSmoothDndDraggable = (props: React.PropsWithChildren<any>) => {
    return <ReactSmoothDnd.Draggable {...props as any} />;
}


interface FontSpec {
    fontFamily: string;
    sizeScale: number;
    weightScale: number;
    notes: string;
    tags: string;
    enabled: boolean;
};

interface FontConfigProps {
    value: FontSpec;
    onChanged: (v: FontSpec) => void;
}

const FontConfig = (props: FontConfigProps) => {
    const [open, setOpen] = useState(false);
    return <div className={`fontSpecEditor ${open ? "open"  : "closed"}`}>
        <div><button onClick={() => setOpen(!open)}>{props.value.fontFamily}</button></div>
        {open && <div>
        <div><input type="text" value={props.value.fontFamily} onChange={e => props.onChanged({ ...props.value, fontFamily: e.target.value })} />font family</div>
        <div><input type="text" value={props.value.tags} onChange={e => props.onChanged({ ...props.value, tags: e.target.value })} />tags</div>
        <div><input type="text" value={props.value.notes} onChange={e => props.onChanged({ ...props.value, notes: e.target.value })} />notes</div>
        <div><label><input type="checkbox" checked={props.value.enabled} onChange={e => props.onChanged({ ...props.value, enabled: e.target.checked })} /> enabled</label></div>
        <div><input type="range" step={0.01} min={0.1} max={2} value={props.value.sizeScale} onChange={e => props.onChanged({ ...props.value, sizeScale: e.target.valueAsNumber })} />Size mul: {props.value.sizeScale}</div>
        <div><input type="range" step={0.01} min={0.1} max={2} value={props.value.weightScale} onChange={e => props.onChanged({ ...props.value, weightScale: e.target.valueAsNumber })} />Weight mul: {props.value.weightScale}</div>
        </div>}
    </div>;
};

interface SpecimenSection {
    text: string;
    weightScale: number;
    sizeScale: number;

    marginTop: number;
    marginBottom: number;
    enabled: boolean;
};



interface SpecimenOneLinerProps {
    specimen: SpecimenSection;
    font: FontSpec;
    fontSize: number,
    fontWeight: number,
    showFontName: boolean,
};

const SpecimenOneLiner = (props: SpecimenOneLinerProps) => {
    const style: CSSProperties = {
        fontFamily: props.font.fontFamily,
        fontSize: props.font.sizeScale * props.fontSize * props.specimen.sizeScale,
        fontWeight: props.fontWeight * props.font.weightScale * props.specimen.weightScale,
        marginTop: props.specimen.marginTop,
        marginBottom: props.specimen.marginBottom,
    };

    return <div className="SpecimenOneLiner" style={style}>
        <div className={`draggable dragHandle`}>
            {gCharMap.Hamburger()}
        </div>
        <div className="SpecimenOneLinerContent">
            <span className="SpecimenOneLinerText">{props.specimen.text}</span>
            {props.showFontName && <span className="SpecimenOneLinerFontName">{props.font.fontFamily}</span>}
        </div>
    </div>;
};







type SpecimenControlProps = {
    value: SpecimenSection;
    onChanged: (val: SpecimenSection) => void;
};

export const SpecimenControl = (props: SpecimenControlProps) => {
    return <div className="specimenControl">
        <textarea value={props.value.text} onChange={e => {
            props.onChanged({ ...props.value, text: e.target.value });
        }} />
        <div><input type="range" step={0.05} min={0.1} max={10} value={props.value.sizeScale} onChange={e => props.onChanged({ ...props.value, sizeScale: e.target.valueAsNumber })} /> Size mul: {props.value.sizeScale}</div>
        <div><input type="range" step={0.05} min={0.1} max={10} value={props.value.weightScale} onChange={e => props.onChanged({ ...props.value, weightScale: e.target.valueAsNumber })} /> Weight mul: {props.value.weightScale}</div>
        <div><input type="range" step={1} min={0} max={100} value={props.value.marginTop} onChange={e => props.onChanged({ ...props.value, marginTop: e.target.valueAsNumber })} />Margin top: {props.value.marginTop}</div>
        <div><input type="range" step={1} min={0} max={100} value={props.value.marginBottom} onChange={e => props.onChanged({ ...props.value, marginBottom: e.target.valueAsNumber })} />Margin bottom: {props.value.marginBottom}</div>
        <div><label><input type="checkbox" checked={props.value.enabled} onChange={e => props.onChanged({ ...props.value, enabled: e.target.checked })} />Enabled?</label></div>
        {/*         
        <div>
            line height:
            <input type="checkbox" checked={props.value.lineHeightEnable} onChange={e => props.onChanged({...props.value, lineHeightEnable: e.target.checked})} />
            <input type="range" step={1} min={0} max={100} value={props.value.lineHeight} onChange={e => props.onChanged({...props.value, lineHeight: e.target.valueAsNumber})} />
            {props.value.lineHeight}
            </div>*/}
    </div>;
};

type SpecimenCardSectionProps = {
    font: FontSpec,
    fontSize: number,
    fontWeight: number,
    specimen: SpecimenSection;
};

export const SpecimenCardSection = (props: SpecimenCardSectionProps) => {
    const style: CSSProperties = {
        fontFamily: props.font.fontFamily,
        fontSize: props.font.sizeScale * props.fontSize * props.specimen.sizeScale,
        fontWeight: props.fontWeight * props.font.weightScale * props.specimen.weightScale,
        marginTop: props.specimen.marginTop,
        marginBottom: props.specimen.marginBottom,
    };

    return <div style={style}>{props.specimen.text}</div>;
};

// const StaffMock = () => {
//     return <svg className="staff" viewBox="0 0 793 591"
//         version="1.1">

//         <g id="layer2" transform="translate(28.0625,-169.53125)">
//             <path d="m 115.34375,169.53125 c -0.45034,0 -0.92466,0.0709 -1.375,0.25 -4.86675,1.80307 -8.75789,4.69018 -11.6875,8.65625 -2.928749,3.96436 -5.207881,8.436 -6.875,13.4375 -1.667109,5.00151 -2.8381,10.13522 -3.46875,15.40625 -0.477491,3.98986 -0.75894,7.7503 -0.875,11.25 l -62.5,0 0,-0.0625 -4,0 0,541.46875 4,0 0,1 368.59375,0 368.5625,0 0,-3.4375 0,-3.4375 -368.5625,0 -368.59375,0 0,-34.28125 368.59375,0 368.5625,0 0,-3.4375 0,-3.40625 -368.5625,0 -368.59375,0 0,-34.3125 368.59375,0 368.5625,0 0,-3.40625 0,-3.4375 -368.5625,0 -368.59375,0 0,-34.28125 368.59375,0 368.5625,0 0,-3.4375 0,-3.4375 -368.5625,0 -368.59375,0 0,-34.28125 368.59375,0 368.5625,0 0,-3.40625 0,-3.4375 -368.5625,0 -368.59375,0 0,-199.5625 94.0625,0 c 0.8514,3.34973 2.11607,8.3841 4.46875,17.875 0.63115,3.32638 1.07252,5.78856 1.34375,7.375 0.26951,1.56936 0.37165,3.79331 0.28125,6.625 -0.0887,2.84874 -0.39675,5.56052 -0.9375,8.1875 -0.54075,2.60993 -1.356,4.7232 -2.4375,6.34375 -1.71096,2.2517 -4.07441,4.35366 -7.09375,6.28125 -3.01932,1.94465 -6.26218,3.28354 -9.6875,4 -3.42361,0.71645 -6.75584,0.65122 -10,-0.21875 -3.244166,-0.85292 -5.760278,-2.88391 -7.5625,-6.125 4.41556,0.17059 7.865504,-0.7116 10.34375,-2.65625 2.47858,-1.9276 4.12723,-4.29618 4.9375,-7.09375 0.81199,-2.79756 0.84487,-5.79303 0.125,-9 -0.72156,-3.18991 -1.9965,-5.90454 -3.84375,-8.15625 -1.84742,-2.25169 -4.192736,-3.8062 -7.03125,-4.625 -2.83868,-0.80175 -6.016716,-0.30818 -9.53125,1.5 -3.153919,1.5182 -5.687512,4.04848 -7.625,7.5625 -1.937489,3.51402 -2.90625,6.93781 -2.90625,10.28125 0,5.30515 1.599591,9.82958 4.84375,13.53125 3.244158,3.70166 7.255081,6.42763 12.03125,8.21875 3.874983,1.53526 7.85046,2.3125 11.90625,2.3125 1.17021,0 3.36236,-0.22406 6.5625,-0.71875 3.19845,-0.51175 6.7198,-2.18251 10.59375,-5.03125 3.87566,-2.83169 6.98349,-6.47954 9.28125,-11 2.29776,-4.50341 3.26617,-9.56111 2.90625,-15.15625 -0.35994,-5.85101 -0.92158,-10.61083 -1.6875,-14.3125 -0.63549,-3.06451 -1.8773,-8.74414 -3.46875,-16 l 268.71875,0 368.5625,0 0,-3.40625 0,-3.4375 -368.5625,0 -268.78125,0 c 0.29653,-0.22787 0.65986,-0.44913 1.09375,-0.625 1.6666,-0.6755 2.94136,-1.27174 3.84375,-1.8125 8.10954,-4.59551 14.02391,-11.66606 17.71875,-21.21875 1.02303,-3.5812 1.67155,-7.13437 1.96875,-10.625 l 244.15625,0 368.5625,0 0,-3.4375 0,-3.4375 -368.5625,0 -244.09375,0 c -0.30054,-3.96536 -1.24525,-7.90607 -2.90625,-11.78125 -2.02824,-4.73029 -4.74573,-8.96476 -8.125,-12.75 -3.37926,-3.78526 -7.40782,-6.7745 -12.09375,-8.9375 -0.7648,-0.30136 -1.54656,-0.56252 -2.34375,-0.8125 l 269.5625,0 368.5625,0 0,-3.40625 0,-3.4375 -368.5625,0 -286.75,0 -4.53125,-22.21875 c 0,-0.18082 0.39033,-0.70617 1.15625,-1.5625 0.76592,-0.85463 1.63392,-1.75891 2.625,-2.75 l 2.90625,-2.90625 c 0.94674,-0.94504 1.60881,-1.60711 1.96875,-1.96875 0.82074,-0.94343 1.56355,-1.90368 2.28125,-2.875 l 280.34375,0 368.5625,0 0,-3.4375 0,-3.4375 -368.5625,0 -276,0 c 0.6287,-1.07006 1.25756,-2.15932 1.875,-3.21875 3.69485,-7.20885 6.15874,-14.61871 7.375,-22.1875 0.47428,-2.95227 0.82789,-5.89555 1.0625,-8.875 l 265.6875,0 368.5625,0 0,-3.4375 0,-3.40625 -368.5625,0 -265.375,0 c 0.0414,-2.4044 0.0187,-4.82771 -0.0937,-7.25 -0.18083,-5.13628 -0.84289,-10.28641 -1.96875,-15.46875 -1.12755,-5.18062 -2.87998,-10.06072 -5.3125,-14.65625 -0.36164,-0.54075 -0.90513,-1.57673 -1.625,-3.0625 -0.72157,-1.4875 -1.55497,-2.91542 -2.5,-4.3125 -0.94674,-1.39708 -1.86243,-2.46763 -2.71875,-3.1875 -0.85634,-0.72157 -1.58759,-1.0625 -2.21875,-1.0625 z m 2.15625,24.6875 c 0.87872,-0.0676 1.74564,-0.0237 2.625,0.15625 1.75702,0.36165 3.19975,1.68579 4.28125,3.9375 1.53184,2.52464 2.10993,5.61766 1.75,9.3125 -0.36164,3.69484 -1.04017,7.02672 -2.03125,10 -0.095,0.2946 -0.21101,0.60467 -0.3125,0.90625 l -24.125,0 c 0.44069,-1.76399 0.9419,-3.50417 1.53125,-5.21875 1.4863,-4.32601 3.20362,-8.23598 5.1875,-11.75 0.71987,-1.0815 1.89256,-2.32167 3.46875,-3.71875 1.5779,-1.39708 3.24299,-2.43135 5,-3.0625 0.87851,-0.31558 1.74628,-0.4949 2.625,-0.5625 z m -107.46875,24.3125 c -1.6395929,0.0966 -3.3798805,1.83194 -6.34375,6.09375 -5.9949892,7.93715 -14.595317,26.52565 -18.03125,36.21875 -5.152605,20.33505 -6.842535,45.06395 -5.125,68.9375 0.841522,7.92825 2.532316,25.58259 5.125,39.71875 4.277456,33.60207 5.15625,47.73889 5.15625,61.875 -0.876011,22.96895 -6.848809,41.50368 -16.3125,53.875 -1.718393,1.76478 -2.5625,3.53295 -2.5625,4.4375 0,0.90455 0.844107,2.67273 2.5625,4.4375 9.463691,12.37132 15.436489,30.89127 16.3125,53 0,14.99638 -0.878794,29.11498 -5.15625,61.8125 -2.592684,15.0407 -4.283478,32.71323 -5.125,39.78125 -1.717535,24.73379 -0.02761,49.47575 5.125,68.90625 4.277456,15.90088 19.751417,43.3125 24.0625,43.3125 1.717534,0 3.4375,-1.78887 3.4375,-3.5625 0,-0.89571 -1.719966,-3.51811 -3.4375,-6.1875 -10.30607232,-14.99633 -14.6262161,-30.03104 -16.34375,-53 0,-14.13615 0.8787945,-27.40216 5.15625,-60.96875 C 0.24878379,623.98719 1.968604,608.08279 2.84375,601.875 6.2796825,559.4755 -0.57292742,523.24857 -17.75,496.75 c -2.593549,-3.53846 -4.3125,-7.0625 -4.3125,-7.0625 0,0 1.718951,-3.55525 4.3125,-7.09375 C -0.57292742,456.09522 6.2796825,419.86657 2.84375,376.5625 1.968604,371.25926 0.24878379,355.37724 -1.46875,341.25 -5.7462055,308.5791 -6.625,295.29239 -6.625,281.15625 c 1.7175339,-22.96897 6.03767768,-38.00367 16.34375,-53 3.435068,-5.30329 4.311289,-7.04771 2.59375,-8.8125 -0.810483,-0.55428 -1.535981,-0.85639 -2.28125,-0.8125 z m 18.53125,6.84375 62.53125,0 c 0.185433,4.79759 0.715724,9.50064 1.65625,14.09375 1.171571,5.72308 2.530495,11.55345 4.0625,17.5 -1.036378,0.89146 -2.054373,1.7781 -3.0625,2.6875 l -65.1875,0 0,-34.28125 z m 69.78125,0 22.875,0 c -0.22264,0.53079 -0.44989,1.04686 -0.6875,1.59375 -1.48579,3.42532 -3.22347,6.77365 -5.25,10.0625 -2.02824,3.28886 -4.23683,6.36713 -6.625,9.25 -2.38817,2.88456 -4.98811,5.05686 -7.78125,6.5 -1.532009,-4.14518 -2.500775,-8.34505 -2.90625,-12.625 -0.405475,-4.28164 -0.353245,-8.76638 0.1875,-13.40625 0.05399,-0.46356 0.124073,-0.91461 0.1875,-1.375 z m -69.78125,41.15625 58.03125,0 c -4.350941,4.41827 -8.412058,9.00956 -12.15625,13.8125 -4.950221,6.34998 -9.40235,13.1877 -13.34375,20.46875 l -32.53125,0 0,-34.28125 z m 72.59375,16.125 3.78125,18.15625 -22.28125,0 c 1.719733,-2.02303 3.503401,-4.00744 5.375,-5.9375 4.325487,-4.46076 8.709272,-8.52391 13.125,-12.21875 z m -72.59375,25 29.03125,0 c -0.04438,0.0925 -0.08077,0.18862 -0.125,0.28125 -2.523273,6.39859 -3.78125,13.23198 -3.78125,20.53125 l 0,7.78125 c 0,1.60376 0.303013,3.50506 0.875,5.6875 l -26,0 0,-34.28125 z m 48.71875,0 27.53125,0 c -0.83838,0.59523 -1.79903,1.28269 -2.3125,1.625 -0.81111,0.54075 -1.64384,1.11884 -2.5,1.75 -0.855981,0.63116 -1.382366,1.03792 -1.5625,1.21875 -3.334404,2.43251 -6.223214,5.32305 -8.65625,8.65625 -1.982523,3.1541 -3.529886,6.621 -4.65625,10.40625 -1.020964,3.43054 -1.419142,6.97308 -1.21875,10.625 l -19.25,0 c 0.03861,-6.00445 1.077967,-11.74819 3.15625,-17.1875 2.117796,-5.54226 4.954386,-10.79284 8.46875,-15.75 0.324326,-0.4573 0.668768,-0.89064 1,-1.34375 z m 37.78125,17.4375 c 6.84893,0 12.52614,2.34532 17.03125,7.03125 2.87538,2.98965 5.0893,6.25391 6.625,9.8125 l -20.1875,0 -3.46875,-16.84375 z m -4.71875,0.53125 c 1.00876,5.19067 2.14147,10.96497 3.1875,16.3125 l -18.9375,0 c 0.854506,-3.20579 2.433543,-6.21292 4.78125,-9 2.88354,-3.42532 6.55233,-5.87108 10.96875,-7.3125 z m -81.78125,23.1875 28.34375,0 c 0.687702,1.69177 1.497945,3.49128 2.40625,5.40625 3.739882,7.88608 8.702091,14.61569 14.875,20.15625 4.055363,3.64105 8.514672,6.53593 13.40625,8.71875 l -59.03125,0 0,-34.28125 z m 36.65625,0 19.75,0 c 1.514977,5.55041 4.601362,10.25805 9.28125,14.125 3.334217,2.79245 7.20859,4.66182 11.625,5.5625 1.0798,0 1.48826,-0.47432 1.21875,-1.375 -0.27123,-0.90068 -0.94975,-1.34375 -2.03125,-1.34375 -4.5957,-2.43423 -7.739131,-5.62767 -9.40625,-9.59375 -1.025106,-2.43768 -1.624971,-4.90288 -1.78125,-7.375 l 21.03125,0 c 1.80824,9.22044 3.5223,18.10578 5.4375,27.78125 l 0.8125,3.78125 c 0,0.35993 -0.69838,0.71567 -2.09375,1.03125 -1.39708,0.31558 -2.92544,0.60547 -4.59375,0.875 -1.66661,0.27122 -3.26251,0.50839 -4.75,0.6875 -0.74374,0.0904 -0.83335,0.0798 -1.25,0.125 l -4.4375,0 c -4.229747,-0.33943 -8.419227,-1.33854 -12.5625,-3.03125 -5.181645,-2.11865 -9.753705,-5.05516 -13.71875,-8.75 -3.965045,-3.69313 -7.143249,-8.02973 -9.53125,-13.03125 -1.446554,-3.0295 -2.429697,-6.19141 -3,-9.46875 z m 54.75,0 20.8125,0 c 1.08264,5.90047 0.53143,11.70745 -1.65625,17.4375 -2.25341,5.9022 -6.57016,10.06577 -12.96875,12.5 l -6.1875,-29.9375 z" />
//             <g transform="matrix(1.7967812,0,0,1.7967812,-68.612364,500.57522)" id="g2992" >
//                 <path d="m 62.511677,127.84048 c 0,-0.83977 4.041963,-4.29526 8.982141,-7.67885 10.621365,-7.27471 18.291956,-15.2339 22.753427,-23.609504 10.231245,-19.207279 6.990215,-39.234197 -6.645392,-41.063116 -7.541825,-1.01157 -17.090176,4.491435 -17.090176,9.84959 0,1.98778 0.508501,2.147884 6.037438,1.900912 6.764925,-0.302182 11.341654,6.282702 7.680759,11.050886 -5.784567,7.53419 -19.718197,3.205925 -19.718197,-6.12515 0,-8.178104 4.976735,-14.686661 13.736031,-17.963933 18.744999,-7.013402 36.588252,5.915889 35.025872,25.379878 -1.28058,15.953347 -15.170703,30.852697 -42.135847,45.197347 -6.39814,3.40362 -8.626056,4.19445 -8.626056,3.06194 z" />
//                 <path d="m 135,65.625 c 0,3.796958 -2.93813,6.875 -6.5625,6.875 -3.62437,0 -6.5625,-3.078042 -6.5625,-6.875 0,-3.796958 2.93813,-6.875 6.5625,-6.875 3.62437,0 6.5625,3.078042 6.5625,6.875 z" transform="matrix(0.8552381,0,0,0.8552381,13.155357,9.9952378)" />
//                 <path d="m 135,65.625 c 0,3.796958 -2.93813,6.875 -6.5625,6.875 -3.62437,0 -6.5625,-3.078042 -6.5625,-6.875 0,-3.796958 2.93813,-6.875 6.5625,-6.875 3.62437,0 6.5625,3.078042 6.5625,6.875 z" transform="matrix(0.8552381,0,0,0.8552381,13.542857,29.875)" />
//             </g>
//         </g>
//     </svg>;
// }

const RehearsalMarksSpecimen = () => {
    return <div style={{ paddingLeft: "80px" }}>
        <div className="rehearsal-mark">A</div>
        <div className="rehearsal-mark">B</div>
        <div className="rehearsal-mark">C</div>
        <div className="rehearsal-mark">D</div>
        <div className="rehearsal-mark">E</div>
        <div className="rehearsal-mark">G</div>
        <div className="rehearsal-mark">H</div>
        <div className="rehearsal-mark">I</div>
        <div className="rehearsal-mark">K</div>
    </div>
};


interface SpecimenOneLinerRehearsalMarksProps {
    //specimen: SpecimenSection;
    font: FontSpec;
    fontSize: number,
    fontWeight: number,
    showFontName: boolean;
};

const SpecimenOneLinerRehearsalMarks = (props: SpecimenOneLinerRehearsalMarksProps) => {
    const style: CSSProperties = {
        fontFamily: props.font.fontFamily,
        //fontSize: props.font.sizeScale * props.fontSize * props.specimen.sizeScale,
        //fontWeight: props.fontWeight * props.font.weightScale * props.specimen.weightScale,
        //marginTop: props.specimen.marginTop,
        //marginBottom: props.specimen.marginBottom,
    };

    return <div className="SpecimenOneLiner" style={style}>
        <span className="SpecimenOneLinerText">
            <RehearsalMarksSpecimen />
        </span>
        {props.showFontName && <span className="SpecimenOneLinerFontName">{props.font.fontFamily}</span>}
    </div>;
};





type SpecimenCardProps = {
    font: FontSpec,
    fontSize: number,
    fontWeight: number,
    specimens: SpecimenSection[];
    showRehearsalMarks: boolean;
    showChords: boolean;
    showNotation: boolean;
    showFontName: boolean;
};

export const SpecimenCard = (props: SpecimenCardProps) => {

    const notation = props.showChords ? `
X:1
M:4/4
K:C
"Gb7"CD | "Dsus"GA"F7alt"Bc | "Em9"de"A13"fg | "B#9"CD "C11"EF |
`: `
X:1
M:4/4
K:C
CD | GABc | defg | ab |
` ;

    return <div className="specimenCard" style={{ fontFamily: props.font.fontFamily }}>
        {props.showFontName && <div className="specimenCardFontName">{props.font.fontFamily}</div>}
        {props.specimens.filter(s => s.enabled).map((specimen, i) => <SpecimenCardSection key={i} font={props.font} fontSize={props.fontSize} fontWeight={props.fontWeight} specimen={specimen} />)}

        {props.showRehearsalMarks && <RehearsalMarksSpecimen />}

        {(props.showNotation || props.showChords) &&
            <ABCJSWrapper abcNotation={notation} options={{
                format: {
                    annotationfont: props.font.fontFamily,
                    wordsfont: props.font.fontFamily,
                    composerfont: props.font.fontFamily,
                    footerfont: props.font.fontFamily,
                    gchordfont: props.font.fontFamily,
                    headerfont: props.font.fontFamily,
                    historyfont: props.font.fontFamily,
                    infofont: props.font.fontFamily,
                    measurefont: props.font.fontFamily,
                    partsfont: props.font.fontFamily,
                    repeatfont: props.font.fontFamily,
                    subtitlefont: props.font.fontFamily,
                    tabgracefont: props.font.fontFamily,
                    tablabelfont: props.font.fontFamily,
                    tabnumberfont: props.font.fontFamily,
                    tempofont: props.font.fontFamily,
                    textfont: props.font.fontFamily,
                    titlefont: props.font.fontFamily,
                    tripletfont: props.font.fontFamily,
                    vocalfont: props.font.fontFamily,
                    voicefont: props.font.fontFamily,
                    scale: 1.5,
                }
            }} />}

    </div>;
};

interface OneLinerSpecimenProps {
    fonts: FontSpec[];
    specimen: SpecimenSection;
    fontSize: number;
    fontWeight: number;
    fontsListChanged: (x: FontSpec[]) => void;
    showFontNames: boolean;
}

const OneLinerSpecimen = ({ fonts, specimen, fontSize, fontWeight, fontsListChanged, showFontNames }: OneLinerSpecimenProps) => {

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        // removedIndex is the previous index; the original item to be moved
        // addedIndex is the new index where it should be moved to.
        if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
        const newItems = moveItemInArray(fonts, args.removedIndex, args.addedIndex).map((item, index) => ({ ...item, sortOrder: index }));
        fontsListChanged(newItems);
    };

    return <div className="SpecimenOneLinerContainer">
        <ReactSmoothDndContainer
            dragHandleSelector=".dragHandle"
            lockAxis="y"
            onDrop={onDrop}
        >
            {fonts.filter(x => x.enabled).map((font, fontIndex) =>
                <ReactSmoothDndDraggable key={fontIndex}>
                    <SpecimenOneLiner key={fontIndex} specimen={specimen} font={font} fontSize={fontSize} fontWeight={fontWeight} showFontName={showFontNames} />
                </ReactSmoothDndDraggable>)}
        </ReactSmoothDndContainer>
    </div>

};


export const TypefaceComparisonTool = () => {

    const [specimens, setSpecimens] = useState<SpecimenSection[]>([]);
    const [fontSize, setFontSize] = useState<number>(20);
    const [fontWeight, setFontWeight] = useState<number>(400);
    const [fonts, setFonts] = useState<FontSpec[]>([]);
    const [showCards, setShowCards] = useState<boolean>(true);
    const [showOneLiners, setShowOneLiners] = useState<boolean>(true);
    const [showRehearsalMarks, setShowRehearsalMarks] = useState<boolean>(true);
    const [showNotation, setShowNotation] = useState<boolean>(true);
    const [showChords, setShowChords] = useState<boolean>(true);
    const [showFontConfig, setShowFontConfig] = useState<boolean>(false);
    const [showSpecimenConfig, setShowSpecimenConfig] = useState<boolean>(false);
    const [globalNotes, setGlobalNotes] = useState<string>("");
    const [showingGlobalNotesEditor, setShowingGlobalNotesEditor] = useState<boolean>(false);
    const [showFontNames, setShowFontNames] = useState<boolean>(true);

    const importConfig = (obj: any) => {
        const newSpecimens = obj.specimens;
        const newFontSize = obj.fontSize;
        const newFontWeight = obj.fontWeight;
        const newFonts = obj.fonts;
        setShowCards(!!obj.showCards);
        setShowOneLiners(!!obj.showOneLiners);
        setSpecimens(newSpecimens);
        setFontSize(newFontSize);
        setFontWeight(newFontWeight);
        setFonts(newFonts);
        setShowRehearsalMarks(!!obj.showRehearsalMarks);
        setShowNotation(!!obj.showNotation);
        setShowChords(!!obj.showChords);
        setGlobalNotes(obj.globalNotes || "");
        setShowFontConfig(!!obj.showFontConfig);
        setShowSpecimenConfig(!!obj.showSpecimenConfig);
        setShowFontNames(!!obj.showFontNames);
    };

    const exportConfig = () => ({
        specimens,
        fontSize,
        fontWeight,
        fonts,
        showCards,
        showOneLiners,
        showNotation,
        showRehearsalMarks,
        showChords,
        globalNotes,
        showFontConfig,
        showSpecimenConfig,
        showFontNames,
    });

    useEffect(() => {
        importConfig(gDefaultTypefaceCompareConfig);
    }, []);

    return <div>

        <div>
            {showingGlobalNotesEditor && <MarkdownEditor initialValue={globalNotes} onCancel={() => setShowingGlobalNotesEditor(false)} onSave={(x) => {
                setGlobalNotes(x);
                setShowingGlobalNotesEditor(false);
            }} />}
            {!showingGlobalNotesEditor && <button onClick={() => setShowingGlobalNotesEditor(true)}>Edit global notes</button>}
        </div>
        <div><Markdown markdown={globalNotes} /></div>

        <button onClick={async () => {
            const text = JSON.stringify(exportConfig(), null, 3);
            await navigator.clipboard.writeText(text);
        }}>Copy config to clipboard</button>
        <button onClick={async () => {
            const text = await navigator.clipboard.readText();
            const obj = JSON.parse(text);
            importConfig(obj);
        }}>Paste config from clipboard</button>


        <div className="globalContainer">
            <div><input type="range" step={1} min={8} max={60} value={fontSize} onChange={e => setFontSize(e.target.valueAsNumber)} />size abs:{fontSize}</div>
            <div><input type="range" step={10} min={100} max={900} value={fontWeight} onChange={e => setFontWeight(e.target.valueAsNumber)} />weight abs:{fontWeight}</div>
            <div>
                <ToggleButton value={showCards} onChange={v => setShowCards(v)}>Show cards?</ToggleButton>
                <ToggleButton value={showRehearsalMarks} onChange={v => setShowRehearsalMarks(v)}>Show rehearsal marks</ToggleButton>
                <ToggleButton value={showNotation} onChange={v => setShowNotation(v)}>Show notation?</ToggleButton>
                <ToggleButton value={showChords} onChange={v => setShowChords(v)}>Show chords?</ToggleButton>

                <span>--</span>

                <ToggleButton value={showOneLiners} onChange={v => setShowOneLiners(v)}>Show one-liners?</ToggleButton>

                <span>--</span>

                <ToggleButton value={showFontConfig} onChange={v => setShowFontConfig(v)}>Show font config</ToggleButton>
                <ToggleButton value={showSpecimenConfig} onChange={v => setShowSpecimenConfig(v)}>Show specimen config</ToggleButton>

                <span>--</span>

                <ToggleButton value={showFontNames} onChange={v => setShowFontNames(v)}>Show font names</ToggleButton>
            </div>

        </div>


        {showFontConfig &&
            <div className="fontConfigContainer">
                <div style={{ display: "inline-flex", flexWrap: "wrap" }}>
                    {fonts.map((font, i) => <FontConfig key={i} value={font} onChanged={x => {
                        const newFonts = [...fonts];
                        newFonts[i] = x;
                        setFonts(newFonts);
                    }}
                    />)}
                </div>

                <button onClick={() => setFonts([{
                    sizeScale: 1,
                    weightScale: 1,
                    fontFamily: "",
                    enabled: true,
                    notes: "",
                    tags: "",
                }, ...fonts])}>+ Add font</button>
            </div>
        }

        {showSpecimenConfig &&
            <div className="specimenConfigContainer">
                <div style={{ display: "inline-flex", flexWrap: "wrap" }}>
                    {specimens.map((specimen, i) => <SpecimenControl key={i} value={specimen} onChanged={x => {
                        const newSpecimens = [...specimens];
                        newSpecimens[i] = x;
                        setSpecimens(newSpecimens);
                    }} />)}
                </div>
                <button onClick={() => setSpecimens([...specimens, {
                    sizeScale: 1,
                    text: "new specimen",
                    weightScale: 1,
                    marginBottom: 0,
                    marginTop: 0,
                    enabled: true,
                }])}>+ Add specimen</button>
            </div>
        }

        {showCards &&
            <div style={{ display: "inline-flex", flexWrap: "wrap" }}>
                {fonts.filter(x => x.enabled).map((font, i) => <SpecimenCard
                    font={font}
                    fontSize={fontSize}
                    fontWeight={fontWeight}
                    specimens={specimens}
                    showNotation={showNotation}
                    showRehearsalMarks={showRehearsalMarks}
                    showChords={showChords}
                    showFontName={showFontNames}
                />)}
            </div>
        }


        {showOneLiners &&
            <div>
                {specimens.filter(s => s.enabled).map((specimen, specimenIndex) => <OneLinerSpecimen
                    key={specimenIndex}
                    fontSize={fontSize}
                    fontWeight={fontWeight}
                    fonts={fonts}
                    specimen={specimen}
                    fontsListChanged={x => setFonts(x)}
                    showFontNames={showFontNames}
                />)}
            </div>
        }
        {showOneLiners && showRehearsalMarks && <div className="SpecimenOneLinerContainer">
            {fonts.filter(x => x.enabled).map((font, fontIndex) => <SpecimenOneLinerRehearsalMarks key={fontIndex} font={font} fontSize={fontSize} fontWeight={fontWeight} showFontName={showFontNames} />)}
        </div>}


    </div>;
};
