import React, { useState } from 'react';
import { Section, SectionNextAction } from '../types/index.js';
import RichTextEditor from './RichTextEditor.js';

interface SectionCardProps {
  section: Section;
  index: number;
  totalSections: number;
  isActive: boolean;
  onFocus: () => void;
  onChange: (section: Section) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMergeAbove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  section,
  index,
  totalSections,
  isActive,
  onFocus,
  onChange,
  onDuplicate,
  onDelete,
  onMergeAbove,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDrop,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={`card ${isActive ? 'card-active' : ''}`}
      onClick={onFocus}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      style={{
        marginTop: '1.5rem',
        marginBottom: '1rem',
        borderTop: '8px solid var(--color-brand-pastel)',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            draggable
            onDragStart={onDragStart}
            title="Drag to reorder section"
            style={{ cursor: 'grab', color: 'var(--color-text-muted)', fontSize: '1.1rem', padding: '0.1rem 0.3rem' }}
          >
            ⋮⋮
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Section {index + 1} of {totalSections}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button type="button" onClick={onMoveUp} disabled={index === 0} title="Move section up" style={{ padding: '0.2rem 0.4rem', color: 'var(--color-text-muted)' }}>
            ▲
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === totalSections - 1} title="Move section down" style={{ padding: '0.2rem 0.4rem', color: 'var(--color-text-muted)' }}>
            ▼
          </button>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              title="Section options"
              style={{ padding: '0.2rem 0.5rem', fontSize: '1.2rem', color: 'var(--color-text-muted)' }}
            >
              ⋮
            </button>
            {menuOpen && (
              <div
                className="menu-popover"
                onMouseLeave={() => setMenuOpen(false)}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  minWidth: '190px',
                  zIndex: 40,
                  padding: '0.25rem 0',
                }}
              >
                <button type="button" className="menu-item" onClick={() => { setMenuOpen(false); onDuplicate(); }}>
                  Duplicate section
                </button>
                <button
                  type="button"
                  className="menu-item"
                  disabled={index === 0}
                  onClick={() => { setMenuOpen(false); onMergeAbove(); }}
                >
                  Merge with above
                </button>
                <button
                  type="button"
                  className="menu-item menu-item-danger"
                  disabled={totalSections <= 1}
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                >
                  Delete section
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <label className="form-label" style={{ fontSize: '0.8rem' }}>
        Section title
      </label>
      <RichTextEditor
        value={section.title || ''}
        onChange={(value) => onChange({ ...section, title: value })}
        placeholder="Section title"
      />

      <div style={{ marginTop: '0.75rem' }}>
        <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          Section description (optional)
        </label>
        <RichTextEditor
          value={section.description || ''}
          onChange={(value) => onChange({ ...section, description: value })}
          placeholder="Describe this section..."
        />
      </div>
    </div>
  );
};

interface SectionFooterProps {
  section: Section;
  index: number;
  sections: Section[];
  onChange: (section: Section) => void;
}

/** The "After section X" routing footer rendered beneath a section's blocks. */
const stripTags = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

export const SectionFooter: React.FC<SectionFooterProps> = ({ section, index, sections, onChange }) => {
  const otherSections = sections.filter((candidate) => candidate.id !== section.id);

  const handleActionChange = (action: SectionNextAction) => {
    onChange({
      ...section,
      nextAction: action,
      targetSectionId:
        action === 'GO_TO_SECTION'
          ? section.targetSectionId || otherSections[0]?.id || null
          : null,
    });
  };

  return (
    <div
      className="card"
      style={{
        padding: '0.85rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        flexWrap: 'wrap',
        backgroundColor: 'var(--color-bg-page)',
      }}
    >
      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>After section {index + 1}</span>
      <select
        className="form-select"
        style={{ width: 'auto', minWidth: '190px' }}
        value={section.nextAction}
        onChange={(event) => handleActionChange(event.target.value as SectionNextAction)}
      >
        <option value="NEXT_SECTION">Continue to next section</option>
        <option value="GO_TO_SECTION" disabled={otherSections.length === 0}>
          Go to section...
        </option>
        <option value="SUBMIT_FORM">Submit form</option>
      </select>

      {section.nextAction === 'GO_TO_SECTION' && (
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '190px' }}
          value={section.targetSectionId || ''}
          onChange={(event) => onChange({ ...section, targetSectionId: event.target.value || null })}
        >
          <option value="">Choose section...</option>
          {otherSections.map((target, targetIndex) => (
            <option key={target.id} value={target.id}>
              Section {sections.findIndex((s) => s.id === target.id) + 1}:{' '}
              {stripTags(target.title || '') || `Section ${targetIndex + 1}`}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default SectionCard;
