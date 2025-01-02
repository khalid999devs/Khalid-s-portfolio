import { useEffect, useRef, useState } from 'react';
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
  categories,
  handleCreateProject,
  handleUpdateProjectInfos,
}) => {
  const [titlesData, setTitlesData] = useState({
    title: '',
    subtitle: '',
    overview: '',
    role: [],
    category: '',
    date: '',
    locationYear: '',
  });
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [isSuggestion, setIsSuggestion] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    if (projectData?.id) {
      setTitlesData({
        title: projectData?.title,
        subtitle: projectData?.subtitle,
        overview: projectData?.overview,
        role: projectData?.role,
        category: projectData?.category,
        date: projectData?.date,
        locationYear: projectData?.locationYear,
      });
    }
  }, [mode, projectData]);

  useEffect(() => {
    if (categories?.length > 0) setFilteredCategories(categories);
  }, [categories]);

  useEffect(() => {
    if (titlesData.category) {
      setFilteredCategories(
        categories.filter((item) =>
          item.toLowerCase().includes(titlesData.category.toLowerCase())
        )
      );
    }
  }, [titlesData.category]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (formRef.current && !formRef.current.contains(event.target)) {
        setIsSuggestion(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
              <form
                className='relative'
                ref={formRef}
                onSubmit={(e) => {
                  e.preventDefault();

                  if (filteredCategories.length > 0) {
                    setTitlesData((titlesData) => ({
                      ...titlesData,
                      category: filteredCategories[0],
                    }));
                    setIsSuggestion(false);
                  }
                }}
              >
                <Input
                  label={'Category'}
                  inputProps={{
                    value: titlesData.category,
                    name: 'category',
                    autoComplete: 'off',
                    placeholder: 'Website',
                    onChange: (e) => {
                      !isSuggestion && setIsSuggestion(true);
                      e.target.value === '' && setIsSuggestion(false);
                      if (
                        e.target.value?.toLowerCase() ===
                        filteredCategories[0]?.toLowerCase()
                      ) {
                        setTitlesData((titlesData) => ({
                          ...titlesData,
                          category: filteredCategories[0],
                        }));
                      } else handleInputValChange(e, setTitlesData);
                    },
                  }}
                />
                {isSuggestion && (
                  <div
                    id='tooltip'
                    className='absolute top-[102%] left-0 w-full bg-secondary-main rounded-lg grid max-h-[150px] h-auto overflow-auto z-20'
                  >
                    {filteredCategories.map((item, key) => {
                      return (
                        <div
                          key={key}
                          className={`w-full py-3 px-3 ${
                            key + 1 != filteredCategories.length
                              ? 'border-b border-b-1 border-b-primary-main border-opacity-30'
                              : ''
                          } capitalize cursor-pointer transition-all duration-300 hover:bg-neutral-700 text-sm`}
                          onClick={() =>
                            setTitlesData((titlesData) => ({
                              ...titlesData,
                              category: item,
                            }))
                          }
                        >
                          {item}
                        </div>
                      );
                    })}
                  </div>
                )}
              </form>
            </div>

            <div className='grid gap-8 w-full md:grid-cols-2'>
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
