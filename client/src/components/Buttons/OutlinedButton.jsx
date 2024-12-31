export const OutlinedSmallButton = ({
  text,
  onClick,
  classes,
  textClasses,
  disableHover = false,
}) => {
  return (
    <button
      onClick={onClick}
      className={
        `px-2.5 py-1.5 lg:px-3 2xl:3.5 lg:py-1.5 rounded-md border-[1px] border-onPrimary-main transition-all duration-300 ${
          !disableHover && 'hover:bg-onPrimary-main'
        } ${!disableHover && 'hover:text-body-main'} ` + classes
      }
    >
      <p className={'text-xs lg:text-sm ' + textClasses}>{text || 'Button'}</p>
    </button>
  );
};

export const OutlinedBigIcon = ({ text, onClick, classes, textClasses }) => {
  return (
    <button
      onClick={onClick}
      className={
        'px-3.5 py-2 rounded-md border-[1px] border-onPrimary-main transition-all duration-300 hover:bg-onPrimary-main hover:text-body-main text-montreal-mono ' +
        classes
      }
    >
      <p className={'text-sm ' + textClasses}>{text || 'Button'}</p>
    </button>
  );
};
