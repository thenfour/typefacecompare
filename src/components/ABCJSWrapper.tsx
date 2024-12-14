// ABCJSWrapper.tsx
import React, { useRef, useEffect } from 'react';
import * as abcjs from 'abcjs';
import 'abcjs/abcjs-audio.css';

interface ABCJSWrapperProps {
  abcNotation: string;
  /**
   * AbcParams are abcjs options for parsing ABC notation.
   * See: https://abcjs.net/abcjs-editor.html#parameters
   */
  options?: abcjs.AbcVisualParams;// abcjs.AbcParams;
  /**
   * EngraverParams are engraving-specific options controlling the visual layout.
   * See: https://abcjs.net/abcjs-editor.html#engraver-parameters
   */
  //engraverParams?: any;// abcjs.EngraverParams;
  /**
   * The `renderer` can be 'svg' or 'html'.
   * 'svg' is preferred for a scalable, high-quality output.
   */
  renderer?: 'svg' | 'html';
}

const ABCJSWrapper: React.FC<ABCJSWrapperProps> = ({
  abcNotation,
  options = {},
  //engraverParams = {},
  renderer = 'svg',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && abcNotation) {
      // Clear the container before re-rendering
      containerRef.current.innerHTML = '';

      // Render the ABC notation
      abcjs.renderAbc(
        containerRef.current,
        abcNotation,
        options,
        //engraverParams
      );
    }
  }, [abcNotation, options]);

  return <div ref={containerRef} />;
};

export default ABCJSWrapper;
