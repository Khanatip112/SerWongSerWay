import React, { useRef, useState, useEffect } from 'react';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder,
  className,
  style,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const clean = sanitizeHtml(editorRef.current.innerHTML);
      onChange(clean);
    }
  };

  const execCmd = (cmd: string, val: string | undefined = undefined) => {
    document.execCommand(cmd, false, val);
    handleInput();
  };

  const handleInsertLink = () => {
    const url = prompt('Enter URL (starting with http:// or https://):');
    if (url) {
      const safeUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      execCmd('createLink', safeUrl);
    }
  };

  const handleClearFormat = () => {
    execCmd('removeFormat');
    // Also strip any surrounding anchor tags
    execCmd('unlink');
  };

  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      {/* Rich Text Toolbar (Shown when focused or hovered) */}
      {isFocused && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.25rem 0.5rem',
            backgroundColor: '#ffffff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '6px',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
            position: 'absolute',
            top: '-2.25rem',
            left: '0',
            zIndex: 20,
          }}
          onMouseDown={(e) => e.preventDefault()} // Prevent editor blur when clicking buttons
        >
          <button
            type="button"
            title="Bold"
            onClick={() => execCmd('bold')}
            style={{
              padding: '0.2rem 0.4rem',
              fontWeight: 700,
              fontSize: '0.85rem',
              borderRadius: '4px',
              backgroundColor: 'transparent',
            }}
          >
            B
          </button>
          <button
            type="button"
            title="Italic"
            onClick={() => execCmd('italic')}
            style={{
              padding: '0.2rem 0.4rem',
              fontStyle: 'italic',
              fontSize: '0.85rem',
              borderRadius: '4px',
              backgroundColor: 'transparent',
            }}
          >
            I
          </button>
          <button
            type="button"
            title="Underline"
            onClick={() => execCmd('underline')}
            style={{
              padding: '0.2rem 0.4rem',
              textDecoration: 'underline',
              fontSize: '0.85rem',
              borderRadius: '4px',
              backgroundColor: 'transparent',
            }}
          >
            U
          </button>
          <span style={{ color: 'var(--color-border-subtle)', margin: '0 0.2rem' }}>|</span>
          <button
            type="button"
            title="Insert Link"
            onClick={handleInsertLink}
            style={{
              padding: '0.2rem 0.4rem',
              fontSize: '0.85rem',
              borderRadius: '4px',
              backgroundColor: 'transparent',
            }}
          >
            🔗
          </button>
          <button
            type="button"
            title="Clear Formatting"
            onClick={handleClearFormat}
            style={{
              padding: '0.2rem 0.4rem',
              fontSize: '0.8rem',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: 'var(--color-text-muted)',
            }}
          >
            Tx
          </button>
        </div>
      )}

      {/* Contenteditable Input Area */}
      <div
        ref={editorRef}
        contentEditable
        className={className || 'form-input'}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onInput={handleInput}
        data-placeholder={placeholder}
        style={{
          minHeight: '2.5rem',
          outline: 'none',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          backgroundColor: '#ffffff',
        }}
      />
    </div>
  );
};

export default RichTextEditor;
