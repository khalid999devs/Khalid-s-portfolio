import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  OutlinedBigIcon,
  OutlinedSmallButton,
} from '../Buttons/OutlinedButton';
import { downloadResume } from '../../axios/settings';

const ResumeDownloadButton = ({ size = 'big' }) => {
  const [state, setState] = useState({
    error: '',
    loading: false,
  });

  const handleDownload = async () => {
    if (state.loading) return;

    setState({ error: '', loading: true });
    try {
      await downloadResume();
      setState({ error: '', loading: false });
    } catch (error) {
      setState({
        error: error?.message || 'Failed to download the resume',
        loading: false,
      });
    }
  };

  const buttonProps = {
    disabled: state.loading,
    onClick: handleDownload,
    text: state.loading
      ? 'DOWNLOADING…'
      : size === 'small'
      ? 'My Resume'
      : 'DOWNLOAD CV',
  };

  return (
    <>
      {size === 'small' ? (
        <OutlinedSmallButton {...buttonProps} />
      ) : (
        <OutlinedBigIcon {...buttonProps} />
      )}
      {state.error && (
        <div
          className='pointer-events-auto fixed left-1/2 top-20 z-[70] flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center justify-between gap-4 rounded-xl border border-red-400/40 bg-red-950/95 px-4 py-3 text-sm text-primary-main shadow-xl backdrop-blur-md'
          role='alert'
        >
          <span>{state.error}</span>
          <button
            type='button'
            className='shrink-0 rounded-md border border-primary-main/60 px-2 py-1 hover:bg-primary-main hover:text-body-main'
            onClick={() =>
              setState((currentState) => ({
                ...currentState,
                error: '',
              }))
            }
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
};

ResumeDownloadButton.propTypes = {
  size: PropTypes.oneOf(['big', 'small']),
};

export default ResumeDownloadButton;
