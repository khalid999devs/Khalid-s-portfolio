const MAX_PROJECT_ID = 2_147_483_647;

const isObjectRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

const isStringArray = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isMediaArray = (value) =>
  Array.isArray(value) &&
  value.every(
    (item) => isObjectRecord(item) && isNonEmptyString(item.url)
  );

export const parseProjectIdFromRoute = (routeValue) => {
  const idSegment = String(routeValue || '').split('@').at(-1);
  if (!/^[1-9]\d{0,9}$/u.test(idSegment)) return null;

  const projectId = Number(idSegment);
  return projectId <= MAX_PROJECT_ID ? projectId : null;
};

export const isValidProjectResponse = (data, expectedProjectId) => {
  if (
    !isObjectRecord(data) ||
    data.succeed !== true ||
    !isObjectRecord(data.result)
  ) {
    return false;
  }

  const project = data.result;

  return (
    Number.isSafeInteger(expectedProjectId) &&
    project.id === expectedProjectId &&
    isNonEmptyString(project.title) &&
    isNonEmptyString(project.value) &&
    typeof project.subtitle === 'string' &&
    typeof project.overview === 'string' &&
    isStringArray(project.role) &&
    isStringArray(project.techStack) &&
    isMediaArray(project.videos) &&
    isMediaArray(project.thumbnailContents) &&
    isMediaArray(project.sliderContents)
  );
};
