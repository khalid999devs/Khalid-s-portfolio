export const OutlinedSmallButton = ({
  text,
  onClick,
  classes,
  textClasses,
}) => {
  return (
    <button
      onClick={onClick}
      className={
        'px-3.5 py-1.5 rounded-md border-[1px] border-onPrimary-main transition-all duration-300 hover:bg-onPrimary-main hover:text-body-main ' +
        classes
      }
    >
      <p className={'text-sm ' + textClasses}>{text || 'Button'}</p>
    </button>
  );
};
