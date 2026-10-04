import { reqFileWrapper } from '../axios/requests';

// A project's card image: the first thumbnail, or the banner when it has none.
// width and height are present when the API sent them, and reserve the image's
// space before it loads.
export const projectCover = (project) => {
  const thumbnail = project?.thumbnailContents?.length
    ? project.thumbnailContents[0]
    : null;
  const size = thumbnail || project?.bannerImgSize || {};

  return {
    src: reqFileWrapper(thumbnail ? thumbnail.url : project?.bannerImg),
    width: size.width,
    height: size.height,
  };
};
