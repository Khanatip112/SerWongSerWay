import React from 'react';

interface FloatingToolbarProps {
  topOffset: number;
  onAddQuestion: () => void;
  onAddTextBlock: () => void;
  onAddImageBlock: () => void;
  onAddSection: () => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  topOffset,
  onAddQuestion,
  onAddTextBlock,
  onAddImageBlock,
  onAddSection,
}) => {
  return (
    <>
      {/* Desktop Floating Sidebar */}
      <div
        className="floating-toolbar-desktop"
        style={{
          position: 'absolute',
          right: '-46px',
          top: `${Math.max(0, topOffset)}px`,
          transition: 'top 0.2s ease',
          backgroundColor: '#ffffff',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          padding: '0.25rem',
          gap: '0.25rem',
          zIndex: 30,
        }}
      >
        <button
          type="button"
          onClick={onAddQuestion}
          title="Add question (เพิ่มคำถาม)"
          className="toolbar-btn"
          style={{
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            fontSize: '1.25rem',
            color: 'var(--color-text-primary)',
            transition: 'background-color 0.15s ease',
          }}
        >
          ⊕
        </button>
        <button
          type="button"
          onClick={onAddTextBlock}
          title="Add title and description (เพิ่มข้อความ)"
          className="toolbar-btn"
          style={{
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            transition: 'background-color 0.15s ease',
          }}
        >
          Tt
        </button>
        <button
          type="button"
          onClick={onAddImageBlock}
          title="Add image (เพิ่มรูปภาพ)"
          className="toolbar-btn"
          style={{
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            fontSize: '1.1rem',
            color: 'var(--color-text-primary)',
            transition: 'background-color 0.15s ease',
          }}
        >
          🖼
        </button>
        <button
          type="button"
          onClick={onAddSection}
          title="Add section (เพิ่มส่วน)"
          className="toolbar-btn"
          style={{
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            fontSize: '1.1rem',
            color: 'var(--color-text-primary)',
            transition: 'background-color 0.15s ease',
          }}
        >
          ═
        </button>
      </div>

      {/* Mobile Sticky Bottom Bar */}
      <div
        className="floating-toolbar-mobile"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#ffffff',
          borderTop: '1px solid var(--color-border-subtle)',
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.08)',
          display: 'none', // Controlled via CSS media query
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '0.5rem 1rem',
          zIndex: 50,
        }}
      >
        <button
          type="button"
          onClick={onAddQuestion}
          className="btn-pastel"
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}
        >
          ⊕ Question
        </button>
        <button
          type="button"
          onClick={onAddTextBlock}
          className="btn-pastel"
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}
        >
          Tt Text
        </button>
        <button
          type="button"
          onClick={onAddImageBlock}
          className="btn-pastel"
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}
        >
          🖼 Image
        </button>
        <button
          type="button"
          onClick={onAddSection}
          className="btn-pastel"
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}
        >
          ═ Section
        </button>
      </div>
    </>
  );
};

export default FloatingToolbar;
