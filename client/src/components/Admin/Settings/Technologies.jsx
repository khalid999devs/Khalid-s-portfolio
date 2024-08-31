import React, { useEffect, useState } from 'react';
import IconedInput from '../../Forms/IconedInput';

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

  return (
    <div className='col-span-5 box-big-shadow bg-primary-dark rounded-xl min-h-[225px] p-8'>
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

                <div className='grid gap-5'>
                  <div className='max-w-[180px] w-full'>
                    <IconedInput />
                  </div>
                  <div></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Technologies;
