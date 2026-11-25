import React, { useRef, useState } from 'react';

export interface ImageValue {
  url?: string;
  alignment?: 'left' | 'center' | 'right';
  width?: number;
  caption?: string;
}

interface ImageEditorProps {
  value?: ImageValue | null;
  onChange: (value: ImageValue) => void;
  showCaption?: boolean;
}

const MAX_INLINE_BYTES = 2 * 1024 * 1024;

export const ImageEditor: React.FC<ImageEditorProps> = ({ value, onChange, showCaption = true }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const current = value || {};

  const update = (partial: ImageValue) => {
    onChange({ ...current, ...partial });
  };

  const handleFile = (file: File | undefined) => {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_INLINE_BYTES) {
      setError('Image is larger than 2 MB. Use an image URL instead.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update({ url: typeof reader.result === 'string' ? reader.result : '' });
    };
    reader.onerror = () => setError('Could not read that image file.');
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-input"
          style={{ flex: '1 1 220px' }}
          placeholder="Image URL (https://...)"
          value={current.url && !current.url.startsWith('data:') ? current.url : ''}
          onChange={(event) => update({ url: event.target.value })}
        />
        <button type="button" className="btn-pastel" onClick={() => fileRef.current?.click()}>
          Choose file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        {current.url && (
          <button
            type="button"
            className="btn-outline"
            onClick={() => update({ url: '' })}
            title="Remove image"
          >
            Remove
          </button>
        )}
      </div>

      {error && <div style={{ color: 'var(--color-error)', fontSize: '0.8rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Alignment</span>
        {(['left', 'center', 'right'] as const).map((alignment) => (
          <button
            key={alignment}
            type="button"
            className="btn-outline"
            style={{
              padding: '0.25rem 0.6rem',
              fontSize: '0.8rem',
              backgroundColor: (current.alignment || 'center') === alignment ? 'var(--color-brand-pastel)' : 'transparent',
            }}
            onClick={() => update({ alignment })}
          >
            {alignment === 'left' ? 'Left' : alignment === 'right' ? 'Right' : 'Center'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          Width: {current.width || 100}%
        </span>
        <input
          type="range"
          min={25}
          max={100}
          step={5}
          value={current.width || 100}
          onChange={(event) => update({ width: Number(event.target.value) })}
          style={{ flex: 1 }}
        />
      </div>

      {showCaption && (
        <input
          type="text"
          className="form-input"
          placeholder="Caption / alt text (optional)"
          value={current.caption || ''}
          onChange={(event) => update({ caption: event.target.value })}
        />
      )}

      {current.url && (
        <div style={{ textAlign: current.alignment || 'center', padding: '0.5rem', backgroundColor: 'var(--color-bg-page)', borderRadius: '6px' }}>
          <img
            src={current.url}
            alt={current.caption || 'Image preview'}
            style={{ width: `${current.width || 100}%`, maxWidth: '100%', borderRadius: '4px' }}
          />
        </div>
      )}
    </div>
  );
};

export default ImageEditor;
