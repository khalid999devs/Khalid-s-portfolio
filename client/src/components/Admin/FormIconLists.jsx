import React from 'react';
import IconedInput from '../Forms/IconedInput';
import IconedText from '../utils/IconedText';

const FormIconLists = ({
  handleInputSubmit,
  handleRemoveItem,
  name,
  items = [],
  containerClasses,
  type = 'verticle',
}) => {
  return (
    <div
      className={
        `grid gap-[1.1rem] w-full ${
          type === 'horizontal' && 'md:grid-cols-[max(180px),1fr] gap-4'
        } ` + containerClasses
      }
    >
      <div className='max-w-[180px] w-full'>
        <IconedInput name={name} handleSubmit={handleInputSubmit} />
      </div>
      <div className='flex items-center gap-x-1.5 gap-y-2.5 flex-wrap'>
        {items?.map((item, key) => (
          <IconedText
            key={key}
            onIconClick={(e) => handleRemoveItem(e, name, item)}
            text={item}
          />
        ))}
      </div>
    </div>
  );
};

export default FormIconLists;
