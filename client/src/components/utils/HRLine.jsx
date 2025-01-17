import React from 'react';

const HRLine = ({ heightInPx = 0.5, classes, disablePadding = false }) => {
  return (
    <div
      className={`screen-max-width w-full ${
        !disablePadding && 'sec-x-padding'
      } `}
    >
      <div
        className={`h-[${heightInPx}px] bg-opacity-40 bg-secondary-main my-1 ${classes}`}
      ></div>
    </div>
  );
};

export default HRLine;
