const path = require('path')
const express = require('express')
const app = express()
const minifyHTML = require('express-minify-html')

// configurations and middlewares
app.set('view engine', 'ejs')
app.set('views', path.resolve(__dirname + '/../views'))
app.use(
  express.static(path.resolve(__dirname + '/../public'), {
    maxAge: process.env.NODE_ENV !== 'production' ? 0 : 31536000
  }),
  minifyHTML({
    override: true,
    exception_url: false,
    htmlMinifier: {
        removeComments: true,
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        removeAttributeQuotes: false,
        removeEmptyAttributes: true,
        minifyJS: true
    }
  })
)

app.get('/', (req, res) => {
  res.render('app', {
    ns: process.env.APP_NS
  })
})

module.exports = app