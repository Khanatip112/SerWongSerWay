import React, { useState } from 'react';
import { Campaign, ContentBlock, Question, Section } from '../types/index.js';
import FormRenderer from './FormRenderer.js';

interface FormPreviewProps {
  campaign: Partial<Campaign> & {
    title: string;
    description: string;
    sections?: Section[];
    questions?: Question[];
    contentBlocks?: ContentBlock[];
  };
  onClose: () => void;
}

/**
 * Preview uses the exact same FormRenderer as the live respondent experience, but is driven
 * by the editor's in-memory draft and never calls the API. Responses stay entirely client-side.
 */
export const FormPreview: React.FC<FormPreviewProps> = ({ campaign, onClose }) => {
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--color-bg-page)',
        zIndex: 100,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--color-brand-pastel)',
          borderBottom: '1px solid var(--color-border-subtle)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          zIndex: 110,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.2rem' }}>👁</span>
          <div>
            <strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>Preview Mode</strong>
            <span style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
              Responses submitted here are simulated and will not be saved.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: '#ffffff',
              borderRadius: '6px',
              border: '1px solid var(--color-border-subtle)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setViewportMode('desktop')}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: viewportMode === 'desktop' ? 'var(--color-brand-hover)' : 'transparent',
              }}
            >
              🖥 Desktop
            </button>
            <button
              type="button"
              onClick={() => setViewportMode('mobile')}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: viewportMode === 'mobile' ? 'var(--color-brand-hover)' : 'transparent',
              }}
            >
              📱 Mobile
            </button>
          </div>

          <button type="button" onClick={onClose} className="btn-primary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem' }}>
            ← Back to Editor
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          width: '100%',
          maxWidth: viewportMode === 'mobile' ? '420px' : '720px',
          margin: '2rem auto',
          padding: '0 1rem',
          transition: 'max-width 0.25s ease',
        }}
      >
        <FormRenderer
          campaign={campaign}
          mode="preview"
          onSubmit={async () => true}
        />
      </div>
    </div>
  );
};

export default FormPreview;
