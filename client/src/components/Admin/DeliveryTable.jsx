import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { MdDelete, MdDeleteSweep } from 'react-icons/md';
import { reqs } from '../../axios/requests';

/**
 * The delivery log table: fetching, filtering, paging, selection and deletion.
 *
 * Lives on the Mail & SMS page, under the composer, pinned to the channel of
 * the tab in view.
 *
 * It began as two tables reading the same endpoint, one here and one on a
 * separate logs page, which is how you end up with delete on one and not the
 * other. The page went; the props that made them differ stayed, so an unpinned,
 * fully filtered version is still one prop away if it is ever wanted.
 */

const CHANNELS = [
  { value: '', label: 'All channels' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
];

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
];

const selectClass =
  'bg-body-main/40 border border-secondary-main/50 rounded-md px-3 py-2 text-sm outline-none focus:border-onPrimary-main transition-all duration-300';

const cell = 'py-3.5 pr-8';

const DeliveryTable = ({
  title,
  searchTerm = '',
  lockedChannel = null,
  showFilters = true,
  pageSize = 25,
  onChanged,
  setPopup,
}) => {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, matched: 0 });
  const [totals, setTotals] = useState({ all: 0, failed: 0 });
  const [channel, setChannel] = useState(lockedChannel || '');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  // The Mail & SMS page switches tabs, which changes the pinned channel.
  useEffect(() => {
    if (lockedChannel !== null) setChannel(lockedChannel);
  }, [lockedChannel]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(reqs.GET_LOGS, {
        withCredentials: true,
        params: {
          q: searchTerm || undefined,
          channel: channel || undefined,
          status: status || undefined,
          page,
          pageSize,
        },
      });
      setRows(data.result || []);
      setPagination(data.pagination || { page: 1, pages: 1, matched: 0 });
      setTotals(data.totals || { all: 0, failed: 0 });
      // Selection is per page. Holding ids that are no longer on screen would
      // mean a delete removing rows the person cannot see.
      setSelected(new Set());
    } catch (error) {
      setPopup?.({
        text: error.response?.data?.msg || 'Could not load the delivery log',
        type: 'error',
        state: true,
      });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, channel, status, page, pageSize, setPopup]);

  useEffect(() => {
    // Debounced so typing in the shared search box does not fire a request per
    // keystroke against a table that will grow.
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  // A filter change invalidates the page number; staying on page 4 of a result
  // set that now has one page shows an empty table.
  useEffect(() => setPage(1), [searchTerm, channel, status]);

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleRow = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllOnPage = () =>
    setSelected((current) =>
      allOnPageSelected ? new Set() : new Set([...current, ...rows.map((r) => r.id)])
    );

  const runDelete = async (body, confirmation) => {
    if (!window.confirm(confirmation)) return;
    setLoading(true);
    try {
      const { data } = await axios.delete(reqs.GET_LOGS, {
        withCredentials: true,
        data: body,
      });
      setPopup?.({ text: data.msg, type: 'success', state: true });
      await load();
      onChanged?.();
    } catch (error) {
      setPopup?.({
        text: error.response?.data?.msg || 'Could not delete',
        type: 'error',
        state: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const removeSelected = () =>
    runDelete(
      { ids: [...selected] },
      `Delete ${selected.size} entr${selected.size === 1 ? 'y' : 'ies'}?`
    );

  const removeOne = (row) =>
    runDelete(
      { ids: [row.id] },
      `Delete the ${row.channel} entry for ${row.recipient || 'this recipient'}?`
    );

  /** Everything matching the current filter, not only the visible page. */
  const removeAllMatching = () => {
    const scope = [
      channel && `channel ${channel}`,
      status && `status ${status}`,
      searchTerm && `matching "${searchTerm}"`,
    ]
      .filter(Boolean)
      .join(', ');

    if (!scope) {
      setPopup?.({
        text: 'Narrow the list with a channel, a status or a search before clearing it.',
        type: 'error',
        state: true,
      });
      return;
    }

    return runDelete(
      {
        all: true,
        channel: channel || undefined,
        status: status || undefined,
        q: searchTerm || undefined,
      },
      `Delete all ${pagination.matched} entries with ${scope}? This cannot be undone.`
    );
  };

  const canClearMatching =
    (channel || status || searchTerm) && pagination.matched > 0;

  return (
    <div className='box-big-shadow bg-primary-dark rounded-xl p-6 grid gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3 border-b border-secondary-main/30 pb-4'>
        <div className='flex items-baseline gap-3'>
          <h2 className='text-md'>{title}</h2>
          <span className='text-secondary-light text-xs text-montreal-mono'>
            {totals.all} sent
            {totals.failed > 0 && (
              <span className='text-red-400'> · {totals.failed} failed</span>
            )}
          </span>
        </div>

        <div className='flex flex-wrap items-center gap-3'>
          {selected.size > 0 && (
            <button
              type='button'
              onClick={removeSelected}
              disabled={loading}
              className='flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-red-600 transition-all duration-300 hover:bg-red-600 disabled:opacity-40'
            >
              <MdDelete /> Delete {selected.size} selected
            </button>
          )}
          {canClearMatching && (
            <button
              type='button'
              onClick={removeAllMatching}
              disabled={loading}
              title='Deletes every entry matching the current filter, not just this page'
              className='flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-secondary-main/50 text-secondary-light transition-all duration-300 hover:border-red-600 hover:text-red-400 disabled:opacity-40'
            >
              <MdDeleteSweep /> Clear {pagination.matched} matching
            </button>
          )}

          {showFilters && (
            <>
              {/* The channel select is pointless when a tab already pins it. */}
              {!lockedChannel && (
                <select
                  className={selectClass}
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  {CHANNELS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
              <select
                className={selectClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full text-sm border-collapse'>
          <thead>
            <tr className='text-secondary-light text-[11px] uppercase text-montreal-mono'>
              <th className='py-3 pr-4 w-8'>
                <input
                  type='checkbox'
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  disabled={rows.length === 0}
                  title='Select everything on this page'
                  className='accent-onPrimary-main cursor-pointer'
                />
              </th>
              <th className={`text-left font-normal ${cell}`}>When</th>
              {!lockedChannel && (
                <th className={`text-left font-normal ${cell}`}>Channel</th>
              )}
              <th className={`text-left font-normal ${cell}`}>
                {lockedChannel === 'sms' ? 'Number' : 'Recipient'}
              </th>
              <th className={`text-left font-normal ${cell}`}>
                {lockedChannel === 'sms' ? 'Length' : 'Subject'}
              </th>
              <th className={`text-left font-normal ${cell}`}>Status</th>
              <th className={`text-left font-normal ${cell}`}>Detail</th>
              <th className='py-3 w-10' />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className='py-8 text-secondary-light text-center'>
                  {loading ? 'Loading...' : 'Nothing to show.'}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`border-t border-secondary-main/25 align-top transition-colors duration-200 ${
                    selected.has(row.id)
                      ? 'bg-onPrimary-main/10'
                      : // Zebra striping. Rows of similar looking text run
                        // together without it, which is what made this hard to
                        // read at a glance.
                        index % 2 === 1
                        ? 'bg-body-main/20 hover:bg-body-main/40'
                        : 'hover:bg-body-main/30'
                  }`}
                >
                  <td className='py-3.5 pr-4'>
                    <input
                      type='checkbox'
                      checked={selected.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                      className='accent-onPrimary-main cursor-pointer'
                    />
                  </td>
                  <td className={`${cell} whitespace-nowrap text-secondary-light text-xs`}>
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  {!lockedChannel && (
                    <td className={`${cell} uppercase text-xs text-montreal-mono`}>
                      {row.channel}
                    </td>
                  )}
                  <td className={`${cell} break-all`}>{row.recipient || '—'}</td>
                  <td className={`${cell} break-all`}>{row.subject || '—'}</td>
                  <td className={cell}>
                    <span
                      className={`inline-flex items-center gap-1.5 ${
                        row.status === 'succeeded' ? 'text-green-500' : 'text-red-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          row.status === 'succeeded' ? 'bg-green-500' : 'bg-red-400'
                        }`}
                      />
                      {row.status === 'succeeded' ? 'Delivered' : 'Failed'}
                    </span>
                  </td>
                  <td className={`${cell} text-secondary-light break-all`}>
                    {row.detail || row.providerCode || '—'}
                    {row.durationMs != null && (
                      <span className='text-xs'> ({row.durationMs}ms)</span>
                    )}
                  </td>
                  <td className='py-3.5 text-right'>
                    <button
                      type='button'
                      onClick={() => removeOne(row)}
                      disabled={loading}
                      title='Delete this entry'
                      className='p-1.5 rounded text-secondary-light transition-all duration-300 hover:text-red-400 hover:bg-body-main/60 disabled:opacity-30'
                    >
                      <MdDelete />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div className='flex items-center justify-between gap-3 pt-1'>
          <span className='text-secondary-light text-xs text-montreal-mono'>
            Page {pagination.page} of {pagination.pages} · {pagination.matched} matching
          </span>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className='text-sm px-3 py-1.5 rounded-md border border-secondary-main/50 transition-all duration-300 hover:border-onPrimary-main disabled:opacity-40'
            >
              Previous
            </button>
            <button
              type='button'
              disabled={page >= pagination.pages || loading}
              onClick={() => setPage((p) => p + 1)}
              className='text-sm px-3 py-1.5 rounded-md border border-secondary-main/50 transition-all duration-300 hover:border-onPrimary-main disabled:opacity-40'
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

DeliveryTable.propTypes = {
  title: PropTypes.string.isRequired,
  searchTerm: PropTypes.string,
  lockedChannel: PropTypes.string,
  showFilters: PropTypes.bool,
  pageSize: PropTypes.number,
  onChanged: PropTypes.func,
  setPopup: PropTypes.func,
};

export default DeliveryTable;
