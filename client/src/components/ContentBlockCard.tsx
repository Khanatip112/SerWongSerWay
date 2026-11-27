import React from 'react';
import { ContentBlock } from '../types/index.js';
import RichTextEditor from './RichTextEditor.js';
import ImageEditor from './ImageEditor.js';

interface ContentBlockCardProps {
  block: ContentBlock;
  index: number;
  totalBlocks: number;
  isActive: boolean;
  onFocus: () => void;
  onChange: (block: ContentBlock) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

export const ContentBlockCard: React.FC<ContentBlockCardProps> = ({
  block,
  index,
  totalBlocks,
  isActive,
  onFocus,
  onChange,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDrop,
}) => {
  const config = block.config || {};
  const updateConfig = (partial: NonNullable<ContentBlock['config']>) => {
    onChange({ ...block, config: { ...config, ...partial } });
  };

  return (
    <div
      className={`card ${isActive ? 'card-active' : ''}`}
      onClick={onFocus}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      style={{ marginBottom: '1rem', position: 'relative' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
          borderBottom: '1px solid var(--color-border-subtle)',
          paddingBottom: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            draggable
            onDragStart={onDragStart}
            title="Drag to reorder block"
            style={{ cursor: 'grab', color: 'var(--color-text-muted)', fontSize: '1.1rem', padding: '0.1rem 0.3rem' }}
          >
            ⋮⋮
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            {block.type === 'TEXT_BLOCK' ? 'Title & description' : 'Image'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          <button type="button" onClick={onMoveUp} disabled={index === 0} title="Move block up" style={{ padding: '0.2rem 0.4rem', color: 'var(--color-text-muted)' }}>
            ▲
          </button>
          <button type="button" onClick={onMoveDown} disabled={index >= totalBlocks - 1} title="Move block down" style={{ padding: '0.2rem 0.4rem', color: 'var(--color-text-muted)' }}>
            ▼
          </button>
          <button type="button" onClick={onDuplicate} title="Duplicate block" style={{ padding: '0.2rem 0.5rem', color: 'var(--color-text-muted)' }}>
            ⧉
          </button>
          <button type="button" onClick={onDelete} title="Delete block" style={{ padding: '0.2rem 0.5rem', color: 'var(--color-text-muted)' }}>
            🗑
          </button>
        </div>
      </div>

      {block.type === 'TEXT_BLOCK' ? (
        <>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>
            Title
          </label>
          <RichTextEditor
            value={block.title || ''}
            onChange={(value) => onChange({ ...block, title: value })}
            placeholder="Title"
          />
          <div style={{ marginTop: '0.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Description
            </label>
            <RichTextEditor
              value={block.description || ''}
              onChange={(value) => onChange({ ...block, description: value })}
              placeholder="Description"
            />
          </div>
        </>
      ) : (
        <>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>
            Title (optional)
          </label>
          <RichTextEditor
            value={block.title || ''}
            onChange={(value) => onChange({ ...block, title: value })}
            placeholder="Image title"
          />
          <div style={{ marginTop: '0.75rem' }}>
            <ImageEditor
              value={{
                url: config.imageUrl,
                alignment: config.alignment,
                width: config.width,
                caption: config.caption,
              }}
              onChange={(value) =>
                updateConfig({
                  imageUrl: value.url,
                  alignment: value.alignment,
                  width: value.width,
                  caption: value.caption,
                })
              }
            />
          </div>
        </>
      )}
    </div>
  );
};

export default ContentBlockCard;
