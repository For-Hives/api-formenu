const removePropsRecursively = (obj) => {
  if (obj && typeof obj === 'object') {
    delete obj.createdBy;
    delete obj.updatedBy;

    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        removePropsRecursively(obj[key]);
      }
    }
  }
}

module.exports = { removePropsRecursively }
