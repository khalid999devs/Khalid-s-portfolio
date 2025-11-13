import PropTypes from 'prop-types';

const NumberedText = ({ number, text, onClick, state = 'active' }) => {
  return (
    <div
      className={`flex items-center gap-2 ${
        onClick && 'cursor-pointer'
      } select-none`}
      onClick={() => {
        onClick && onClick();
      }}
    >
      <div
        className={`h-6 transition-all duration-300 w-6 rounded-full text-sm border flex items-center justify-center border-1 ${
          state === 'active'
            ? 'bg-primary-main text-black border-primary-main'
            : 'bg-transparent border-secondary-main text-secondary-main'
        } ${onClick && 'cursor-pointer'}`}
      >
        {number || 1}
      </div>
      <h2
        className={`text-lg transition-all duration-300 ${
          state === 'active' ? 'text-primary-main' : 'text-secondary-main'
        }`}
      >
        {text || 'Numbered text'}
      </h2>
    </div>
  );
};

NumberedText.propTypes = {
  number: PropTypes.number,
  text: PropTypes.string,
  onClick: PropTypes.func,
  state: PropTypes.bool,
};

export default NumberedText;
