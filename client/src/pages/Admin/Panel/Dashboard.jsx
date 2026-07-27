import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import axios from 'axios';
import PropTypes from 'prop-types';
import {
  MdOutlineLaptopMac,
  MdOutlineImage,
  MdOutlineArticle,
} from 'react-icons/md';
import { reqs } from '../../../axios/requests';
import { DeliveryChart, VisitsChart } from '../../../components/Admin/Charts';

/**
 * Real numbers, from `GET /api/stats`.
 *
 * This page used to be five empty boxes. Everything below is a count or a
 * GROUP BY over data the site already holds, so nothing here is invented or
 * approximated. Charts are hand drawn with SVG rather than pulling in a chart
 * library: two shapes do not justify 40 KiB on a bundle that was carefully cut
 * in half.
 */

const Card = ({ icon: Icon, label, value, hint, to }) => {
  const body = (
    <div className='box-big-shadow bg-primary-dark rounded-xl p-6 h-full grid gap-2 content-start transition-all duration-300 hover:brightness-110'>
      <div className='flex items-center gap-2 text-secondary-light'>
        <Icon className='text-lg' />
        <span className='text-xs uppercase text-montreal-mono'>{label}</span>
      </div>
      <span className='text-4xl text-pp-eiko'>{value}</span>
      {hint && <span className='text-secondary-light text-xs'>{hint}</span>}
    </div>
  );
  return to ? (
    <Link to={to} className='contents'>
      {body}
    </Link>
  ) : (
    body
  );
};

Card.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
  hint: PropTypes.string,
  to: PropTypes.string,
};

/** Two column figures, for where a proportion is not the point. */
const StatTable = ({ heading, columns, rows }) => (
  <div className='grid gap-2 content-start'>
    <span className='text-secondary-light text-xs uppercase text-montreal-mono'>
      {heading}
    </span>
    <table className='w-full text-sm'>
      <thead>
        <tr className='text-secondary-light text-[11px] uppercase text-montreal-mono'>
          <th className='text-left font-normal pb-1'>{columns[0]}</th>
          <th className='text-right font-normal pb-1'>{columns[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className='border-t border-secondary-main/20'>
            <td className='py-1.5 pr-3 break-all'>{label}</td>
            <td className='py-1.5 text-right text-montreal-mono'>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

StatTable.propTypes = {
  heading: PropTypes.string.isRequired,
  columns: PropTypes.array.isRequired,
  rows: PropTypes.array.isRequired,
};

const Bar = ({ label, value, total }) => (
  <div className='grid gap-1'>
    <div className='flex items-center justify-between text-xs'>
      <span className='text-secondary-light'>{label}</span>
      <span className='text-montreal-mono'>{value}</span>
    </div>
    <div className='h-1.5 rounded-full bg-body-main/60 overflow-hidden'>
      <div
        className='h-full bg-onPrimary-main rounded-full transition-all duration-500'
        style={{ width: `${total ? (value / total) * 100 : 0}%` }}
      />
    </div>
  </div>
);

Bar.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
};

const Dashboard = () => {
  const { setPageTitle } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [visits, setVisits] = useState(null);
  const [retentionDraft, setRetentionDraft] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setPageTitle('Dashboard');
  }, [setPageTitle]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(reqs.GET_STATS, { withCredentials: true })
      .then((res) => {
        if (!cancelled && res.data?.succeed) setStats(res.data.result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.msg || 'Could not load dashboard stats');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(reqs.GET_VISIT_STATS, { withCredentials: true })
      .then((res) => {
        if (cancelled || !res.data?.succeed) return;
        setVisits(res.data.result);
        setRetentionDraft(String(res.data.result.retentionDays));
      })
      .catch(() => {
        // The rest of the dashboard is still useful without this panel.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveRetention = async () => {
    try {
      const { data } = await axios.patch(
        reqs.VISIT_RETENTION,
        { days: Number(retentionDraft) },
        { withCredentials: true }
      );
      setVisits((v) => ({ ...v, retentionDays: data.result.retentionDays }));
      const refreshed = await axios.get(reqs.GET_VISIT_STATS, { withCredentials: true });
      if (refreshed.data?.succeed) setVisits(refreshed.data.result);
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not update the retention window');
    }
  };

  if (error) {
    return (
      <div className='box-big-shadow bg-primary-dark rounded-xl p-8'>
        <p className='text-red-400 text-sm'>{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className='pb-20 w-full grid grid-cols-6 gap-5'>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`${
              i === 3 ? 'col-span-4' : 'col-span-2'
            } box-big-shadow bg-primary-dark rounded-xl min-h-[150px] animate-pulse`}
          />
        ))}
      </div>
    );
  }

  const { counts, delivery, series } = stats;
  const media = counts.media.thumbnails + counts.media.slides + counts.media.videos;
  const aboutTotal =
    counts.about.experience + counts.about.education + counts.about.achievement;
  const deliveryTotal =
    delivery.email.succeeded +
    delivery.email.failed +
    delivery.sms.succeeded +
    delivery.sms.failed;
  const failedTotal = delivery.email.failed + delivery.sms.failed;

  return (
    <div className='pb-20 w-full grid grid-cols-6 gap-5'>
      <div className='col-span-6 sm:col-span-3'>
        <Card
          icon={MdOutlineLaptopMac}
          label='Projects'
          value={counts.projects}
          hint={`${media} media files across them`}
          to='/admin/projects'
        />
      </div>
      <div className='col-span-6 sm:col-span-3'>
        <Card
          icon={MdOutlineArticle}
          label='About entries'
          value={aboutTotal}
          hint={`${counts.about.experience} roles, ${counts.about.education} education, ${counts.about.achievement} awards`}
          to='/admin/settings#personal'
        />
      </div>

      <div className='col-span-6 lg:col-span-4 box-big-shadow bg-primary-dark rounded-xl p-6 grid grid-rows-[auto_1fr] gap-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='grid gap-1'>
            <h2 className='text-md'>Email and SMS delivery</h2>
            <p className='text-secondary-light text-sm'>
              {deliveryTotal === 0
                ? 'No email or SMS has been sent yet.'
                : `${deliveryTotal} attempts, ${failedTotal} failed.`}
            </p>
          </div>
          <Link
            to='/admin/messaging'
            className='text-xs px-3 py-1.5 rounded-md border border-secondary-main/50 transition-all duration-300 hover:border-onPrimary-main whitespace-nowrap'
          >
            View logs
          </Link>
        </div>
        <DeliveryChart series={series} />
      </div>

      <div className='col-span-6 lg:col-span-2 box-big-shadow bg-primary-dark rounded-xl p-6 grid grid-rows-[auto_1fr] gap-4'>
        <h2 className='text-md'>Media</h2>
        <div className='grid gap-3'>
          <Bar label='Thumbnails' value={counts.media.thumbnails} total={media || 1} />
          <Bar label='Slider images' value={counts.media.slides} total={media || 1} />
          <Bar label='Videos' value={counts.media.videos} total={media || 1} />
        </div>
        <div className='flex items-center gap-2 text-secondary-light text-xs pt-1'>
          <MdOutlineImage />
          <span>{media} files in total</span>
        </div>
      </div>

      {visits && (
        <div className='col-span-6 box-big-shadow bg-primary-dark rounded-xl p-6 grid gap-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='grid gap-1'>
              <h2 className='text-md'>Visitors</h2>
              <p className='text-secondary-light text-sm'>
                {visits.total === 0
                  ? 'No page views recorded yet.'
                  : `${visits.total} page views recorded in total.`}{' '}
                Nothing identifying is stored: no IP, no user agent, no cookie.
              </p>
            </div>
            <div className='flex items-end gap-2'>
              <label className='grid gap-1'>
                <span className='text-secondary-light text-xs uppercase text-montreal-mono'>
                  Keep for (days)
                </span>
                <input
                  type='number'
                  min='1'
                  max='730'
                  value={retentionDraft}
                  onChange={(e) => setRetentionDraft(e.target.value)}
                  className='w-28 bg-body-main/40 border border-secondary-main/50 rounded-md px-3 py-2 text-sm outline-none focus:border-onPrimary-main transition-all duration-300'
                />
              </label>
              <button
                type='button'
                onClick={saveRetention}
                disabled={String(visits.retentionDays) === retentionDraft}
                className='text-sm px-3 py-2 rounded-md border border-onPrimary-main transition-all duration-300 hover:bg-onPrimary-main hover:text-body-main disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-current'
              >
                Apply
              </button>
            </div>
          </div>

          <VisitsChart series={visits.series} />

          {visits.topPaths.length > 0 && (
            <div className='grid sm:grid-cols-2 gap-8 pt-2'>
              {/*
                Plain counts in a table rather than bars. A bar chart of three
                rows where the top row is always full width says nothing the
                number does not, and took twice the space to say it.
              */}
              <StatTable
                heading='Most visited'
                columns={['Page', 'Views']}
                rows={visits.topPaths.map((row) => [row.path, row.views])}
              />
              <StatTable
                heading='Devices'
                columns={['Device', 'Views']}
                rows={visits.devices.map((row) => [row.device, row.views])}
              />
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default Dashboard;
