import React, { useState } from 'react';
import { Question, QuestionType, Section, QuestionOption } from '../types/index.js';
import RichTextEditor from './RichTextEditor.js';
import ImageEditor from './ImageEditor.js';

interface QuestionCardProps {
  question: Question;
  index: number;
  displayIndex?: number;
  totalQuestions: number;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isActive: boolean;
  onFocus: () => void;
  onChange: (updated: Question) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  sections: Section[];
  onDragStart?: (event: React.DragEvent) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  displayIndex,
  totalQuestions,
  canMoveUp,
  canMoveDown,
  isActive,
  onFocus,
  onChange,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  sections,
  onDragStart,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDescription, setShowDescription] = useState(!!question.description);
  const [showImage, setShowImage] = useState(!!question.image?.url);
  const [showValidation, setShowValidation] = useState(
    !!(question.config?.textValidation || question.config?.checkboxValidation)
  );

  const config = question.config || {};

  const updateConfig = (updates: Record<string, unknown>) => {
    onChange({
      ...question,
      config: {
        ...config,
        ...updates,
      },
    });
  };

  const handleTypeChange = (newType: QuestionType) => {
    // Set smart defaults when switching question type
    let newConfig = { ...config };

    if (['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'].includes(newType) && (!config.options || config.options.length === 0)) {
      newConfig = {
        ...newConfig,
        options: [
          { id: 'opt_1', label: 'Option 1' },
          { id: 'opt_2', label: 'Option 2' },
        ],
      };
    } else if (newType === 'LINEAR_SCALE' && !config.linearScale) {
      newConfig = {
        ...newConfig,
        linearScale: { min: 1, max: 5, minLabel: 'Poor', maxLabel: 'Excellent' },
      };
    } else if ((newType === 'RATING' || newType === 'RATING_5') && !config.rating) {
      newConfig = {
        ...newConfig,
        rating: { maxRating: 5, icon: 'STAR' as const },
      };
    } else if (['MULTIPLE_CHOICE_GRID', 'CHECKBOX_GRID'].includes(newType) && !config.grid) {
      newConfig = {
        ...newConfig,
        grid: {
          rows: [{ id: 'row_1', label: 'Row 1' }],
          columns: [
            { id: 'col_1', label: 'Column 1' },
            { id: 'col_2', label: 'Column 2' },
          ],
        },
      };
    }

    onChange({
      ...question,
      type: newType,
      config: newConfig,
    });
  };

  // Option handlers for MULTIPLE_CHOICE, CHECKBOXES, DROPDOWN
  const handleAddOption = () => {
    const currentOptions = config.options || [];
    const nextNum = currentOptions.length + 1;
    updateConfig({
      options: [
        ...currentOptions,
        { id: `opt_${Date.now()}_${nextNum}`, label: `Option ${nextNum}` },
      ],
    });
  };

  const handleUpdateOption = (optIndex: number, field: keyof QuestionOption, val: string) => {
    const currentOptions = [...(config.options || [])];
    currentOptions[optIndex] = {
      ...currentOptions[optIndex],
      [field]: val,
    };
    updateConfig({ options: currentOptions });
  };

  const handleRemoveOption = (optIndex: number) => {
    const currentOptions = (config.options || []).filter((_, i) => i !== optIndex);
    updateConfig({ options: currentOptions });
  };

  // Grid Row / Column handlers
  const handleAddGridRow = () => {
    const grid = config.grid || { rows: [], columns: [] };
    const nextNum = grid.rows.length + 1;
    updateConfig({
      grid: {
        ...grid,
        rows: [...grid.rows, { id: `row_${Date.now()}_${nextNum}`, label: `Row ${nextNum}` }],
      },
    });
  };

  const handleAddGridCol = () => {
    const grid = config.grid || { rows: [], columns: [] };
    const nextNum = grid.columns.length + 1;
    updateConfig({
      grid: {
        ...grid,
        columns: [...grid.columns, { id: `col_${Date.now()}_${nextNum}`, label: `Column ${nextNum}` }],
      },
    });
  };

  return (
    <div
      className={`card ${isActive ? 'card-active' : ''}`}
      onClick={onFocus}
      style={{
        position: 'relative',
        marginBottom: '1rem',
        padding: '1.5rem',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Top Header Bar: Question index & Move Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          borderBottom: '1px solid var(--color-border-subtle)',
          paddingBottom: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            draggable
            onDragStart={(event) => {
              event.stopPropagation();
              onDragStart?.(event);
            }}
            title="Drag to reorder question"
            style={{ cursor: 'grab', color: 'var(--color-text-muted)', fontSize: '1.1rem', padding: '0.1rem 0.3rem' }}
          >
            ⋮⋮
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            Question {(displayIndex ?? index) + 1}
          </span>
          {question.sectionId && (
            <span className="badge" style={{ fontSize: '0.7rem', backgroundColor: '#f4f4f5' }}>
              Section: {sections.find((s) => s.id === question.sectionId)?.title || 'Assigned'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {onMoveUp && (canMoveUp ?? index > 0) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              title="Move question up"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}
            >
              ▲
            </button>
          )}
          {onMoveDown && (canMoveDown ?? index < totalQuestions - 1) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              title="Move question down"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}
            >
              ▼
            </button>
          )}
        </div>
      </div>

      {/* Main Question Header Row: Prompt + Question Type Selector */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ flex: '1 1 320px' }}>
          <label className="form-label">Question Prompt *</label>
          <RichTextEditor
            value={question.prompt}
            onChange={(val) => onChange({ ...question, prompt: val })}
            placeholder="Type your question..."
          />
        </div>

        <div style={{ flex: '0 0 220px' }}>
          <label className="form-label">Question Type</label>
          <select
            className="form-select"
            value={question.type === 'RATING_5' ? 'RATING' : question.type}
            onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
          >
            <option value="SHORT_ANSWER">Short answer (คำตอบสั้นๆ)</option>
            <option value="PARAGRAPH">Paragraph (ย่อหน้า)</option>
            <option value="MULTIPLE_CHOICE">Multiple choice (หลายตัวเลือก)</option>
            <option value="CHECKBOXES">Checkboxes (ช่องทำเครื่องหมาย)</option>
            <option value="DROPDOWN">Dropdown (เลื่อนลง)</option>
            <option value="FILE_UPLOAD">File upload (อัปโหลดไฟล์)</option>
            <option value="LINEAR_SCALE">Linear scale (สเกลเชิงเส้น)</option>
            <option value="RATING">Rating (คะแนน / ดาว)</option>
            <option value="MULTIPLE_CHOICE_GRID">Multiple choice grid (ตารางหลายตัวเลือก)</option>
            <option value="CHECKBOX_GRID">Checkbox grid (ตารางช่องทำเครื่องหมาย)</option>
            <option value="DATE">Date (วันที่)</option>
            <option value="TIME">Time (เวลา)</option>
          </select>
        </div>
      </div>

      {/* Optional Rich Text Description */}
      {showDescription && (
        <div style={{ marginBottom: '1.25rem' }}>
          <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Description (Optional instruction)
          </label>
          <RichTextEditor
            value={question.description || ''}
            onChange={(val) => onChange({ ...question, description: val })}
            placeholder="Help text or context for respondent..."
          />
        </div>
      )}

      {showImage && (
        <div style={{ marginBottom: '1.25rem', padding: '0.75rem', backgroundColor: 'var(--color-bg-page)', borderRadius: '6px' }}>
          <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Question image
          </label>
          <ImageEditor
            value={question.image || {}}
            onChange={(value) =>
              onChange({
                ...question,
                image: value.url
                  ? {
                      url: value.url,
                      alignment: value.alignment || 'center',
                      width: value.width,
                      caption: value.caption,
                    }
                  : null,
              })
            }
          />
        </div>
      )}

      {/* QUESTION TYPE SPECIFIC CONFIGURATION & BUILDER BODY */}
      <div style={{ padding: '0.5rem 0 1rem' }}>
        {/* 1. SHORT ANSWER */}
        {(question.type === 'SHORT_ANSWER' || question.type === 'TEXT') && (
          <div>
            <input
              type="text"
              disabled
              placeholder="Short answer text"
              className="form-input"
              style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed', width: '60%' }}
            />
          </div>
        )}

        {/* 2. PARAGRAPH */}
        {question.type === 'PARAGRAPH' && (
          <div>
            <textarea
              disabled
              rows={2}
              placeholder="Long answer text (paragraph)"
              className="form-textarea"
              style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
            />
          </div>
        )}

        {/* 3. MULTIPLE CHOICE & 5. DROPDOWN */}
        {(question.type === 'MULTIPLE_CHOICE' || question.type === 'DROPDOWN') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(config.options || []).map((opt, optIdx) => (
              <div key={opt.id || optIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>
                  {question.type === 'MULTIPLE_CHOICE' ? '○' : `${optIdx + 1}.`}
                </span>
                <input
                  type="text"
                  value={opt.label}
                  onChange={(e) => handleUpdateOption(optIdx, 'label', e.target.value)}
                  className="form-input"
                  style={{ flex: '1 1 200px' }}
                  placeholder={`Option ${optIdx + 1}`}
                />
                <button
                  type="button"
                  title="Attach option image"
                  onClick={() => {
                    const url = window.prompt('Option image URL', opt.imageUrl || '');
                    if (url !== null) handleUpdateOption(optIdx, 'imageUrl', url.trim());
                  }}
                  style={{ padding: '0.25rem 0.4rem', color: 'var(--color-text-muted)' }}
                >
                  🖼
                </button>
                {opt.imageUrl && (
                  <img src={opt.imageUrl} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 4 }} />
                )}

                {/* Go to section based on answer dropdown */}
                {config.goToSectionBasedOnAnswer && (
                  <select
                    className="form-select"
                    value={opt.targetSectionId || 'NEXT_SECTION'}
                    onChange={(e) => handleUpdateOption(optIdx, 'targetSectionId', e.target.value)}
                    style={{ flex: '0 0 200px', fontSize: '0.85rem' }}
                  >
                    <option value="NEXT_SECTION">Continue to next section</option>
                    {sections.map((sec, sIdx) => (
                      <option key={sec.id} value={sec.id}>
                        Go to section {sIdx + 1} ({sec.title})
                      </option>
                    ))}
                    <option value="SUBMIT_FORM">Submit form</option>
                  </select>
                )}

                {(config.options || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(optIdx)}
                    style={{ color: 'var(--color-error)', padding: '0.25rem 0.5rem' }}
                    title="Remove option"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleAddOption}
                className="btn-pastel"
                style={{ fontSize: '0.85rem' }}
              >
                + Add Option
              </button>
              {question.type === 'MULTIPLE_CHOICE' && !config.hasOtherOption && (
                <button
                  type="button"
                  onClick={() => updateConfig({ hasOtherOption: true })}
                  className="btn-outline"
                  style={{ fontSize: '0.85rem' }}
                >
                  + Add "Other"
                </button>
              )}
              {config.hasOtherOption && (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Includes "Other" response option (
                  <button
                    type="button"
                    onClick={() => updateConfig({ hasOtherOption: false })}
                    style={{ color: 'var(--color-error)' }}
                  >
                    remove
                  </button>
                  )
                </span>
              )}
            </div>
          </div>
        )}

        {/* 4. CHECKBOXES */}
        {question.type === 'CHECKBOXES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(config.options || []).map((opt, optIdx) => (
              <div key={opt.id || optIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem' }}>☐</span>
                <input
                  type="text"
                  value={opt.label}
                  onChange={(e) => handleUpdateOption(optIdx, 'label', e.target.value)}
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder={`Option ${optIdx + 1}`}
                />
                <button
                  type="button"
                  title="Attach option image"
                  onClick={() => {
                    const url = window.prompt('Option image URL', opt.imageUrl || '');
                    if (url !== null) handleUpdateOption(optIdx, 'imageUrl', url.trim());
                  }}
                  style={{ padding: '0.25rem 0.4rem', color: 'var(--color-text-muted)' }}
                >
                  🖼
                </button>
                {opt.imageUrl && (
                  <img src={opt.imageUrl} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 4 }} />
                )}
                {(config.options || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(optIdx)}
                    style={{ color: 'var(--color-error)', padding: '0.25rem 0.5rem' }}
                    title="Remove option"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleAddOption}
                className="btn-pastel"
                style={{ fontSize: '0.85rem' }}
              >
                + Add Option
              </button>
              {!config.hasOtherOption && (
                <button
                  type="button"
                  onClick={() => updateConfig({ hasOtherOption: true })}
                  className="btn-outline"
                  style={{ fontSize: '0.85rem' }}
                >
                  + Add "Other"
                </button>
              )}
              {config.hasOtherOption && (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Includes "Other" response option (
                  <button
                    type="button"
                    onClick={() => updateConfig({ hasOtherOption: false })}
                    style={{ color: 'var(--color-error)' }}
                  >
                    remove
                  </button>
                  )
                </span>
              )}
            </div>
          </div>
        )}

        {/* 6. FILE UPLOAD */}
        {question.type === 'FILE_UPLOAD' && (
          <div style={{ backgroundColor: 'var(--color-bg-page)', padding: '1rem', borderRadius: '6px' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={config.fileUpload?.allowedTypesOnly || false}
                  onChange={(e) =>
                    updateConfig({
                      fileUpload: {
                        ...config.fileUpload,
                        allowedTypesOnly: e.target.checked,
                        allowedTypes: config.fileUpload?.allowedTypes || ['Document', 'PDF', 'Image'],
                      },
                    })
                  }
                />
                Allow only specific file types
              </label>
            </div>

            {config.fileUpload?.allowedTypesOnly && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                {['Document', 'Spreadsheet', 'PDF', 'Video', 'Presentation', 'Drawing', 'Image', 'Audio'].map((type) => {
                  const allowed = config.fileUpload?.allowedTypes || [];
                  const isChecked = allowed.includes(type);
                  return (
                    <label key={type} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...allowed, type]
                            : allowed.filter((t) => t !== type);
                          updateConfig({ fileUpload: { ...config.fileUpload, allowedTypes: updated } });
                        }}
                      />
                      {type}
                    </label>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Maximum number of files</label>
                <select
                  className="form-select"
                  value={config.fileUpload?.maxFiles || 1}
                  onChange={(e) =>
                    updateConfig({ fileUpload: { ...config.fileUpload, maxFiles: Number(e.target.value) } })
                  }
                >
                  <option value={1}>1</option>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Maximum file size</label>
                <select
                  className="form-select"
                  value={config.fileUpload?.maxFileSizeMb || 10}
                  onChange={(e) =>
                    updateConfig({ fileUpload: { ...config.fileUpload, maxFileSizeMb: Number(e.target.value) } })
                  }
                >
                  <option value={1}>1 MB</option>
                  <option value={10}>10 MB</option>
                  <option value={100}>100 MB</option>
                  <option value={1000}>1 GB</option>
                  <option value={10000}>10 GB</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 7. LINEAR SCALE */}
        {question.type === 'LINEAR_SCALE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select
                className="form-select"
                style={{ width: '80px' }}
                value={config.linearScale?.min ?? 1}
                onChange={(e) =>
                  updateConfig({
                    linearScale: { ...config.linearScale, min: Number(e.target.value), max: config.linearScale?.max ?? 5 },
                  })
                }
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
              </select>
              <span>to</span>
              <select
                className="form-select"
                style={{ width: '80px' }}
                value={config.linearScale?.max ?? 5}
                onChange={(e) =>
                  updateConfig({
                    linearScale: { ...config.linearScale, min: config.linearScale?.min ?? 1, max: Number(e.target.value) },
                  })
                }
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Label for min (optional)"
                className="form-input"
                style={{ flex: 1 }}
                value={config.linearScale?.minLabel || ''}
                onChange={(e) =>
                  updateConfig({ linearScale: { ...config.linearScale, min: config.linearScale?.min ?? 1, max: config.linearScale?.max ?? 5, minLabel: e.target.value } })
                }
              />
              <input
                type="text"
                placeholder="Label for max (optional)"
                className="form-input"
                style={{ flex: 1 }}
                value={config.linearScale?.maxLabel || ''}
                onChange={(e) =>
                  updateConfig({ linearScale: { ...config.linearScale, min: config.linearScale?.min ?? 1, max: config.linearScale?.max ?? 5, maxLabel: e.target.value } })
                }
              />
            </div>
          </div>
        )}

        {/* 8. RATING */}
        {(question.type === 'RATING' || question.type === 'RATING_5') && (
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Max Levels</label>
              <select
                className="form-select"
                value={config.rating?.maxRating || 5}
                onChange={(e) =>
                  updateConfig({
                    rating: { maxRating: Number(e.target.value), icon: config.rating?.icon || 'STAR' },
                  })
                }
              >
                {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Icon</label>
              <select
                className="form-select"
                value={config.rating?.icon || 'STAR'}
                onChange={(e) =>
                  updateConfig({
                    rating: { maxRating: config.rating?.maxRating || 5, icon: e.target.value as any },
                  })
                }
              >
                <option value="STAR">★ Star</option>
                <option value="HEART">♥ Heart</option>
                <option value="THUMBS_UP">👍 Thumbs Up</option>
              </select>
            </div>
          </div>
        )}

        {/* 9. MULTIPLE CHOICE GRID & 10. CHECKBOX GRID */}
        {(question.type === 'MULTIPLE_CHOICE_GRID' || question.type === 'CHECKBOX_GRID') && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Rows */}
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Rows</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(config.grid?.rows || []).map((row, rIdx) => (
                  <div key={row.id || rIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{rIdx + 1}.</span>
                    <input
                      type="text"
                      className="form-input"
                      value={row.label}
                      onChange={(e) => {
                        const rows = [...(config.grid?.rows || [])];
                        rows[rIdx] = { ...rows[rIdx], label: e.target.value };
                        updateConfig({ grid: { ...config.grid, columns: config.grid?.columns || [], rows } });
                      }}
                      placeholder={`Row ${rIdx + 1}`}
                    />
                    {(config.grid?.rows || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const rows = (config.grid?.rows || []).filter((_, i) => i !== rIdx);
                          updateConfig({ grid: { ...config.grid, columns: config.grid?.columns || [], rows } });
                        }}
                        style={{ color: 'var(--color-error)' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={handleAddGridRow} className="btn-pastel" style={{ fontSize: '0.8rem', alignSelf: 'flex-start' }}>
                  + Add Row
                </button>
              </div>
            </div>

            {/* Columns */}
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Columns</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(config.grid?.columns || []).map((col, cIdx) => (
                  <div key={col.id || cIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{cIdx + 1}.</span>
                    <input
                      type="text"
                      className="form-input"
                      value={col.label}
                      onChange={(e) => {
                        const columns = [...(config.grid?.columns || [])];
                        columns[cIdx] = { ...columns[cIdx], label: e.target.value };
                        updateConfig({ grid: { ...config.grid, rows: config.grid?.rows || [], columns } });
                      }}
                      placeholder={`Column ${cIdx + 1}`}
                    />
                    {(config.grid?.columns || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const columns = (config.grid?.columns || []).filter((_, i) => i !== cIdx);
                          updateConfig({ grid: { ...config.grid, rows: config.grid?.rows || [], columns } });
                        }}
                        style={{ color: 'var(--color-error)' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={handleAddGridCol} className="btn-pastel" style={{ fontSize: '0.8rem', alignSelf: 'flex-start' }}>
                  + Add Column
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 11. DATE */}
        {question.type === 'DATE' && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            📅 Date input field with day, month, and year selector.
          </div>
        )}

        {/* 12. TIME */}
        {question.type === 'TIME' && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            🕒 Time input field ({config.time?.mode === 'DURATION' ? 'Duration in Hours:Minutes:Seconds' : 'Time of day in HH:MM'}).
          </div>
        )}
      </div>

      {/* RESPONSE VALIDATION SETTINGS ACCORDION */}
      {showValidation && (
        <div
          style={{
            backgroundColor: 'var(--color-bg-page)',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            border: '1px dashed var(--color-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Response Validation</span>
            <button
              type="button"
              onClick={() => {
                setShowValidation(false);
                updateConfig({ textValidation: undefined, checkboxValidation: undefined });
              }}
              style={{ color: 'var(--color-error)', fontSize: '0.8rem' }}
            >
              Remove validation
            </button>
          </div>

          {/* Text/Short Answer/Paragraph Validation */}
          {(['SHORT_ANSWER', 'TEXT', 'PARAGRAPH'].includes(question.type)) && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <select
                className="form-select"
                style={{ flex: '1 1 120px' }}
                value={config.textValidation?.category || (question.type === 'PARAGRAPH' ? 'LENGTH' : 'NUMBER')}
                onChange={(e) => {
                  const cat = e.target.value as any;
                  updateConfig({
                    textValidation: {
                      category: cat,
                      operator: cat === 'NUMBER' ? 'GT' : cat === 'TEXT' ? 'CONTAINS' : cat === 'LENGTH' ? 'MIN_CHAR_COUNT' : 'CONTAINS',
                      value: '',
                    },
                  });
                }}
              >
                {question.type !== 'PARAGRAPH' && <option value="NUMBER">Number</option>}
                {question.type !== 'PARAGRAPH' && <option value="TEXT">Text</option>}
                <option value="LENGTH">Length</option>
                <option value="REGEX">Regular Expression</option>
              </select>

              {/* Operator */}
              <select
                className="form-select"
                style={{ flex: '1 1 140px' }}
                value={config.textValidation?.operator || ''}
                onChange={(e) =>
                  updateConfig({
                    textValidation: {
                      ...config.textValidation,
                      category: config.textValidation?.category || 'NUMBER',
                      operator: e.target.value,
                    },
                  })
                }
              >
                {config.textValidation?.category === 'NUMBER' && (
                  <>
                    <option value="GT">Greater than</option>
                    <option value="GTE">Greater than or equal to</option>
                    <option value="LT">Less than</option>
                    <option value="LTE">Less than or equal to</option>
                    <option value="EQ">Equal to</option>
                    <option value="NEQ">Not equal to</option>
                    <option value="BETWEEN">Between</option>
                    <option value="NOT_BETWEEN">Not between</option>
                    <option value="IS_NUMBER">Is number</option>
                    <option value="WHOLE_NUMBER">Whole number</option>
                  </>
                )}
                {config.textValidation?.category === 'TEXT' && (
                  <>
                    <option value="CONTAINS">Contains</option>
                    <option value="NOT_CONTAINS">Doesn't contain</option>
                    <option value="EMAIL">Email address</option>
                    <option value="URL">URL</option>
                  </>
                )}
                {config.textValidation?.category === 'LENGTH' && (
                  <>
                    <option value="MAX_CHAR_COUNT">Maximum character count</option>
                    <option value="MIN_CHAR_COUNT">Minimum character count</option>
                  </>
                )}
                {config.textValidation?.category === 'REGEX' && (
                  <>
                    <option value="CONTAINS">Contains</option>
                    <option value="NOT_CONTAINS">Doesn't contain</option>
                    <option value="MATCHES">Matches</option>
                    <option value="NOT_MATCHES">Doesn't match</option>
                  </>
                )}
              </select>

              {/* Value Input */}
              {!['IS_NUMBER', 'WHOLE_NUMBER', 'EMAIL', 'URL'].includes(config.textValidation?.operator || '') && (
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: '1 1 100px' }}
                  placeholder="Value"
                  value={String(config.textValidation?.value || '')}
                  onChange={(e) =>
                    updateConfig({
                      textValidation: {
                        ...config.textValidation,
                        category: config.textValidation?.category || 'NUMBER',
                        operator: config.textValidation?.operator || 'GT',
                        value: e.target.value,
                      },
                    })
                  }
                />
              )}

              {/* Second value for BETWEEN */}
              {['BETWEEN', 'NOT_BETWEEN'].includes(config.textValidation?.operator || '') && (
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: '1 1 100px' }}
                  placeholder="Second value"
                  value={String(config.textValidation?.secondValue || '')}
                  onChange={(e) =>
                    updateConfig({
                      textValidation: {
                        ...config.textValidation,
                        category: config.textValidation?.category || 'NUMBER',
                        operator: config.textValidation?.operator || 'BETWEEN',
                        secondValue: e.target.value,
                      },
                    })
                  }
                />
              )}

              {/* Custom Error text */}
              <input
                type="text"
                className="form-input"
                style={{ flex: '1 1 160px' }}
                placeholder="Custom error text"
                value={config.textValidation?.errorText || ''}
                onChange={(e) =>
                  updateConfig({
                    textValidation: {
                      ...config.textValidation,
                      category: config.textValidation?.category || 'NUMBER',
                      operator: config.textValidation?.operator || 'GT',
                      errorText: e.target.value,
                    },
                  })
                }
              />
            </div>
          )}

          {/* Checkboxes Validation */}
          {question.type === 'CHECKBOXES' && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <select
                className="form-select"
                style={{ flex: '1 1 150px' }}
                value={config.checkboxValidation?.type || 'AT_LEAST'}
                onChange={(e) =>
                  updateConfig({
                    checkboxValidation: {
                      type: e.target.value as any,
                      count: config.checkboxValidation?.count || 1,
                    },
                  })
                }
              >
                <option value="AT_LEAST">Select at least</option>
                <option value="AT_MOST">Select at most</option>
                <option value="EXACTLY">Select exactly</option>
              </select>

              <input
                type="number"
                min={1}
                className="form-input"
                style={{ width: '80px' }}
                value={config.checkboxValidation?.count || 1}
                onChange={(e) =>
                  updateConfig({
                    checkboxValidation: {
                      type: config.checkboxValidation?.type || 'AT_LEAST',
                      count: Number(e.target.value),
                    },
                  })
                }
              />

              <input
                type="text"
                className="form-input"
                style={{ flex: '1 1 160px' }}
                placeholder="Custom error text"
                value={config.checkboxValidation?.errorText || ''}
                onChange={(e) =>
                  updateConfig({
                    checkboxValidation: {
                      type: config.checkboxValidation?.type || 'AT_LEAST',
                      count: config.checkboxValidation?.count || 1,
                      errorText: e.target.value,
                    },
                  })
                }
              />
            </div>
          )}
        </div>
      )}

      {/* Card Footer: Duplicate, Delete, Required toggle, More menu */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '1rem',
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: '0.75rem',
          marginTop: '0.5rem',
        }}
      >
        <button
          type="button"
          onClick={onDuplicate}
          title="Duplicate question"
          style={{ fontSize: '1.1rem', color: 'var(--color-text-muted)', padding: '0.25rem' }}
        >
          ⧉
        </button>

        <button
          type="button"
          onClick={onDelete}
          title="Delete question"
          style={{ fontSize: '1.1rem', color: 'var(--color-text-muted)', padding: '0.25rem' }}
        >
          🗑
        </button>

        <button
          type="button"
          onClick={() => setShowImage((visible) => !visible)}
          title="Question image"
          style={{ fontSize: '1.05rem', padding: '0.25rem', color: showImage ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
        >
          🖼
        </button>

        <span style={{ color: 'var(--color-border-subtle)' }}>|</span>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
          <span>Required</span>
          <input
            type="checkbox"
            checked={question.required}
            onChange={(e) => onChange({ ...question, required: e.target.checked })}
          />
        </label>

        {/* More options menu (⋮) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            style={{ fontSize: '1.25rem', padding: '0 0.5rem', color: 'var(--color-text-muted)' }}
            title="More options"
          >
            ⋮
          </button>

          {showMoreMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                bottom: '100%',
                backgroundColor: '#ffffff',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                padding: '0.5rem 0',
                minWidth: '220px',
                zIndex: 30,
              }}
              onMouseLeave={() => setShowMoreMenu(false)}
            >
              {/* Description toggle */}
              <button
                type="button"
                className="menu-item"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onClick={() => {
                  setShowDescription(!showDescription);
                  setShowMoreMenu(false);
                }}
              >
                <span>Description</span>
                {showDescription && <span>✓</span>}
              </button>

              {/* Go to section based on answer (for MULTIPLE_CHOICE / DROPDOWN) */}
              {(question.type === 'MULTIPLE_CHOICE' || question.type === 'DROPDOWN') && (
                <button
                  type="button"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onClick={() => {
                    updateConfig({ goToSectionBasedOnAnswer: !config.goToSectionBasedOnAnswer });
                    setShowMoreMenu(false);
                  }}
                >
                  <span>Go to section based on answer</span>
                  {config.goToSectionBasedOnAnswer && <span>✓</span>}
                </button>
              )}

              {/* Shuffle option order (for options) */}
              {['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'].includes(question.type) && (
                <button
                  type="button"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onClick={() => {
                    updateConfig({ shuffleOptions: !config.shuffleOptions });
                    setShowMoreMenu(false);
                  }}
                >
                  <span>Shuffle option order</span>
                  {config.shuffleOptions && <span>✓</span>}
                </button>
              )}

              {/* Response validation toggle */}
              {['SHORT_ANSWER', 'TEXT', 'PARAGRAPH', 'CHECKBOXES'].includes(question.type) && (
                <button
                  type="button"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onClick={() => {
                    setShowValidation(!showValidation);
                    setShowMoreMenu(false);
                  }}
                >
                  <span>Response validation</span>
                  {showValidation && <span>✓</span>}
                </button>
              )}

              {/* Grid specific menu items */}
              {['MULTIPLE_CHOICE_GRID', 'CHECKBOX_GRID'].includes(question.type) && (
                <>
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onClick={() => {
                      updateConfig({
                        grid: {
                          ...config.grid,
                          rows: config.grid?.rows || [],
                          columns: config.grid?.columns || [],
                          requireEachRow: !config.grid?.requireEachRow,
                        },
                      });
                      setShowMoreMenu(false);
                    }}
                  >
                    <span>Require a response in each row</span>
                    {config.grid?.requireEachRow && <span>✓</span>}
                  </button>

                  <button
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onClick={() => {
                      updateConfig({
                        grid: {
                          ...config.grid,
                          rows: config.grid?.rows || [],
                          columns: config.grid?.columns || [],
                          limitOnePerColumn: !config.grid?.limitOnePerColumn,
                        },
                      });
                      setShowMoreMenu(false);
                    }}
                  >
                    <span>Limit to one response per column</span>
                    {config.grid?.limitOnePerColumn && <span>✓</span>}
                  </button>

                  <button
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onClick={() => {
                      updateConfig({
                        grid: {
                          ...config.grid,
                          rows: config.grid?.rows || [],
                          columns: config.grid?.columns || [],
                          shuffleRows: !config.grid?.shuffleRows,
                        },
                      });
                      setShowMoreMenu(false);
                    }}
                  >
                    <span>Shuffle row order</span>
                    {config.grid?.shuffleRows && <span>✓</span>}
                  </button>
                </>
              )}

              {/* Date menu items */}
              {question.type === 'DATE' && (
                <>
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onClick={() => {
                      updateConfig({ date: { ...config.date, includeTime: !config.date?.includeTime } });
                      setShowMoreMenu(false);
                    }}
                  >
                    <span>Include time</span>
                    {config.date?.includeTime && <span>✓</span>}
                  </button>
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onClick={() => {
                      updateConfig({ date: { ...config.date, includeYear: !(config.date?.includeYear ?? true) } });
                      setShowMoreMenu(false);
                    }}
                  >
                    <span>Include year</span>
                    {(config.date?.includeYear ?? true) && <span>✓</span>}
                  </button>
                </>
              )}

              {/* Time menu items */}
              {question.type === 'TIME' && (
                <>
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onClick={() => {
                      updateConfig({ time: { mode: 'TIME' } });
                      setShowMoreMenu(false);
                    }}
                  >
                    <span>Time of day</span>
                    {config.time?.mode !== 'DURATION' && <span>✓</span>}
                  </button>
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onClick={() => {
                      updateConfig({ time: { mode: 'DURATION' } });
                      setShowMoreMenu(false);
                    }}
                  >
                    <span>Duration</span>
                    {config.time?.mode === 'DURATION' && <span>✓</span>}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionCard;
