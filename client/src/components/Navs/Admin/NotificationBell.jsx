import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  MdErrorOutline,
  MdWarningAmber,
  MdInfoOutline,
  MdCheckCircleOutline,
  MdRefresh,
} from 'react-icons/md';
import { reqs } from '../../../axios/requests';
import IconButton from '../../Buttons/IconButton';

/**
 * Alerts about the deployment, from `GET /api/notifications`.
 *
 * Everything shown is derived from real state: configuration that is missing,
 * a referenced file that is not on disk, deliveries that failed. Nothing is
 * invented to fill the panel, so an empty list means there is genuinely nothing
 * to do, and the badge stays trustworthy.
 *
 * Info items are counted but deliberately kept out of the badge. A badge that
 * is never zero is a badge people stop reading.
 */

const SEVERITY = {
  critical: {
    icon: MdErrorOutline,
    label: 'Critical',
    text: 'text-red-400',
    ring: 'border-red-500/40 bg-red-500/5',
    dot: 'bg-red-500',
  },
  warning: {
    icon: MdWarningAmber,
    label: 'Warning',
    text: 'text-orange-300',
    ring: 'border-orange-400/40 bg-orange-400/5',
    dot: 'bg-orange-400',
  },
  info: {
    icon: MdInfoOutline,
    label: 'Info',
    text: 'text-secondary-light',
    ring: 'border-secondary-main/40 bg-body-main/30',
    dot: 'bg-secondary-light',
  },
};

/** Where each alert can be acted on. */
const ACTION_LINKS = {
  resume: { to: '/admin/settings#resume', label: 'Open resume settings' },
  accounts: { to: '/admin/settings#accounts', label: 'Open accounts' },
  projects: { to: '/admin/projects', label: 'Open projects' },
  messaging: { to: '/admin/messaging', label: 'Open Mail & SMS' },
  visits: { to: '/admin', label: 'Open dashboard' },
};

const SEEN_KEY = 'admin.notifications.seen';

/**
 * Ids the administrator has already acknowledged.
 *
 * Alerts are derived from live state, so a condition that is still true keeps
 * appearing in the list. Acknowledging one removes it from the badge without
 * hiding it: the item stays visible and marked read, and if the underlying
 * condition is fixed and later returns, its id reappears unseen and the badge
 * counts it again.
 */
const readSeen = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

const writeSeen = (set) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
  } catch {
    // Private browsing, or storage full. The badge simply stops remembering
    // between reloads, which is not worth an error message.
  }
};

const NotificationBell = () => {
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState(readSeen);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(reqs.GET_NOTIFICATIONS, {
        withCredentials: true,
      });
      const fresh = data.result || [];
      setItems(fresh);

      // Forget acknowledgements for conditions that no longer exist, so the
      // stored set cannot grow without bound and a returning problem is
      // genuinely unread again.
      setSeen((current) => {
        const live = new Set(fresh.map((i) => i.id));
        const pruned = new Set([...current].filter((id) => live.has(id)));
        if (pruned.size !== current.size) writeSeen(pruned);
        return pruned;
      });
    } catch {
      // Signed out, or the API is down. The panel simply has nothing to show;
      // an error toast from a background poll would be noise.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Slow poll. These conditions change on the scale of deploys and config
    // edits, not seconds, and a tight interval would mean a database round trip
    // every few seconds for the life of the tab.
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  // Close on an outside click or Escape, the two things people expect from a
  // popover and notice immediately when missing.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event) => {
      if (
        !panelRef.current?.contains(event.target) &&
        !buttonRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Info never reaches the badge: a badge that is never zero stops being read.
  const badgeable = items.filter((i) => i.severity !== 'info');
  const unreadItems = badgeable.filter((i) => !seen.has(i.id));
  const unread = unreadItems.length;
  const worst = unreadItems.some((i) => i.severity === 'critical')
    ? 'critical'
    : unread > 0
      ? 'warning'
      : null;

  const acknowledge = (id) =>
    setSeen((current) => {
      if (current.has(id)) return current;
      const next = new Set(current).add(id);
      writeSeen(next);
      return next;
    });

  const acknowledgeAll = () =>
    setSeen(() => {
      const next = new Set(badgeable.map((i) => i.id));
      writeSeen(next);
      return next;
    });

  return (
    <div className='relative'>
      {/*
        The existing IconButton, unchanged. Only the badge and the ref wrapper
        are new: the bell already looked right, and restyling it made the header
        inconsistent with every other control up there.
      */}
      <div ref={buttonRef} className='relative'>
        <IconButton
          label={unread > 0 ? `${unread} alerts need attention` : 'Notifications'}
          onClick={() => {
            setOpen((v) => !v);
            if (!open) load();
          }}
        />
        {unread > 0 && (
          <span
            className={`absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-medium grid place-items-center text-body-main pointer-events-none ${SEVERITY[worst]?.dot ?? 'bg-secondary-light'}`}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </div>

      {open && (
        <div
          ref={panelRef}
          className='absolute right-0 top-12 w-[min(92vw,26rem)] max-h-[70vh] overflow-y-auto rounded-xl border border-secondary-main/40 bg-primary-dark shadow-2xl shadow-black/50 z-50'
        >
          <div className='sticky top-0 flex items-center justify-between gap-3 px-5 py-3.5 bg-primary-dark border-b border-secondary-main/30'>
            <div className='flex items-baseline gap-2.5'>
              <h3 className='text-sm'>Needs attention</h3>
              <span className='text-secondary-light text-[11px] text-montreal-mono'>
                {items.length === 0 ? 'all clear' : `${items.length} item${items.length === 1 ? '' : 's'}`}
              </span>
            </div>
            <div className='flex items-center gap-1'>
              {unread > 0 && (
                <button
                  type='button'
                  onClick={acknowledgeAll}
                  className='text-[11px] text-secondary-light px-2 py-1 rounded transition-all duration-300 hover:text-primary-main hover:bg-body-main/50 cursor-pointer'
                >
                  Mark all read
                </button>
              )}
              <button
                type='button'
                onClick={load}
                disabled={loading}
                title='Check again'
                className='p-1.5 rounded-md text-secondary-light transition-all duration-300 hover:text-primary-main hover:bg-body-main/50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed'
              >
                <MdRefresh className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className='grid place-items-center gap-2 px-5 py-10 text-center'>
              <MdCheckCircleOutline className='text-2xl text-green-500' />
              <p className='text-sm'>Nothing needs your attention.</p>
              <p className='text-secondary-light text-xs'>
                Configuration, delivery and content all look healthy.
              </p>
            </div>
          ) : (
            <ul className='divide-y divide-secondary-main/20'>
              {items.map((item, index) => {
                const style = SEVERITY[item.severity] ?? SEVERITY.info;
                const Icon = style.icon;
                const action = ACTION_LINKS[item.action];
                return (
                  <li
                    key={item.id}
                    onClick={() => acknowledge(item.id)}
                    className={`px-5 py-4 grid gap-1.5 transition-all duration-300 ${
                      item.severity === 'info' || seen.has(item.id)
                        ? 'opacity-55'
                        : 'cursor-pointer hover:bg-body-main/30'
                    }`}
                  >
                    <div className='flex items-start gap-3'>
                      <span className='text-secondary-light text-[11px] text-montreal-mono pt-0.5 shrink-0'>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <Icon className={`${style.text} text-base shrink-0 mt-0.5`} />
                      <div className='grid gap-1.5 min-w-0'>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <span className='text-sm'>{item.title}</span>
                          <span
                            className={`text-[10px] uppercase text-montreal-mono px-1.5 py-0.5 rounded border ${style.ring} ${style.text}`}
                          >
                            {style.label}
                          </span>
                        </div>
                        <p className='text-secondary-light text-xs leading-relaxed'>
                          {item.detail}
                        </p>
                        {action && (
                          <Link
                            to={action.to}
                            onClick={() => setOpen(false)}
                            className='text-xs text-primary-main underline underline-offset-4 decoration-secondary-main hover:decoration-primary-main transition-all duration-300 w-fit cursor-pointer'
                          >
                            {action.label}
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
