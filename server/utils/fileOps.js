const deleteFile = require('./deleteFile');
const { toStoredUploadPath } = require('./uploadPaths');

const deleteMultipleFiles = async (files) => {
  await Promise.all(files.map((file) => {
    if (file.path) {
      return deleteFile(toStoredUploadPath(file.path));
    }
    if (file.url) return deleteFile(file.url);
    return false;
  }));
};

const addFileToStructure = (pathParts, file, currentNode) => {
  const filteredPathParts = pathParts.filter((part) => part.trim() !== '');

  for (let i = 0; i < filteredPathParts.length; i++) {
    const part = filteredPathParts[i];
    let nextNode = currentNode.children.find((child) => child.name === part);

    if (!nextNode) {
      if (i === filteredPathParts.length) {
        nextNode = { name: file.originalname, type: 'file', file: file };
      } else {
        nextNode = { name: part, type: 'folder', path: '', children: [] };
      }
      currentNode.children.push(nextNode);
    }

    currentNode = nextNode;
  }
};

module.exports = {
  deleteMultipleFiles,
  addFileToStructure,
};
