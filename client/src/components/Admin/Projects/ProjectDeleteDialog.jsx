import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';

const closeDialog = (dialog) => {
  if (!dialog?.open) return;

  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
};

const ProjectDeleteDialog = ({
  busy = false,
  onCancel,
  onConfirm,
  project,
}) => {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [confirmation, setConfirmation] = useState('');
  const titleId = useId();
  const descriptionId = useId();
  const feedbackId = useId();
  const projectId = project?.id;
  const projectName = project?.name || '';
  const isConfirmed =
    projectName.length > 0 && confirmation === projectName;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || projectId === undefined || projectId === null) {
      return undefined;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setConfirmation('');

    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }
    inputRef.current?.focus();

    return () => {
      closeDialog(dialog);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [projectId, projectName]);

  const handleCancel = (event) => {
    event?.preventDefault();
    if (!busy) onCancel();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!busy && isConfirmed) onConfirm(project);
  };

  return (
    <dialog
      aria-busy={busy}
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className='m-auto w-[min(92vw,32rem)] rounded-xl border border-secondary-main/50 bg-primary-dark p-6 text-onPrimary-main shadow-2xl backdrop:bg-black/75'
      onCancel={handleCancel}
      ref={dialogRef}
    >
      <form className='grid gap-5' onSubmit={handleSubmit}>
        <div className='grid gap-2'>
          <h2 className='text-xl' id={titleId}>
            Delete project?
          </h2>
          <p className='text-sm text-muted-light' id={descriptionId}>
            This permanently deletes the project and its uploaded media. Type{' '}
            <strong className='text-onPrimary-main'>{projectName}</strong> to
            confirm.
          </p>
        </div>

        <div className='grid gap-2'>
          <label className='text-sm' htmlFor={`${titleId}-confirmation`}>
            Project name
          </label>
          <input
            aria-describedby={
              confirmation && !isConfirmed ? feedbackId : descriptionId
            }
            autoComplete='off'
            className='w-full rounded-md border border-secondary-main bg-body-main px-3 py-2 text-onPrimary-main outline-hidden focus-visible:ring-2 focus-visible:ring-onPrimary-main'
            disabled={busy}
            id={`${titleId}-confirmation`}
            onChange={(event) => setConfirmation(event.target.value)}
            ref={inputRef}
            spellCheck='false'
            value={confirmation}
          />
          {confirmation && !isConfirmed ? (
            <p
              aria-live='polite'
              className='text-sm text-red-300'
              id={feedbackId}
            >
              The project name must match exactly.
            </p>
          ) : null}
        </div>

        <div className='flex flex-wrap justify-end gap-3'>
          <button
            className='rounded-md border border-secondary-main px-4 py-2 text-sm transition-colors hover:bg-body-main disabled:cursor-not-allowed disabled:opacity-60'
            disabled={busy}
            onClick={handleCancel}
            type='button'
          >
            Cancel
          </button>
          <button
            className='rounded-md border border-red-600 bg-red-600 px-4 py-2 text-sm transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60'
            disabled={busy || !isConfirmed}
            type='submit'
          >
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </form>
    </dialog>
  );
};

ProjectDeleteDialog.propTypes = {
  busy: PropTypes.bool,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  project: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
  }),
};

export default ProjectDeleteDialog;
