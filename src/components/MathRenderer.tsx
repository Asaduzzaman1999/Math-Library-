import katex from 'katex';
import React from 'react';

interface MathRendererProps {
  text: string;
  className?: string;
}

/**
 * Safely splits text containing $$...$$ display math and $...$ inline math,
 * rendering prose as React text nodes and math segments via KaTeX.
 */
export const MathRenderer: React.FC<MathRendererProps> = ({ text, className = '' }) => {
  if (!text) return null;

  const parts: Array<{ type: 'text' | 'display' | 'inline'; content: string }> = [];
  const regex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      parts.push({ type: 'display', content: match[1] });
    } else if (match[2] !== undefined) {
      parts.push({ type: 'inline', content: match[2] });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return (
    <div className={`leading-relaxed whitespace-pre-wrap ${className}`}>
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return <React.Fragment key={idx}>{part.content}</React.Fragment>;
        }
        const html = katex.renderToString(part.content, {
          displayMode: part.type === 'display',
          throwOnError: false,
          strict: false,
        });
        if (part.type === 'display') {
          return (
            <div
              key={idx}
              className="my-2 overflow-x-auto rounded-lg bg-slate-100/80 dark:bg-slate-800/70 px-3 py-2"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return (
          <span
            key={idx}
            className="inline-block align-middle"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
};
