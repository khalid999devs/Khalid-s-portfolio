import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import PropTypes from 'prop-types';
import {
  MdOutlineMail,
  MdOutlineSms,
  MdSend,
  MdOutlinePerson,
  MdOutlineGroup,
  MdRefresh,
  MdOutlineStyle,
  MdOutlineCode,
} from 'react-icons/md';
import { reqs } from '../../../axios/requests';
import Popup from '../../../components/utils/Popup';
import DeliveryTable from '../../../components/Admin/DeliveryTable';
import RichTextEditor from '../../../components/Admin/RichTextEditor';
import {
  parseEmails,
  parseNumbers,
  smsSegments,
} from '../../../utils/FormValidations/recipients';

const field =
  'w-full bg-body-main/40 border border-secondary-main/50 rounded-md px-3 py-2 text-sm outline-none focus:border-onPrimary-main transition-all duration-300';

const sendButton =
  'flex items-center gap-2 text-sm px-4 py-2 rounded-md border border-onPrimary-main transition-all duration-300 hover:bg-onPrimary-main hover:text-body-main disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-inherit';

const TABS = [
  { key: 'email', label: 'Email', icon: MdOutlineMail },
  { key: 'sms', label: 'SMS', icon: MdOutlineSms },
];

const BLANK_EMAIL = {
  to: '',
  name: '',
  recipients: '',
  subject: '',
  html: '',
  ctaLabel: '',
  ctaUrl: '',
};

const TEMPLATES = [
  {
    key: 'branded',
    label: 'With template',
    icon: MdOutlineStyle,
    hint: 'Wrapped in your header, greeting, signature and footer',
  },
  {
    key: 'raw',
    label: 'Raw',
    icon: MdOutlineCode,
    hint: 'Just your message, no branding, greeting or signature',
  },
];

const SCOPES = [
  { key: 'single', label: 'One recipient', icon: MdOutlinePerson },
  { key: 'bulk', label: 'Many recipients', icon: MdOutlineGroup },
];

/** Outside the page component: inside, every keystroke remounts it. */
const RecipientSummary = ({ list, noun }) => {
  if (list.valid.length === 0 && list.invalid.length === 0) {
    return (
      <span className='text-xs text-secondary-light'>
        Separate {noun} with commas, spaces or new lines
      </span>
    );
  }

  return (
    <span className='text-xs text-secondary-light text-montreal-mono flex flex-wrap gap-x-3 gap-y-1'>
      <span className='text-green-500'>{list.valid.length} ready</span>
      {list.duplicates > 0 && (
        <span>
          {list.duplicates} duplicate{list.duplicates === 1 ? '' : 's'} removed
        </span>
      )}
      {list.invalid.length > 0 && (
        <span className='text-red-400'>
          {list.invalid.length} unusable: {list.invalid.slice(0, 4).join(', ')}
          {list.invalid.length > 4 ? '…' : ''}
        </span>
      )}
    </span>
  );
};

RecipientSummary.propTypes = {
  list: PropTypes.shape({
    valid: PropTypes.array.isRequired,
    invalid: PropTypes.array.isRequired,
    duplicates: PropTypes.number.isRequired,
  }).isRequired,
  noun: PropTypes.string.isRequired,
};

/**
 * Email and SMS, to one recipient or a pasted list. History comes from the
 * delivery log below. Subject and body are shared across both modes so
 * switching does not lose the draft.
 */
const Messaging = () => {
  const { setPageTitle } = useOutletContext();
  const [tab, setTab] = useState('email');
  const [scope, setScope] = useState('single');
  const [template, setTemplate] = useState('branded');
  const [busy, setBusy] = useState(false);
  const [popUp, setPopup] = useState({
    text: '',
    type: 'normal',
    state: false,
  });
  const [refreshLogs, setRefreshLogs] = useState(0);

  const [email, setEmail] = useState(BLANK_EMAIL);
  const [sms, setSms] = useState({ phone: '', numbers: '', message: '' });
  // Starts loading so the first paint reads "Checking...", not "unknown".
  const [balance, setBalance] = useState({
    value: null,
    loading: true,
    error: '',
  });
  const [balanceToken, setBalanceToken] = useState(0);

  useEffect(() => {
    setPageTitle('Mail & SMS');
  }, [setPageTitle]);

  const report = (text, type) => setPopup({ text, type, state: true });

  // Gateway credit, SMS tab only. Free to read. Inline in the effect so state
  // is set only from a callback; the guard stops a stale answer landing after
  // a tab switch.
  useEffect(() => {
    if (tab !== 'sms') return undefined;

    let live = true;

    axios
      .get(reqs.SMS_BALANCE, { withCredentials: true })
      .then(({ data }) => {
        if (!live) return;
        setBalance({
          value: data.succeed ? data.balance : null,
          loading: false,
          error: data.succeed ? '' : data.msg || 'Unavailable',
        });
      })
      .catch((error) => {
        if (!live) return;
        setBalance({
          value: null,
          loading: false,
          error: error.response?.data?.msg || 'Unavailable',
        });
      });

    return () => {
      live = false;
    };
  }, [tab, balanceToken]);

  /** Re-runs the effect above. Sending changes the balance, so does the button. */
  const refreshBalance = () => {
    setBalance((current) => ({ ...current, loading: true, error: '' }));
    setBalanceToken((n) => n + 1);
  };

  const emailList = useMemo(
    () => parseEmails(email.recipients),
    [email.recipients],
  );
  const smsList = useMemo(() => parseNumbers(sms.numbers), [sms.numbers]);
  const segments = useMemo(() => smsSegments(sms.message), [sms.message]);

  const afterSend = () => setRefreshLogs((n) => n + 1);

  const sendEmail = async (e) => {
    e.preventDefault();
    setBusy(true);
    report('Sending email...', 'normal');
    try {
      const { data } = await axios.post(
        `${reqs.SEND_EMAIL}/custom`,
        {
          email: email.to,
          name: email.name || email.to,
          subject: email.subject,
          html: email.html,
          template,
          ctaLabel: email.ctaLabel,
          ctaUrl: email.ctaUrl,
        },
        { withCredentials: true },
      );
      report(data.msg || 'Email sent', 'success');
      setEmail(BLANK_EMAIL);
      afterSend();
    } catch (error) {
      report(
        error.response?.data?.msg ||
          'Could not send the email. Check the delivery log for the provider error.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const sendBulkEmail = async (e) => {
    e.preventDefault();
    setBusy(true);
    report(`Sending to ${emailList.valid.length} recipients...`, 'normal');
    try {
      const { data } = await axios.post(
        reqs.SEND_BULK_EMAIL,
        {
          recipients: email.recipients,
          subject: email.subject,
          html: email.html,
          template,
          ctaLabel: email.ctaLabel,
          ctaUrl: email.ctaUrl,
        },
        { withCredentials: true },
      );
      // Partly delivered is neither success nor failure.
      report(data.msg, data.failed > 0 ? 'normal' : 'success');
      if (data.failed === 0) setEmail(BLANK_EMAIL);
      afterSend();
    } catch (error) {
      report(
        error.response?.data?.msg || 'Could not send. Nothing was delivered.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const sendSms = async (e) => {
    e.preventDefault();
    setBusy(true);
    report('Sending SMS...', 'normal');
    try {
      const { data } = await axios.post(
        `${reqs.SEND_SMS}/custom`,
        { phone: sms.phone, message: sms.message },
        { withCredentials: true },
      );
      // Failures come back 200 with succeed:false, so trust the flag.
      report(data.msg || 'SMS sent', data.succeed ? 'success' : 'error');
      if (data.succeed) setSms({ phone: '', numbers: '', message: '' });
      afterSend();
      setBalanceToken((n) => n + 1);
    } catch (error) {
      report(
        error.response?.data?.msg ||
          'Could not send the SMS. Check the delivery log for the gateway response.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const sendBulkSms = async (e) => {
    e.preventDefault();
    setBusy(true);
    report(`Sending to ${smsList.valid.length} numbers...`, 'normal');
    try {
      const { data } = await axios.post(
        reqs.SEND_BULK_SMS,
        { numbers: sms.numbers, message: sms.message },
        { withCredentials: true },
      );
      report(
        data.msg,
        data.succeed ? (data.failed > 0 ? 'normal' : 'success') : 'error',
      );
      if (data.succeed && data.failed === 0) {
        setSms({ phone: '', numbers: '', message: '' });
      }
      afterSend();
      setBalanceToken((n) => n + 1);
    } catch (error) {
      report(
        error.response?.data?.msg || 'Could not send. Nothing was delivered.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='w-full grid gap-5'>
      <div className='flex items-center gap-1 border-b border-secondary-main/40'>
        {TABS.map((item) => (
          <button
            key={item.key}
            type='button'
            onClick={() => setTab(item.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-all duration-300 border-b-2 -mb-px ${
              tab === item.key
                ? 'border-onPrimary-main text-primary-main'
                : 'border-transparent text-secondary-light hover:text-primary-main'
            }`}
          >
            <item.icon /> {item.label}
          </button>
        ))}
      </div>

      <div className='box-big-shadow bg-primary-dark rounded-xl p-6 grid gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-1 p-1 rounded-lg bg-body-main/40 border border-secondary-main/40'>
            {SCOPES.map((item) => (
              <button
                key={item.key}
                type='button'
                onClick={() => setScope(item.key)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-all duration-300 ${
                  scope === item.key
                    ? 'bg-onPrimary-main text-body-main'
                    : 'text-secondary-light hover:text-primary-main'
                }`}
              >
                <item.icon /> {item.label}
              </button>
            ))}
          </div>

          {/* Same slot as the SMS credit chip: whichever tab you are on, the
              thing you might want to change sits top right. */}
          {tab === 'email' && (
            <div className='flex items-center gap-1 p-1 rounded-lg bg-body-main/40 border border-secondary-main/40'>
              {TEMPLATES.map((item) => (
                <button
                  key={item.key}
                  type='button'
                  onClick={() => setTemplate(item.key)}
                  title={item.hint}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-all duration-300 ${
                    template === item.key
                      ? 'bg-onPrimary-main text-body-main'
                      : 'text-secondary-light hover:text-primary-main'
                  }`}
                >
                  <item.icon /> {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Credit only means anything on the SMS side; email has no meter. */}
          {tab === 'sms' && (
            <button
              type='button'
              onClick={refreshBalance}
              disabled={balance.loading}
              title='Refresh the gateway balance'
              className='flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-secondary-main/50 text-secondary-light transition-all duration-300 hover:border-onPrimary-main hover:text-primary-main disabled:opacity-40'
            >
              <MdRefresh className={balance.loading ? 'animate-spin' : ''} />
              <span className='text-montreal-mono'>
                {balance.loading
                  ? 'Checking...'
                  : balance.error
                    ? balance.error
                    : balance.value === null
                      ? 'Balance unknown'
                      : `${balance.value} credit${balance.value === 1 ? '' : 's'} left`}
              </span>
            </button>
          )}
        </div>

        {tab === 'email' && scope === 'single' && (
          <form onSubmit={sendEmail} className='grid gap-3'>
            <div className='grid gap-1'>
              <h1 className='text-md'>Send an email</h1>
              <p className='text-secondary-light text-sm'>
                Sent over SMTP from the address configured on the server.{' '}
                {template === 'raw'
                  ? 'Delivered exactly as written, with no header, greeting or signature.'
                  : 'Wrapped in your branded layout, with a greeting and signature.'}
              </p>
            </div>
            <div className='grid sm:grid-cols-2 gap-3'>
              <input
                className={field}
                type='email'
                required
                placeholder='Recipient email'
                value={email.to}
                onChange={(e) =>
                  setEmail((v) => ({ ...v, to: e.target.value }))
                }
              />
              <input
                className={field}
                type='text'
                placeholder='Recipient name (optional)'
                value={email.name}
                onChange={(e) =>
                  setEmail((v) => ({ ...v, name: e.target.value }))
                }
              />
            </div>
            <input
              className={field}
              type='text'
              required
              placeholder='Subject'
              value={email.subject}
              onChange={(e) =>
                setEmail((v) => ({ ...v, subject: e.target.value }))
              }
            />
            <RichTextEditor
              value={email.html}
              onChange={(html) => setEmail((v) => ({ ...v, html }))}
              placeholder='Message'
            />
            <div className='grid sm:grid-cols-2 gap-3'>
              <input
                className={field}
                type='text'
                placeholder='Button label (optional)'
                value={email.ctaLabel}
                onChange={(e) =>
                  setEmail((v) => ({ ...v, ctaLabel: e.target.value }))
                }
              />
              <input
                className={field}
                type='url'
                placeholder='Button link, https://…'
                value={email.ctaUrl}
                onChange={(e) =>
                  setEmail((v) => ({ ...v, ctaUrl: e.target.value }))
                }
              />
            </div>
            <div className='flex items-center justify-between gap-3'>
              <span className='text-xs text-secondary-light'>
                Every attempt is recorded below, delivered or not
              </span>
              <button
                type='submit'
                disabled={busy || !email.html}
                className={sendButton}
              >
                <MdSend /> Send email
              </button>
            </div>
          </form>
        )}

        {tab === 'email' && scope === 'bulk' && (
          <form onSubmit={sendBulkEmail} className='grid gap-3'>
            <div className='grid gap-1'>
              <h1 className='text-md'>Send an email to many people</h1>
              <p className='text-secondary-light text-sm'>
                Each person gets their own copy, so nobody sees who else was
                written to.{' '}
                {template === 'raw'
                  ? 'Sent with no branding.'
                  : 'Wrapped in your branded layout.'}{' '}
                The batch is saved as a single report below.
              </p>
            </div>
            <textarea
              className={`${field} min-h-[90px] resize-y`}
              required
              placeholder='someone@example.com, another@example.com&#10;a.third@example.com'
              value={email.recipients}
              onChange={(e) =>
                setEmail((v) => ({ ...v, recipients: e.target.value }))
              }
            />
            <RecipientSummary list={emailList} noun='addresses' />
            <input
              className={field}
              type='text'
              required
              placeholder='Subject'
              value={email.subject}
              onChange={(e) =>
                setEmail((v) => ({ ...v, subject: e.target.value }))
              }
            />
            <RichTextEditor
              value={email.html}
              onChange={(html) => setEmail((v) => ({ ...v, html }))}
              placeholder='Message'
            />
            <div className='grid sm:grid-cols-2 gap-3'>
              <input
                className={field}
                type='text'
                placeholder='Button label (optional)'
                value={email.ctaLabel}
                onChange={(e) =>
                  setEmail((v) => ({ ...v, ctaLabel: e.target.value }))
                }
              />
              <input
                className={field}
                type='url'
                placeholder='Button link, https://…'
                value={email.ctaUrl}
                onChange={(e) =>
                  setEmail((v) => ({ ...v, ctaUrl: e.target.value }))
                }
              />
            </div>
            <div className='flex items-center justify-between gap-3'>
              <span className='text-xs text-secondary-light'>
                Addresses that will not work are listed above; fix them first
              </span>
              <button
                type='submit'
                // The server refuses these anyway; say so before the round trip.
                disabled={
                  busy ||
                  !email.html ||
                  emailList.valid.length === 0 ||
                  emailList.invalid.length > 0
                }
                className={sendButton}
              >
                <MdSend /> Send to {emailList.valid.length}
              </button>
            </div>
          </form>
        )}

        {tab === 'sms' && scope === 'single' && (
          <form onSubmit={sendSms} className='grid gap-3'>
            <div className='grid gap-1'>
              <h1 className='text-md'>Send an SMS</h1>
              <p className='text-secondary-light text-sm'>
                Sent through the configured gateway. Written as 01XXXXXXXXX or
                8801XXXXXXXXX; either is accepted.
              </p>
            </div>
            <input
              className={field}
              type='text'
              required
              placeholder='01712345678'
              value={sms.phone}
              onChange={(e) => setSms((v) => ({ ...v, phone: e.target.value }))}
            />
            <textarea
              className={`${field} min-h-[160px] resize-y`}
              required
              maxLength={800}
              placeholder='Message'
              value={sms.message}
              onChange={(e) =>
                setSms((v) => ({ ...v, message: e.target.value }))
              }
            />
            <div className='flex items-center justify-between gap-3'>
              <span className='text-xs text-secondary-light text-montreal-mono'>
                {sms.message.length} characters · {segments.segments} part
                {segments.segments === 1 ? '' : 's'}
                {segments.unicode ? ' · unicode, 70 per part' : ''}
              </span>
              <button type='submit' disabled={busy} className={sendButton}>
                <MdSend /> Send SMS
              </button>
            </div>
          </form>
        )}

        {tab === 'sms' && scope === 'bulk' && (
          <form onSubmit={sendBulkSms} className='grid gap-3'>
            <div className='grid gap-1'>
              <h1 className='text-md'>Send an SMS to many numbers</h1>
              <p className='text-secondary-light text-sm'>
                One call to the gateway covers the whole list. Written as
                01XXXXXXXXX or 8801XXXXXXXXX; either is accepted.
              </p>
            </div>
            <textarea
              className={`${field} min-h-[90px] resize-y`}
              required
              placeholder='01712345678, 01812345678&#10;01912345678'
              value={sms.numbers}
              onChange={(e) =>
                setSms((v) => ({ ...v, numbers: e.target.value }))
              }
            />
            <RecipientSummary list={smsList} noun='numbers' />
            <textarea
              className={`${field} min-h-[160px] resize-y`}
              required
              maxLength={800}
              placeholder='Message'
              value={sms.message}
              onChange={(e) =>
                setSms((v) => ({ ...v, message: e.target.value }))
              }
            />
            <div className='flex items-center justify-between gap-3'>
              <span className='text-xs text-secondary-light text-montreal-mono'>
                {sms.message.length} characters · {segments.segments} part
                {segments.segments === 1 ? '' : 's'} ·{' '}
                {smsList.valid.length * segments.segments} credits
                {segments.unicode ? ' · unicode, 70 per part' : ''}
              </span>
              <button
                type='submit'
                disabled={busy || smsList.valid.length === 0}
                className={sendButton}
              >
                <MdSend /> Send to {smsList.valid.length}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Delivery history, pinned to the tab's channel. */}
      <DeliveryTable
        key={tab}
        title={`Recent ${tab === 'email' ? 'emails' : 'messages'}`}
        lockedChannel={tab}
        showFilters
        pageSize={10}
        refreshToken={refreshLogs}
        setPopup={setPopup}
      />

      <Popup
        setPopup={setPopup}
        state={popUp.state}
        loading={busy}
        text={popUp.text}
        type={popUp.type}
      />
    </div>
  );
};

export default Messaging;
