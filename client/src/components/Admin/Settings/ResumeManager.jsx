import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { MdUploadFile, MdDelete, MdOpenInNew } from 'react-icons/md';
import PrimaryButton from '../../Buttons/PrimaryButton';
import { uploadResume, deleteResume } from '../../../axios/settings';
import { resumeUrl } from '../../../assets';

const MAXIMUM_BYTES = 10 * 1024 * 1024;

/**
 * Manages the site-wide resume.
 *
 * The resume used to be a file copied onto the server under one exact hardcoded
 * name, with nothing in the application able to change it. It is now a row in
 * settings and a document under uploads/assets, replaceable from here.
 *
 * The server is the authority on what is acceptable -- it reads the file's
 * leading bytes and refuses anything that is not really a PDF. The checks below
 * exist only to fail fast and explain the problem without a round trip.
 */
const ResumeManager = ({ settings, onChange, setPopup }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const href = resumeUrl(settings);
  const currentName = settings?.resumeOriginalName;

  const report = (text, type) => setPopup({ text, type, state: true });

  const submit = async (file) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      report('The resume has to be a PDF file.', 'error');
      return;
    }
    if (file.size > MAXIMUM_BYTES) {
      report('That PDF is larger than the 10 MB limit.', 'error');
      return;
    }

    setBusy(true);
    report('Uploading resume...', 'normal');
    try {
      const data = await uploadResume(file);
      onChange({
        resume: data.resume,
        resumeOriginalName: data.resumeOriginalName,
      });
      report(data.msg || 'Resume updated', 'success');
    } catch (error) {
      report(
        error.response?.data?.msg || 'Failed to upload the resume',
        'error'
      );
    } finally {
      setBusy(false);
      // Clearing the input means selecting the same file twice still fires
      // onChange, which it otherwise would not.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    report('Removing resume...', 'normal');
    try {
      const data = await deleteResume();
      onChange({ resume: null, resumeOriginalName: null });
      report(data.msg || 'Resume removed', 'success');
    } catch (error) {
      report(
        error.response?.data?.msg || 'Failed to remove the resume',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='col-span-9 box-big-shadow bg-primary-dark rounded-xl p-8 grid gap-6'>
      <div className='grid gap-1'>
        <h1 className='text-md'>Resume</h1>
        <p className='text-secondary-light text-sm'>
          A single PDF, shown by the “My Resume” button and served by the
          download link. Replacing it here takes effect immediately.
        </p>
      </div>

      {href ? (
        <div className='grid sm:grid-cols-[1fr_auto] gap-3 items-center'>
          <div className='grid gap-1'>
            <span className='text-secondary-light text-xs uppercase text-montreal-mono'>
              Currently published
            </span>
            <a
              href={href}
              target='_blank'
              rel='noopener noreferrer'
              className='text-sm flex items-center gap-2 hover:opacity-80 transition-all duration-300 break-all'
            >
              {currentName || 'resume.pdf'}
              <MdOpenInNew className='shrink-0' />
            </a>
          </div>
          <button
            type='button'
            onClick={remove}
            disabled={busy}
            className='flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-red-600 text-sm transition-all duration-300 hover:bg-red-600 disabled:opacity-50'
          >
            <MdDelete /> Remove
          </button>
        </div>
      ) : (
        <p className='text-secondary-light text-sm'>
          No resume uploaded yet. The “My Resume” button stays hidden until one
          is.
        </p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          submit(e.dataTransfer.files?.[0]);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        className={`grid place-items-center gap-2 py-8 px-4 rounded-lg border border-dashed cursor-pointer transition-all duration-300 ${
          dragging
            ? 'border-onPrimary-main bg-body-main/40'
            : 'border-secondary-main/50 hover:border-onPrimary-main'
        } ${busy ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <MdUploadFile className='text-2xl' />
        <p className='text-sm text-center'>
          {busy ? 'Working...' : 'Drop a PDF here, or click to choose one'}
        </p>
        <p className='text-secondary-light text-xs text-montreal-mono'>
          PDF only · up to 10 MB
        </p>
        <input
          ref={inputRef}
          type='file'
          accept='application/pdf,.pdf'
          className='hidden'
          onChange={(e) => submit(e.target.files?.[0])}
        />
      </div>

      <div className='flex justify-end'>
        <PrimaryButton
          text={href ? 'Replace resume' : 'Upload resume'}
          onClick={() => !busy && inputRef.current?.click()}
        />
      </div>
    </div>
  );
};

ResumeManager.propTypes = {
  settings: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  setPopup: PropTypes.func.isRequired,
};

export default ResumeManager;
