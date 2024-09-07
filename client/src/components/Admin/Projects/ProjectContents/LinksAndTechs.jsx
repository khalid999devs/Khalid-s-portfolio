import React, { useEffect, useState } from 'react';
import PrimaryButton from '../../../Buttons/PrimaryButton';
import { MdDone } from 'react-icons/md';
import Input from '../../../Forms/Input';
import { handleInputValChange } from '../../../../utils/FormValidations/handleValueChange';
import FormIconLists from '../../FormIconLists';

const LinksAndTechs = ({ mode, projectData, handleSubmitData }) => {
  const [data, setData] = useState({
    siteLink: '',
    codeLink: '',
    techStack: [],
  });

  useEffect(() => {
    if (projectData?.id) {
      setData({
        siteLink: projectData?.siteLink,
        codeLink: projectData?.codeLink,
        techStack: projectData?.techStack,
      });
    }
  }, [mode]);

  const handleInputSubmit = (e, name, value) => {
    setData((data) => ({
      ...data,
      [name]: [...data[name], value],
    }));
  };
  const handleRemoveItem = (e, name, text) => {
    setData((data) => ({
      ...data,
      [name]: [...data[name].filter((item) => item !== text)],
    }));
  };

  return (
    <div className='box-big-shadow bg-primary-dark rounded-xl min-h-[225px] p-8 col-span-10 lg:col-span-6'>
      <div className='grid gap-8'>
        <div className='grid gap-8 w-full md:grid-cols-2'>
          <Input
            label={'Live Sitelink'}
            inputProps={{
              value: data.siteLink,
              onChange: (e) => handleInputValChange(e, setData),
              name: 'siteLink',
            }}
          />
          <Input
            label={'GitHub Code Link'}
            inputProps={{
              value: data.codeLink,
              onChange: (e) => handleInputValChange(e, setData),
              name: 'codeLink',
            }}
          />
        </div>
        <div className='grid sm:grid-cols-[max(70px),1fr] gap-4 h-min'>
          <div>
            <h2 className='text-secondary-light text-sm mt-2'>Tech Stack</h2>
          </div>

          <FormIconLists
            handleInputSubmit={handleInputSubmit}
            handleRemoveItem={handleRemoveItem}
            name={'techStack'}
            items={data.techStack}
          />
        </div>
      </div>

      <div className='flex w-full items-end justify-end mt-8'>
        <PrimaryButton
          state='small'
          text={mode === 'create' ? 'DONE' : 'SAVE'}
          Icon={MdDone}
          classes={`!rounded-full`}
          onClick={() => handleSubmitData(data)}
        />
      </div>
    </div>
  );
};

export default LinksAndTechs;
