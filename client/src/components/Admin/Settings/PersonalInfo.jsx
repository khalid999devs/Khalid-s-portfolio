import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { MdAdd } from 'react-icons/md';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { reqs } from '../../../axios/requests';
import EntryRow from './EntryRow';

/**
 * Editor for the About page's employment, education and achievement lists.
 *
 * These were hardcoded arrays in `client/src/Constants/index.js`, so adding a
 * job meant editing source and redeploying the front end. They are rows now.
 *
 * All three sections share one shape because all three render the same four
 * fields; only the labels differ, which is what `SECTIONS` below captures.
 */
const SECTIONS = [
  {
    key: 'experience',
    heading: 'Experience',
    titleLabel: 'Company',
    subtitleLabel: 'Role',
    periodExample: 'Jul 2025 — Jun 2026',
    hasLink: true,
  },
  {
    key: 'achievement',
    heading: 'Achievements',
    titleLabel: 'Award',
    subtitleLabel: 'Awarded by',
    periodExample: '2024',
    hasLink: true,
  },
  {
    key: 'education',
    heading: 'Education',
    titleLabel: 'Degree',
    subtitleLabel: 'Institution',
    periodExample: '2023 — 2027',
    hasLink: false,
  },
];

const PersonalInfo = ({ setPopup, searchTerm = '' }) => {
  const [grouped, setGrouped] = useState({
    experience: [],
    education: [],
    achievement: [],
  });
  const [busy, setBusy] = useState(false);
  const [justAdded, setJustAdded] = useState(null);
  const [dragging, setDragging] = useState(null);

  const report = (text, type) => setPopup({ text, type, state: true });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // A few pixels of travel before a drag begins, so a click on the handle
      // still reads as a click.
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(reqs.GET_ABOUT, { withCredentials: true });
      setGrouped(data.result || { experience: [], education: [], achievement: [] });
    } catch (error) {
      report(error.response?.data?.msg || 'Could not load the about content', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (sectionKey) => {
    setBusy(true);
    try {
      const { data } = await axios.post(
        reqs.ABOUT_ENTRIES,
        { section: sectionKey, title: 'New entry' },
        { withCredentials: true }
      );
      await load();
      // No confirmation toast: the new row appears at the top, expanded,
      // focused and outlined. Saying so in a modal you must dismiss before
      // typing is noise on top of feedback you already have.
      setJustAdded(data?.result?.id ?? null);
    } catch (error) {
      report(error.response?.data?.msg || 'Could not add the entry', 'error');
    } finally {
      setBusy(false);
    }
  };

  const save = async (draft) => {
    setBusy(true);
    try {
      await axios.patch(
        `${reqs.ABOUT_ENTRIES}/${draft.id}`,
        {
          title: draft.title,
          subtitle: draft.subtitle,
          period: draft.period,
          link: draft.link,
        },
        { withCredentials: true }
      );
      await load();
      setJustAdded(null);
      report('Saved', 'success');
    } catch (error) {
      report(error.response?.data?.msg || 'Could not save the entry', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entry) => {
    if (!window.confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await axios.delete(`${reqs.ABOUT_ENTRIES}/${entry.id}`, {
        withCredentials: true,
      });
      await load();
      report('Entry removed', 'success');
    } catch (error) {
      report(error.response?.data?.msg || 'Could not remove the entry', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDragEnd = async (sectionKey, event) => {
    setDragging(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const list = grouped[sectionKey] || [];
    const from = list.findIndex((e) => e.id === active.id);
    const to = list.findIndex((e) => e.id === over.id);
    if (from < 0 || to < 0) return;

    const reordered = arrayMove(list, from, to);
    // Optimistic, so the row stays where it was dropped rather than snapping
    // back while the request is in flight. The `load()` afterwards is what
    // makes it truthful: a rejected reorder reverts.
    setGrouped((g) => ({ ...g, [sectionKey]: reordered }));

    setBusy(true);
    try {
      await axios.patch(
        reqs.REORDER_ABOUT,
        { section: sectionKey, order: reordered.map((e) => e.id) },
        { withCredentials: true }
      );
      await load();
    } catch (error) {
      await load();
      report(error.response?.data?.msg || 'Could not reorder', 'error');
    } finally {
      setBusy(false);
    }
  };

  const matches = (entry) => {
    if (!searchTerm || !searchTerm.trim()) return true;
    const needle = searchTerm.trim().toLowerCase();
    return [entry.title, entry.subtitle, entry.period]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(needle));
  };

  return (
    <div className='col-span-9 w-full grid gap-5'>
      {SECTIONS.map((section) => {
        const all = grouped[section.key] || [];
        const visible = all.filter(matches);
        const isFiltered = visible.length !== all.length;

        return (
          <div
            key={section.key}
            className='box-big-shadow bg-primary-dark rounded-xl p-6 grid gap-5'
          >
            <div className='flex items-center justify-between gap-3 border-b border-secondary-main/30 pb-4'>
              <div className='flex items-baseline gap-3'>
                <h1 className='text-md'>{section.heading}</h1>
                <span className='text-secondary-light text-xs text-montreal-mono'>
                  {all.length} {all.length === 1 ? 'entry' : 'entries'}
                  {isFiltered && ` · ${visible.length} matching`}
                </span>
              </div>
              <button
                type='button'
                disabled={busy}
                onClick={() => add(section.key)}
                className='flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-onPrimary-main transition-all duration-300 hover:bg-onPrimary-main hover:text-body-main disabled:opacity-50'
              >
                <MdAdd /> Add
              </button>
            </div>

            {visible.length === 0 ? (
              <p className='text-secondary-light text-sm'>
                {all.length === 0 ? 'Nothing here yet.' : 'Nothing matches the search.'}
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(e) => setDragging(e.active.id)}
                onDragCancel={() => setDragging(null)}
                onDragEnd={(e) => handleDragEnd(section.key, e)}
              >
                <SortableContext
                  items={visible.map((e) => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className='grid gap-2.5'>
                    {visible.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        section={section}
                        position={all.indexOf(entry) + 1}
                        isNew={entry.id === justAdded}
                        busy={busy}
                        onSave={save}
                        onDelete={remove}
                      />
                    ))}
                  </div>
                </SortableContext>

                {/*
                  The dragged row is rendered above the list so it follows the
                  cursor cleanly, instead of being clipped by the card it came
                  from.
                */}
                <DragOverlay dropAnimation={null}>
                  {dragging ? (
                    <EntryRow
                      entry={all.find((e) => e.id === dragging) || {}}
                      section={section}
                      position={all.findIndex((e) => e.id === dragging) + 1}
                      busy
                      isDragging
                      onSave={() => {}}
                      onDelete={() => {}}
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}

            {isFiltered && (
              <p className='text-secondary-light text-xs'>
                Dropping a row into a filtered list would write positions
                computed from a subset, so clear the search before reordering.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

PersonalInfo.propTypes = {
  setPopup: PropTypes.func.isRequired,
  searchTerm: PropTypes.string,
};

export default PersonalInfo;
