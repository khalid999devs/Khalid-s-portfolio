import { useEffect, useRef, useState } from 'react';
import PrimaryButton from '../../../Buttons/PrimaryButton';
import { MdDone } from 'react-icons/md';
import Input from '../../../Forms/Input';
import { handleInputValChange } from '../../../../utils/FormValidations/handleValueChange';
import FormIconLists from '../../FormIconLists';
import PropTypes from 'prop-types';

const createDraft = (projectData = {}) => ({
  siteLink: projectData.siteLink || '',
  designLink: projectData.designLink || '',
  codeLink: projectData.codeLink || '',
  techStack: Array.isArray(projectData.techStack)
    ? [...projectData.techStack]
    : [],
});

const LinksAndTechs = ({ mode, projectData, handleSubmitData, disabled }) => {
  const [data, setData] = useState(() => createDraft());
  const [isDirty, setIsDirty] = useState(false);
  const initializedProjectIdRef = useRef(null);

  useEffect(() => {
    const projectId = projectData?.id || null;

    if (!projectId) {
      if (initializedProjectIdRef.current !== null) {
        initializedProjectIdRef.current = null;
        setData(createDraft());
        setIsDirty(false);
      }
      return;
    }

    const projectChanged = initializedProjectIdRef.current !== projectId;
    if (!projectChanged && isDirty) return;

    initializedProjectIdRef.current = projectId;
    setData(createDraft(projectData));
    if (projectChanged) setIsDirty(false);
  }, [isDirty, projectData]);

  const handleInputSubmit = (e, name, value) => {
    setIsDirty(true);
    setData((data) => ({
      ...data,
      [name]: [...data[name], value],
    }));
  };
  const handleRemoveItem = (e, name, text) => {
    setIsDirty(true);
    setData((data) => ({
      ...data,
      [name]: [...data[name].filter((item) => item !== text)],
    }));
  };

  const handleSave = async () => {
    const saved = await handleSubmitData(data);
    if (saved) setIsDirty(false);
  };

  return (
    <div className='box-big-shadow bg-primary-dark rounded-xl min-h-[225px] p-8 col-span-10 lg:col-span-6'>
      <div className='grid gap-8'>
        <div className='grid gap-8 w-full md:grid-cols-2'>
          <Input
            label={'Live Sitelink'}
            inputProps={{
              value: data.siteLink || '',
              onChange: (e) => {
                setIsDirty(true);
                handleInputValChange(e, setData);
              },
              name: 'siteLink',
            }}
          />
          <Input
            label={'GitHub Code Link'}
            inputProps={{
              value: data.codeLink || '',
              onChange: (e) => {
                setIsDirty(true);
                handleInputValChange(e, setData);
              },
              name: 'codeLink',
            }}
          />
        </div>
        <div className='grid gap-8 w-full md:grid-cols-1'>
          <Input
            label={'Design Link'}
            inputProps={{
              value: data.designLink || '',
              onChange: (e) => {
                setIsDirty(true);
                handleInputValChange(e, setData);
              },
              name: 'designLink',
            }}
          />
        </div>
        <div className='grid sm:grid-cols-[70px_1fr] gap-4 h-min'>
          <div>
            <h2 className='text-muted-light text-sm mt-2'>Tech Stack</h2>
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
          disabled={disabled}
          state='small'
          text={mode === 'create' ? 'DONE' : 'SAVE'}
          Icon={MdDone}
          classes='rounded-full!'
          onClick={handleSave}
        />
      </div>
    </div>
  );
};


LinksAndTechs.propTypes = {
  mode: PropTypes.string,
  projectData: PropTypes.shape({
    id: PropTypes.number,
    siteLink: PropTypes.string,
    designLink: PropTypes.string,
    codeLink: PropTypes.string,
    techStack: PropTypes.array,
  }),
  handleSubmitData: PropTypes.func,
  disabled: PropTypes.bool,
};

export default LinksAndTechs;
