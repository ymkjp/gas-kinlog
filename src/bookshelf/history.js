const fs = require('fs')
const path = require('path')
const util = require('util')
const _ = require('lodash')
const validUrl = require('valid-url')
const readFile = util.promisify(fs.readFile)

const uniqTruthy = (list) => {
  return _.uniq(_.compact(list))
}

const createUrlList = async () => {
  const file = path.resolve('var/amazon-co-jp_order-history.tsv')
  const data = await readFile(file, 'utf-8')
  // console.info(data)
  const urls = data.split('\n').map(line => {
    const url = line.split('\t').pop()
    // console.info(`url: ${url}`)
    return validUrl.isUri(url) ? url : null
  })
  return uniqTruthy(urls)
}

module.exports.createUrlList = createUrlList
