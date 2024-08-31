export const handleInputValChange = (e, setVal) => {
  setVal((value) => ({ ...value, [e.target.name]: e.target.value }));
};
