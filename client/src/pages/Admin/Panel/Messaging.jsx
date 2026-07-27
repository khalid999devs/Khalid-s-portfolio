import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { MdOutlineMail, MdOutlineSms, MdSend } from 'react-icons/md';
import { reqs } from '../../../axios/requests';
import Popup from '../../../components/utils/Popup';
import DeliveryTable from '../../../components/Admin/DeliveryTable';

const field =
  'w-full bg-body-main/40 border border-secondary-main/50 rounded-md px-3 py-2 text-sm outline-none focus:border-onPrimary-main transition-all duration-300';

const TABS = [
  { key: 'email', label: 'Email', icon: MdOutlineMail },
  { key: 'sms', label: 'SMS', icon: MdOutlineSms },
];

/**
 * Sends a one off email or SMS through the same transports the contact replies
 * use: nodemailer over SMTP, and the SMS gateway.
 *
 * Every attempt is written to the delivery log, successful or not, so this page
 * does not need its own history. It links to that instead of duplicating it.
 */
const Messaging = () => {
  const { setPageTitle } = useOutletContext();
  const [tab, setTab] = useState('email');
  const [busy, setBusy] = useState(false);
  const [popUp, setPopup] = useState({ text: '', type: 'normal', state: false });

  const [email, setEmail] = useState({ to: '', name: '', subject: '', text: '' });
  const [sms, setSms] = useState({ phone: '', message: '' });
  useEffect(() => {
    setPageTitle('Mail & SMS');
  }, [setPageTitle]);

  const report = (text, type) => setPopup({ text, type, state: true });

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
          text: email.text,
        },
        { withCredentials: true }
      );
      report(data.msg || 'Email sent', 'success');
      setEmail({ to: '', name: '', subject: '', text: '' });
    } catch (error) {
      report(
        error.response?.data?.msg ||
          'Could not send the email. Check the delivery log for the provider error.',
        'error'
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
        { withCredentials: true }
      );
      // The gateway reports failures with a 200 and succeed:false, so the flag
      // matters more than the status code here.
      report(data.msg || 'SMS sent', data.succeed ? 'success' : 'error');
      if (data.succeed) setSms({ phone: '', message: '' });
    } catch (error) {
      report(
        error.response?.data?.msg ||
          'Could not send the SMS. Check the delivery log for the gateway response.',
        'error'
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
        {tab === 'email' ? (
          <form onSubmit={sendEmail} className='grid gap-3'>
            <div className='grid gap-1'>
              <h1 className='text-md'>Send an email</h1>
              <p className='text-secondary-light text-sm'>
                Sent over SMTP from the address configured on the server. The
                recipient sees your site address, not this panel.
              </p>
            </div>
            <div className='grid sm:grid-cols-2 gap-3'>
              <input
                className={field}
                type='email'
                required
                placeholder='Recipient email'
                value={email.to}
                onChange={(e) => setEmail((v) => ({ ...v, to: e.target.value }))}
              />
              <input
                className={field}
                type='text'
                placeholder='Recipient name (optional)'
                value={email.name}
                onChange={(e) => setEmail((v) => ({ ...v, name: e.target.value }))}
              />
            </div>
            <input
              className={field}
              type='text'
              required
              placeholder='Subject'
              value={email.subject}
              onChange={(e) => setEmail((v) => ({ ...v, subject: e.target.value }))}
            />
            <textarea
              className={`${field} min-h-[200px] resize-y`}
              required
              placeholder='Message'
              value={email.text}
              onChange={(e) => setEmail((v) => ({ ...v, text: e.target.value }))}
            />
            <div className='flex items-center justify-between gap-3'>
              <span className='text-xs text-secondary-light'>
                Every attempt is recorded below, delivered or not
              </span>
              <button
                type='submit'
                disabled={busy}
                className='flex items-center gap-2 text-sm px-4 py-2 rounded-md border border-onPrimary-main transition-all duration-300 hover:bg-onPrimary-main hover:text-body-main disabled:opacity-50'
              >
                <MdSend /> Send email
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={sendSms} className='grid gap-3'>
            <div className='grid gap-1'>
              <h1 className='text-md'>Send an SMS</h1>
              <p className='text-secondary-light text-sm'>
                Sent through the configured gateway. Separate numbers with a
                comma to reach several people at once.
              </p>
            </div>
            <input
              className={field}
              type='text'
              required
              placeholder='Number, or comma separated numbers'
              value={sms.phone}
              onChange={(e) => setSms((v) => ({ ...v, phone: e.target.value }))}
            />
            <textarea
              className={`${field} min-h-[160px] resize-y`}
              required
              maxLength={800}
              placeholder='Message'
              value={sms.message}
              onChange={(e) => setSms((v) => ({ ...v, message: e.target.value }))}
            />
            <div className='flex items-center justify-between gap-3'>
              <span className='text-xs text-secondary-light text-montreal-mono'>
                {sms.message.length} characters
              </span>
              <button
                type='submit'
                disabled={busy}
                className='flex items-center gap-2 text-sm px-4 py-2 rounded-md border border-onPrimary-main transition-all duration-300 hover:bg-onPrimary-main hover:text-body-main disabled:opacity-50'
              >
                <MdSend /> Send SMS
              </button>
            </div>
          </form>
        )}
      </div>

      {/*
        The delivery history, pinned to the channel of the tab you are on.
        There is no separate logs page: the tabs already split email from SMS,
        so a second page showing the same table was a duplicate.
      */}
      <DeliveryTable
        key={tab}
        title={`Recent ${tab === 'email' ? 'emails' : 'messages'}`}
        lockedChannel={tab}
        showFilters
        pageSize={10}
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
