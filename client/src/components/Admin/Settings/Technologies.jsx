import React, { useEffect, useState } from 'react';
import IconedInput from '../../Forms/IconedInput';
import IconedText from '../../utils/IconedText';
import FormIconLists from '../FormIconLists';
import PrimaryButton from '../../Buttons/PrimaryButton';
import { MdDone } from 'react-icons/md';

const Technologies = ({
  mode,
  settings,
  handleCreateSettings,
  handleEditSettings,
}) => {
  const [technologies, setTechnologies] = useState({
    Languages: [],
    Frontend: [],
    Backend: [],
  });
  useEffect(() => {
    if (settings?.technologies) {
      setTechnologies(settings?.technologies);
    }
  }, [settings]);

  const handleInputSubmit = (e, name, value) => {
    setTechnologies((technologies) => ({
      ...technologies,
      [name]: [...technologies[name], value],
    }));
  };
  const handleRemoveItem = (e, name, text) => {
    setTechnologies((technologies) => ({
      ...technologies,
      [name]: [...technologies[name].filter((item) => item !== text)],
    }));
  };

  return (
    <div className='col-span-7 box-big-shadow bg-primary-dark rounded-xl min-h-[225px] p-8'>
      <div className='grid gap-8'>
        <h1 className='text-md'>Please enter following information</h1>
        <div className='grid gap-10'>
          {Object.keys(technologies).map((label, key) => {
            return (
              <div
                key={key}
                className='grid sm:grid-cols-[max(70px),1fr] gap-4 h-min'
              >
                <div>
                  <h2 className='text-secondary-light text-sm mt-2'>{label}</h2>
                </div>

                <FormIconLists
                  handleInputSubmit={handleInputSubmit}
                  handleRemoveItem={handleRemoveItem}
                  name={label}
                  items={technologies[label]}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className='flex w-full items-end justify-end mt-8'>
        <PrimaryButton
          state='small'
          text={mode === 'create' ? 'DONE' : 'SAVE'}
          Icon={MdDone}
          classes={`!rounded-full`}
          onClick={() =>
            mode === 'create'
              ? handleCreateSettings({ technologies })
              : handleEditSettings({ technologies })
          }
        />
      </div>
    </div>
  );
};

export default Technologies;
