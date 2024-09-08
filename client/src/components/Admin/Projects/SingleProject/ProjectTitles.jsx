import { useEffect, useState } from 'react';
import { IoArrowUp } from 'react-icons/io5';
import Input from '../../../Forms/Input';
import { handleInputValChange } from '../../../../utils/FormValidations/handleValueChange';
import PrimaryButton from '../../../Buttons/PrimaryButton';
import { MdDone } from 'react-icons/md';
import FormIconLists from '../../FormIconLists';

const ProjectTitles = ({
  mode,
  projectData,
  setFormMode,
  handleCreateProject,
  handleUpdateProjectInfos,
}) => {
  const [titlesData, setTitlesData] = useState({
    title: '',
    subtitle: '',
    overview: '',
    role: [],
    date: '',
    locationYear: '',
  });

  useEffect(() => {
    if (projectData?.id) {
      setTitlesData({
        title: projectData?.title,
        subtitle: projectData?.subtitle,
        overview: projectData?.overview,
        role: projectData?.role,
        date: projectData?.date,
        locationYear: projectData?.locationYear,
      });
    }
  }, [mode, projectData]);

  const handleInputSubmit = (e, name, value) => {
    setTitlesData((titlesData) => ({
      ...titlesData,
      [name]: [...titlesData[name], value],
    }));
  };

  const handleRemoveItem = (e, name, value) => {
    setTitlesData((titlesData) => ({
      ...titlesData,
      [name]: [...titlesData[name]?.filter((item) => item !== value)],
    }));
  };

  return (
    <div className='grid gap-8 col-span-10 lg:col-span-7'>
      <div className='box-big-shadow bg-primary-dark rounded-xl min-h-[225px] p-8 pb-11'>
        <div className='grid gap-8'>
          <h1 className='text-md'>Please enter following information</h1>
          <div className='grid gap-6'>
            <div className='grid gap-8 w-full md:grid-cols-2'>
              <Input
                label={'Project Title'}
                inputProps={{
                  value: titlesData.title,
                  onChange: (e) => handleInputValChange(e, setTitlesData),
                  name: 'title',
                }}
              />
              <Input
                label={'Project Subtitle'}
                inputProps={{
                  value: titlesData.subtitle,
                  onChange: (e) => handleInputValChange(e, setTitlesData),
                  name: 'subtitle',
                }}
              />
            </div>

            <Input
              textArea={true}
              label={'Overview'}
              classes={`w-full`}
              inputProps={{
                value: titlesData.overview,
                onChange: (e) => handleInputValChange(e, setTitlesData),
                name: 'overview',
                rows: 4,
              }}
            />

            <div className='grid gap-3 h-min'>
              <div>
                <h2 className='text-secondary-light text-sm'>Role</h2>
              </div>

              <FormIconLists
                type='horizontal'
                handleInputSubmit={handleInputSubmit}
                handleRemoveItem={handleRemoveItem}
                name={'role'}
                items={titlesData.role}
              />
            </div>

            <div className='grid gap-8 w-full md:grid-cols-2'>
              <Input
                label={'Location & Year'}
                inputProps={{
                  value: titlesData.locationYear,
                  onChange: (e) => handleInputValChange(e, setTitlesData),
                  name: 'locationYear',
                }}
              />
              <Input
                label={'Date'}
                inputProps={{
                  value: titlesData.date,
                  onChange: (e) => handleInputValChange(e, setTitlesData),
                  name: 'date',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className='flex w-full items-end justify-end'>
        <div className='flex items-center gap-3 justify-center'>
          <PrimaryButton
            // state='small'
            text={mode === 'create' ? 'Create Project' : 'NEXT PAGE'}
            Icon={mode === 'create' ? MdDone : null}
            classes={``}
            onClick={() =>
              mode === 'create'
                ? handleCreateProject(titlesData)
                : setFormMode('content')
            }
          />
          {mode === 'edit' && (
            <PrimaryButton
              // state='small'
              text={'UPDATE'}
              Icon={IoArrowUp}
              classes={``}
              onClick={() => handleUpdateProjectInfos(titlesData)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectTitles;
