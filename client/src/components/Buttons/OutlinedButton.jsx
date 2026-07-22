import PropTypes from 'prop-types';

export const OutlinedSmallButton = ({
  text,
  onClick,
  classes,
  textClasses,
  disableHover = false,
  type = 'button',
}) => {
  const className =
    `px-2.5 py-1.5 lg:px-3 2xl:px-3.5 lg:py-1.5 rounded-md border border-onPrimary-main transition-all duration-300 pointer-all ${
      !disableHover && 'hover:bg-onPrimary-main'
    } ${!disableHover && 'hover:text-body-main'} ` + classes;

  if (!onClick) {
    return (
      <span className={className}>
        <span className={'text-xs lg:text-sm ' + textClasses}>
          {text || 'Label'}
        </span>
      </span>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      className={className}
    >
      <span className={'text-xs lg:text-sm ' + textClasses}>
        {text || 'Button'}
      </span>
    </button>
  );
};

OutlinedSmallButton.propTypes = {
  text: PropTypes.string,
  onClick: PropTypes.func,
  classes: PropTypes.string,
  textClasses: PropTypes.string,
  disableHover: PropTypes.bool,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
};

export const OutlinedBigIcon = ({
  text,
  onClick,
  classes,
  textClasses,
  type = 'button',
  pressed,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-pressed={pressed}
      className={
        'px-3.5 py-2 rounded-md border border-onPrimary-main transition-all duration-300 hover:bg-onPrimary-main hover:text-body-main text-montreal-mono pointer-all ' +
        classes
      }
    >
      <span className={'text-sm ' + textClasses}>{text || 'Button'}</span>
    </button>
  );
};

OutlinedBigIcon.propTypes = {
  text: PropTypes.string,
  onClick: PropTypes.func,
  classes: PropTypes.string,
  textClasses: PropTypes.string,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  pressed: PropTypes.bool,
};
