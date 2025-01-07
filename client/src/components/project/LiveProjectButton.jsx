import React, { useState } from 'react';
import { MdArrowOutward } from 'react-icons/md';

const LiveProjectButton = ({ link }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / 15;
    const y = (e.clientY - rect.top - rect.height / 2) / 15;
    setPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div
      className='w-[150px] h-[150px] rounded-full bg-secondary-main shadow-md shadow-primary-dark flex items-center justify-center gap-2 group cursor-pointer absolute right-[8%] -top-[17%]'
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: 'transform 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => {
        window.open(link, '_blank');
      }}
    >
      <span className='text-lg text-primary-main'>Live site</span>
      <MdArrowOutward className='text-primary-main text-2xl transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5' />
    </div>
  );
};

export default LiveProjectButton;
