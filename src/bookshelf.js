const amazon = require('./bookshelf/amazon')
const booklog = require('./bookshelf/booklog')
const history = require('./bookshelf/history')

const main = async () => {
  const urls = await history.createUrlList()
  if (urls.length < 1) {
    return console.log('Aborting... No URLs specified!')
  }
  console.log('urls.length:', urls.length)
  const asinList = await amazon.extractTargetAsin(urls)
  if (asinList.length > 0) {
    return booklog.output(asinList)
  }
  console.log('Aborting... No ASIN left!')
  return null
}

main()
  .then(result => console.log(JSON.stringify(result)))
  .catch(error => console.log(JSON.stringify(error)))
