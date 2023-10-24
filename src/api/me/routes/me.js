module.exports = {
  routes: [
    {
     method: 'POST',
     path: '/users/me',
     handler: 'me.updateMe',
     config: {
       policies: [],
       middlewares: [],
     },
    },
  ],
};
