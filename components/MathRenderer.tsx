import React, { useEffect, useRef, useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
  text: string;
  className?: string;
}

function renderLatexString(latex: string): string {
  let html = latex;
  html = html.replace(/\$\$([^$]+)\$\$/g, (_, math: string) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false, strict: false });
    } catch {
      return `<span class="text-red-400">${math}</span>`;
    }
  });
  html = html.replace(/(?<!\$)\$(?!\$)([^$]+?)\$(?!\$)/g, (_, math: string) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, strict: false });
    } catch {
      return `<span class="text-red-400">${math}</span>`;
    }
  });
  return html;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ text, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => {
    if (!text) return '';
    let processed = text
      .replace(/\n/g, '<br/>')
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    processed = renderLatexString(processed);
    return processed;
  }, [text]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = html;
    }
  }, [html]);

  return <div ref={containerRef} className={`text-neutral-200 leading-relaxed ${className || ''}`} />;
};

export function autoFormatMath(text: string): string {
  if (!text) return '';
  if (text.includes('$') || text.includes('\\[') || text.includes('\\(')) return text;

  let formatted = text;
  formatted = formatted.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');
  formatted = formatted.replace(/\btheta\b/g, '\\theta');
  formatted = formatted.replace(/\bpi\b/g, '\\pi');
  formatted = formatted.replace(/\bphi\b/g, '\\phi');
  formatted = formatted.replace(/\balpha\b/g, '\\alpha');
  formatted = formatted.replace(/\bbeta\b/g, '\\beta');

  formatted = formatted.replace(/([a-zA-Z0-9_'()]+(?:\s*[-+*=<>^/]\s*[a-zA-Z0-9_'()]+)+)/g, (match) => {
    if (/^[a-zA-Z]{3,}$/.test(match.trim())) return match;
    let m = match
      .replace(/\^([a-zA-Z0-9\-+*]+)/g, '^{$1}')
      .replace(/\*+/g, ' \\cdot ')
      .replace(/\s*\/\s*/g, ' / ');
    return `$${m}$`;
  });

  return formatted;
}
