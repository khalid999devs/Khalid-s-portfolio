import PropTypes from 'prop-types';

/**
 * Small chart primitives, drawn by hand in SVG.
 *
 * No chart library. The two shapes here are a bar and a line, and the smallest
 * credible option would add roughly 40 KiB to a bundle that took real work to
 * halve. What a library would give in return is mostly configuration surface
 * for charts this site does not have.
 *
 * Everything below uses a real coordinate system with padding for axes, rather
 * than stretching a 0..100 viewBox to fit. Stretching is what made the first
 * version look washed out: `preserveAspectRatio="none"` scales strokes and text
 * along with the shapes, so a one pixel line became a smear.
 */

const PADDING = { top: 8, right: 8, bottom: 20, left: 30 };
const WIDTH = 600;
const HEIGHT = 180;
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

/** Ticks that land on whole numbers, so a count axis never reads "2.5 visits". */
const niceTicks = (max, count = 4) => {
  const ceiling = Math.max(1, max);
  const rawStep = ceiling / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = Math.max(1, Math.ceil(rawStep / magnitude) * magnitude);
  const ticks = [];
  for (let value = 0; value <= step * count; value += step) ticks.push(value);
  return { ticks, top: ticks[ticks.length - 1] };
};

const shortDate = (iso) => {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

const Grid = ({ ticks, top }) => (
  <g>
    {ticks.map((tick) => {
      const y = PADDING.top + PLOT_HEIGHT - (tick / top) * PLOT_HEIGHT;
      return (
        <g key={tick}>
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={y}
            y2={y}
            className='stroke-secondary-main/25'
            strokeWidth='1'
          />
          <text
            x={PADDING.left - 6}
            y={y + 3}
            textAnchor='end'
            className='fill-secondary-light'
            style={{ fontSize: 9 }}
          >
            {tick}
          </text>
        </g>
      );
    })}
  </g>
);

Grid.propTypes = { ticks: PropTypes.array.isRequired, top: PropTypes.number.isRequired };

/** Date labels at the ends and middle only. Thirty of them would be unreadable. */
const DateAxis = ({ series }) => {
  if (series.length === 0) return null;
  const positions = [0, Math.floor(series.length / 2), series.length - 1];
  const band = PLOT_WIDTH / series.length;

  return (
    <g>
      {[...new Set(positions)].map((index) => (
        <text
          key={index}
          x={PADDING.left + band * index + band / 2}
          y={HEIGHT - 6}
          textAnchor={index === 0 ? 'start' : index === series.length - 1 ? 'end' : 'middle'}
          className='fill-secondary-light'
          style={{ fontSize: 9 }}
        >
          {shortDate(series[index].day)}
        </text>
      ))}
    </g>
  );
};

DateAxis.propTypes = { series: PropTypes.array.isRequired };

const Legend = ({ items, note }) => (
  <div className='flex flex-wrap items-center gap-4 text-xs text-secondary-light'>
    {items.map((item) => (
      <span key={item.label} className='flex items-center gap-1.5'>
        <span
          className={`inline-block rounded-sm ${item.className} ${
            item.line ? 'w-3 h-0.5' : 'w-2.5 h-2.5'
          }`}
        />
        {item.label}
      </span>
    ))}
    {note && <span className='ml-auto text-montreal-mono'>{note}</span>}
  </div>
);

Legend.propTypes = { items: PropTypes.array.isRequired, note: PropTypes.string };

/** Same height as a drawn plot, so an empty card aligns with a populated one. */
const EmptyPlot = ({ message }) => (
  <div
    className='grid place-items-center rounded-lg border border-dashed border-secondary-main/30'
    style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
  >
    <span className='text-secondary-light text-sm'>{message}</span>
  </div>
);

EmptyPlot.propTypes = { message: PropTypes.string.isRequired };

/**
 * Stacked bars: delivered on the bottom, failed on top.
 *
 * Stacked rather than side by side because the question is "how many went out,
 * and how many of those failed", which reads off one column height plus the red
 * portion of it.
 */
export const DeliveryChart = ({ series }) => {
  const totals = series.map((d) => d.succeeded + d.failed);
  const busiest = Math.max(...totals, 0);

  if (busiest === 0) {
    return (
      <div className='grid gap-3'>
        <EmptyPlot message='No email or SMS sent in the last 30 days.' />
        <Legend
          items={[
            { label: 'Delivered', className: 'bg-onPrimary-main' },
            { label: 'Failed', className: 'bg-red-500' },
          ]}
          note='last 30 days'
        />
      </div>
    );
  }

  const { ticks, top } = niceTicks(busiest);
  const band = PLOT_WIDTH / series.length;
  const barWidth = Math.max(2, band * 0.6);

  return (
    <div className='grid gap-3'>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className='w-full' role='img'
        aria-label='Deliveries per day over the last 30 days'>
        <Grid ticks={ticks} top={top} />
        {series.map((day, index) => {
          const x = PADDING.left + band * index + (band - barWidth) / 2;
          const successHeight = (day.succeeded / top) * PLOT_HEIGHT;
          const failedHeight = (day.failed / top) * PLOT_HEIGHT;
          const base = PADDING.top + PLOT_HEIGHT;
          return (
            <g key={day.day}>
              <title>{`${shortDate(day.day)}: ${day.succeeded} delivered, ${day.failed} failed`}</title>
              {day.succeeded > 0 && (
                <rect
                  x={x}
                  y={base - successHeight}
                  width={barWidth}
                  height={successHeight}
                  rx={Math.min(2, barWidth / 2)}
                  className='fill-onPrimary-main'
                />
              )}
              {day.failed > 0 && (
                <rect
                  x={x}
                  y={base - successHeight - failedHeight}
                  width={barWidth}
                  height={failedHeight}
                  rx={Math.min(2, barWidth / 2)}
                  className='fill-red-500'
                />
              )}
            </g>
          );
        })}
        <DateAxis series={series} />
      </svg>
      <Legend
        items={[
          { label: 'Delivered', className: 'bg-onPrimary-main' },
          { label: 'Failed', className: 'bg-red-500' },
        ]}
        note='last 30 days'
      />
    </div>
  );
};

DeliveryChart.propTypes = { series: PropTypes.array.isRequired };

/**
 * Page views as a filled area, unique visitors as a line above it.
 *
 * The area makes a single busy day legible where thirty thin bars did not, and
 * the line sits on top rather than competing with it.
 */
export const VisitsChart = ({ series }) => {
  const busiest = Math.max(...series.map((d) => d.views), 0);

  if (busiest === 0) {
    return (
      <div className='grid gap-3'>
        <EmptyPlot message='No page views in the last 30 days.' />
        <Legend
          items={[
            { label: 'Views', className: 'bg-onPrimary-main/60' },
            { label: 'Unique visitors', className: 'bg-green-500', line: true },
          ]}
          note='last 30 days'
        />
      </div>
    );
  }

  const { ticks, top } = niceTicks(busiest);
  const band = PLOT_WIDTH / Math.max(series.length - 1, 1);
  const pointX = (index) => PADDING.left + band * index;
  const pointY = (value) => PADDING.top + PLOT_HEIGHT - (value / top) * PLOT_HEIGHT;

  const areaPath =
    `M ${pointX(0)} ${PADDING.top + PLOT_HEIGHT} ` +
    series.map((d, i) => `L ${pointX(i)} ${pointY(d.views)}`).join(' ') +
    ` L ${pointX(series.length - 1)} ${PADDING.top + PLOT_HEIGHT} Z`;

  const visitorLine = series.map((d, i) => `${pointX(i)},${pointY(d.visitors)}`).join(' ');

  return (
    <div className='grid gap-3'>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className='w-full' role='img'
        aria-label='Page views per day over the last 30 days'>
        <defs>
          <linearGradient id='viewsFill' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor='currentColor' stopOpacity='0.35' />
            <stop offset='100%' stopColor='currentColor' stopOpacity='0.02' />
          </linearGradient>
        </defs>

        <Grid ticks={ticks} top={top} />

        <path d={areaPath} fill='url(#viewsFill)' className='text-onPrimary-main' />
        <polyline
          points={series.map((d, i) => `${pointX(i)},${pointY(d.views)}`).join(' ')}
          fill='none'
          strokeWidth='1.5'
          strokeLinejoin='round'
          className='stroke-onPrimary-main'
        />
        <polyline
          points={visitorLine}
          fill='none'
          strokeWidth='1.5'
          strokeLinejoin='round'
          strokeDasharray='4 3'
          className='stroke-green-500'
        />

        {series.map((day, index) =>
          day.views > 0 ? (
            <circle
              key={day.day}
              cx={pointX(index)}
              cy={pointY(day.views)}
              r='2.5'
              className='fill-onPrimary-main'
            >
              <title>{`${shortDate(day.day)}: ${day.views} views, ${day.visitors} visitors`}</title>
            </circle>
          ) : null
        )}

        <DateAxis series={series} />
      </svg>
      <Legend
        items={[
          { label: 'Views', className: 'bg-onPrimary-main/60' },
          { label: 'Unique visitors', className: 'bg-green-500', line: true },
        ]}
        note='last 30 days'
      />
    </div>
  );
};

VisitsChart.propTypes = { series: PropTypes.array.isRequired };
