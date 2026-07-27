import { forwardRef, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  MdDelete,
  MdSave,
  MdDragIndicator,
  MdChevronRight,
} from 'react-icons/md';

const field =
  'w-full bg-body-main/40 border border-secondary-main/50 rounded-md px-3 py-2 text-sm outline-none focus:border-onPrimary-main transition-all duration-300';

const Field = forwardRef(({ label, value, onChange, placeholder, className = '' }, ref) => (
  <label className={`grid gap-1.5 ${className}`}>
    <span className='text-secondary-light text-[11px] uppercase text-montreal-mono'>
      {label}
    </span>
    <input
      ref={ref}
      className={field}
      placeholder={placeholder}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  </label>
));

Field.displayName = 'Field';
Field.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  className: PropTypes.string,
};

/**
 * One About entry: collapsed to a single row by default, expanded on click.
 *
 * Collapsed is the default because the common case is looking at the list, not
 * editing one of them. Four expanded records filled a screen and made finding
 * the third one a scrolling exercise.
 *
 * The drag handle only appears while collapsed. Dragging a record whose text
 * fields are open means every pointer movement is ambiguous: is this a drag, or
 * a text selection? Collapsing first removes the question.
 *
 * An entry with unsaved changes refuses to collapse, so edits cannot be hidden
 * behind a closed row and forgotten.
 */
const EntryRow = ({
  entry,
  section,
  position,
  isNew,
  onSave,
  onDelete,
  busy,
  isDragging: isOverlay = false,
}) => {
  const [draft, setDraft] = useState(entry);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(Boolean(isNew));
  const firstFieldRef = useRef(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id, disabled: expanded });

  useEffect(() => {
    setDraft(entry);
    setDirty(false);
  }, [entry]);

  useEffect(() => {
    if (!isNew) return;
    setExpanded(true);
    // Scroll and focus after the expand has painted, otherwise the browser
    // measures the collapsed height and scrolls to the wrong place.
    const id = setTimeout(() => {
      firstFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstFieldRef.current?.focus();
      firstFieldRef.current?.select();
    }, 60);
    return () => clearTimeout(id);
  }, [isNew]);

  // An entry with unsaved edits stays open, so changes cannot be hidden behind
  // a closed row and forgotten.
  const lockedOpen = dirty && expanded;
  const toggle = () => {
    if (lockedOpen) return;
    setExpanded((v) => !v);
  };

  const update = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };

  const summary = [draft.subtitle, draft.period].filter(Boolean).join(' · ');

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border overflow-hidden transition-colors duration-300 ${
        isOverlay
          ? 'border-onPrimary-main shadow-2xl shadow-black/50 bg-primary-dark'
          : isNew
            ? 'border-onPrimary-main ring-1 ring-onPrimary-main/40'
            : dirty
              ? 'border-onPrimary-main/70'
              : 'border-secondary-main/40 hover:border-secondary-main/70'
      }`}
    >
      <div
        onClick={toggle}
        title={lockedOpen ? 'Save or discard your changes first' : undefined}
        className={`flex items-center gap-3 px-3 py-2.5 border-b transition-colors duration-300 ${
          lockedOpen ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${
          dirty
            ? 'bg-onPrimary-main/10 border-onPrimary-main/30'
            : 'bg-body-main/40 border-transparent hover:bg-body-main/60'
        } ${expanded ? 'border-secondary-main/30' : ''}`}
      >
        {/*
          Only draggable while collapsed, and the handle is the only draggable
          surface: dragging from anywhere on the row would fight text selection.
        */}
        <button
          type='button'
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          disabled={expanded || busy}
          title={expanded ? 'Collapse this entry to reorder it' : 'Drag to reorder'}
          className={`shrink-0 p-1 rounded transition-all duration-300 ${
            expanded
              ? 'opacity-20 cursor-not-allowed'
              : 'text-secondary-light hover:text-primary-main cursor-grab active:cursor-grabbing'
          }`}
        >
          <MdDragIndicator />
        </button>

        <div className='flex items-center gap-3 min-w-0 flex-1 text-left'>
          <span className='text-secondary-light text-[11px] text-montreal-mono shrink-0'>
            {String(position).padStart(2, '0')}
          </span>
          <span className='text-sm truncate'>
            {draft.title?.trim() || 'Untitled entry'}
          </span>
          {!expanded && summary && (
            <span className='text-secondary-light text-xs truncate hidden sm:inline'>
              {summary}
            </span>
          )}
        </div>

        {dirty && (
          <span className='text-[11px] uppercase text-montreal-mono text-onPrimary-main shrink-0'>
            unsaved
          </span>
        )}

        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          aria-expanded={expanded}
          className={`shrink-0 p-1 rounded text-secondary-light transition-all duration-300 hover:text-primary-main ${
            lockedOpen ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          {/* Right when closed, rotated down when open: the convention every
              file tree and accordion uses. */}
          <MdChevronRight
            className={`transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`}
          />
        </button>
      </div>

      {/*
        Height animated with a grid row rather than max-height. A max-height
        guess either clips a long entry or leaves the transition running against
        empty space; `grid-template-rows: 0fr -> 1fr` animates the real height.
      */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className='overflow-hidden'>
          <div className='bg-body-main/15 p-5 grid gap-4'>
            <div className='grid gap-4 lg:grid-cols-12'>
              <Field
                ref={firstFieldRef}
                label={section.titleLabel}
                value={draft.title}
                onChange={(v) => update('title', v)}
                className='lg:col-span-4'
              />
              <Field
                label={section.subtitleLabel}
                value={draft.subtitle}
                onChange={(v) => update('subtitle', v)}
                className='lg:col-span-5'
              />
              <Field
                label='Period'
                placeholder={section.periodExample}
                value={draft.period}
                onChange={(v) => update('period', v)}
                className='lg:col-span-3'
              />
              {section.hasLink && (
                <Field
                  label='Link'
                  placeholder='https://'
                  value={draft.link}
                  onChange={(v) => update('link', v)}
                  className='lg:col-span-12'
                />
              )}
            </div>

            <div className='flex items-center justify-between gap-2 pt-2 border-t border-secondary-main/25'>
              <button
                type='button'
                disabled={busy}
                onClick={() => onDelete(entry)}
                className='flex items-center gap-1.5 text-xs px-3 py-2 rounded-md text-secondary-light transition-all duration-300 hover:text-red-400 hover:bg-body-main/40 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed'
              >
                <MdDelete /> Delete
              </button>

              <button
                type='button'
                disabled={!dirty || busy}
                onClick={() => onSave(draft)}
                className='flex items-center gap-2 text-xs px-4 py-2 rounded-md border border-onPrimary-main transition-all duration-300 hover:bg-onPrimary-main hover:text-body-main disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-current cursor-pointer disabled:cursor-not-allowed'
              >
                <MdSave /> {dirty ? 'Save changes' : 'Saved'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

EntryRow.propTypes = {
  entry: PropTypes.object.isRequired,
  section: PropTypes.object.isRequired,
  position: PropTypes.number.isRequired,
  isNew: PropTypes.bool,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  busy: PropTypes.bool,
  isDragging: PropTypes.bool,
};

export default EntryRow;
