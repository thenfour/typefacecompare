import React, { useEffect, useState } from 'react';
import MarkdownIt from 'markdown-it';

interface MarkdownWrapperProps {
  /**
   * The raw Markdown string to render.
   */
  markdown: string;
  /**
   * Optional MarkdownIt configuration options.
   * https://markdown-it.github.io/markdown-it/
   */
  //options?: MarkdownIt.Options;
}

export const Markdown: React.FC<MarkdownWrapperProps> = ({ markdown }) => {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    const md = new MarkdownIt();
    const renderedHtml = md.render(markdown);
    setHtml(renderedHtml);
  }, [markdown]);

  return (
    <div className='renderedMarkdown' dangerouslySetInnerHTML={{ __html: html }} />
  );
};



interface MarkdownEditorProps {
    initialValue: string;
    onSave: (x: string) => void;
    onCancel: () => void;
}

export const MarkdownEditor = (props: MarkdownEditorProps) => {
    const [value, setValue] = useState<string>(props.initialValue);
    return <div className='markdownEditor'>
        <textarea className="globalNotesTextArea" value={value} onChange={e => setValue(e.target.value)}></textarea>
        <Markdown markdown={value} />
        <button onClick={e => props.onSave(value)}>Save</button>
        <button onClick={props.onCancel}>Cancel</button>
    </div>;
};