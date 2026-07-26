require('dotenv').config();
require('express-async-errors');
const express = require('express');
const app = express();
// Validates configuration before anything binds a port, so a missing or weak
// secret is a clear startup failure rather than a silent default. Reported as
// one readable line: an operator reading a deploy log should not have to parse
// a stack trace to learn that a variable is missing.
let env;
try {
  env = require('./config/env');
} catch (error) {
  console.error(`\nConfiguration error: ${error.message}\n`);
  process.exit(1);
}
const db = require('./models');
const cookieParser = require('cookie-parser');
const cors = require('cors');

//cors
const whitelist = env.allowedOrigins;
const corOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200,
  credentials: true,
};

app.use(cors(corOptions));

//middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Was `cookieParser('secret')` -- the signing key for every session cookie was
// a literal committed to this file, so anyone reading the repository could
// forge a validly signed cookie.
app.use(cookieParser(env.cookieSecret));

app.use('/uploads', express.static(__dirname + '/uploads'));

//routers
const adminRouter = require('./routers/admin');
const contactRouter = require('./routers/contact');
const projectRouter = require('./routers/projects');
const settingRouter = require('./routers/settings');

app.use('/api/admin', adminRouter);
app.use('/api/contact', contactRouter);
app.use('/api/projects', projectRouter);
app.use('/api/settings', settingRouter);

//notfound and errors
const errorHandlerMiddleWare = require('./middlewares/errorHandler');
const notFoundMiddleWare = require('./middlewares/notFound');

app.use(notFoundMiddleWare);
app.use(errorHandlerMiddleWare);

//ports and start
const PORT = process.env.PORT || 8000;
db.sequelize
  .sync()
  .then((_) => {
    console.log(`database connected`);
    app.listen(PORT, () => {
      console.log(`server is running on port ${PORT}...`);
    });
  })
  .catch((err) => {
    console.log(err);
  });
