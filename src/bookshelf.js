const Amazon = require('./bookshelf/amazon')
const Booklog = require('./bookshelf/booklog')
const History = require('./bookshelf/history')

class Bookshelf {
  constructor () {
    this.amazon = new Amazon()
    this.history = new History()
    this.booklog = new Booklog()
  }

  async main () {
    const urls = await this.history.createUrlList()
    if (urls.length < 1) {
      return console.log('Aborting... No URLs specified!')
    }
    console.log('urls.length:', urls.length)
    const asinList = await this.amazon.extractTargetAsin(urls)
    if (asinList.length > 0) {
      return Booklog.output(asinList)
    }
    console.log('Aborting... No ASIN left!')
    return null
  }
}

if (require.main === module) {
  const bs = new Bookshelf()
  bs.main()
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => console.error(JSON.stringify(error)))
}
