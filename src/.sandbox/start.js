if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({
    path: __dirname + '/dev.env'
  })
}

require('../server')