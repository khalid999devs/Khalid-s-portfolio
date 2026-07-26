import PropTypes from 'prop-types';

export const OutlinedSmallButton = ({
  text,
  onClick,
  classes = '',
  textClasses = '',
  disableHover = false,
  disabled = false,
  type = 'button',
}) => {
  const className =
    `px-2.5 py-1.5 lg:px-3 2xl:px-3.5 lg:py-1.5 rounded-md border border-onPrimary-main transition-all duration-300 pointer-all disabled:cursor-not-allowed disabled:opacity-60 ${
      disableHover
        ? ''
        : 'hover:bg-onPrimary-main hover:text-body-main'
    } ` + classes;

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
      disabled={disabled}
      aria-disabled={disabled || undefined}
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
  disabled: PropTypes.bool,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
};

export const OutlinedBigIcon = ({
  text,
  onClick,
  classes = '',
  textClasses = '',
  type = 'button',
  pressed,
  disabled = false,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      className={
        'px-3.5 py-2 rounded-md border border-onPrimary-main transition-all duration-300 hover:bg-onPrimary-main hover:text-body-main text-montreal-mono pointer-all disabled:cursor-not-allowed disabled:opacity-60 ' +
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
  disabled: PropTypes.bool,
};
