// @flow
/**
 * Amazon Product Advertising API
 * https://affiliate.amazon.co.jp/assoc_credentials/home
 */
const _ = require('lodash')
const objectPath = require('object-path')
const apa = require('amazon-product-api')
const util = require('util')
const Storage = require('./storage')
const Blacklist = require('./blacklist')
const sleep = util.promisify(setTimeout)

// https://docs.aws.amazon.com/ja_jp/AWSECommerceService/latest/DG/LocaleJP.html
// https://docs.aws.amazon.com/AWSECommerceService/latest/DG/PerformingMultipleItemLookupsinOneRequest.html
const MAX_ITEMS = 1
const REQUEST_PER_MS = 2 * 1000
const COMMON_PARAMS = {
  'domain': 'webservices.amazon.co.jp'
}
// AWS.InvalidParameterValue
// https://docs.aws.amazon.com/AWSECommerceService/latest/DG/ErrorMessages.html
const TARGET_CATEGORIES = ['Book', 'eBooks']
const REGEXP_ASIN = /gp\/product\/(\w{10})/

class Amazon {
  constructor () {
    this.client = apa.createClient({
      awsTag: process.env.PA_ASSOCIATE_TAG || '',
      awsId: process.env.PA_ACCESS_KEY || '',
      awsSecret: process.env.PA_SECRET_KEY || ''
    })
    this.blacklist = new Blacklist()
    this.storage = new Storage()
  }

  async extractTargetAsin (urlList) {
    const itemIds = urlList.map(Amazon.extractItemId).filter(id => !this.blacklist.isListed(id))
    const result = []
    for (let i = 0; i < Math.ceil(itemIds.length / MAX_ITEMS); ++i) {
      const s = i * MAX_ITEMS
      const candidates = itemIds.slice(s, s + MAX_ITEMS)
      console.log(`Fetching...`, {
        i: i,
        s: s,
        itemLength: itemIds.length,
        candidatesLength: candidates.length,
        completingAt: Math.ceil(itemIds.length / MAX_ITEMS)
      })
      try {
        const response = await this.fetch(candidates, (itemIds.length > MAX_ITEMS) ? REQUEST_PER_MS : 0)
        result.push(response)
      } catch (e) {
        console.error('Error:', e)
      }
    }
    const asinList = _.flatten(result)
      .filter(v => !_.isError(v))
      .map(Amazon.extractTargetAttributes)
    return _.compact(asinList)
  }

  async fetch (itemIds, waitFor = 0) {
    const payload = {
      ...COMMON_PARAMS,
      'Condition': 'All',
      'IncludeReviewsSummary': false,
      'ItemId': itemIds.join()
    }
    // console.debug('payload:', payload)
    const cache = this.storage.retrieveData(payload)
    if (cache !== null) {
      return cache
    }
    try {
      const response = await this.client.itemLookup(payload)
      this.storage.storeData(payload, response)
      if (waitFor > 0) {
        console.log(`Sleeping for ${waitFor}ms ...`)
        await sleep(waitFor)
      }
      return response
    } catch (error) {
      const detail = JSON.stringify({error: error, itemIds: itemIds})
      console.error(detail)
      if (itemIds.length === 1 && Blacklist.isInvalidItem(error)) {
        this.blacklist.add(itemIds.pop())
      }
      return new Error(detail)
    }
  }

  static extractTargetAttributes (result) {
    // console.debug('result:', result)
    const item = objectPath(result)
    const itemId = item.get('ASIN', []).shift() || ''
    const itemAttributes = item.get('ItemAttributes', []).shift()
    // console.debug('itemAttributes:', itemAttributes)
    const ia = objectPath(itemAttributes)
    const isAdultProduct = ia.get('IsAdultProduct', []).shift() || ''
    const category = ia.get('ProductGroup', []).shift() || ''
    // console.debug(JSON.stringify({
    //   itemId: itemId,
    //   isAdultProduct: isAdultProduct,
    //   category: category
    // }), !!itemId, !parseInt(isAdultProduct, 10), TARGET_CATEGORIES.includes(category))
    return (
      !!itemId &&
      !parseInt(isAdultProduct, 10) &&
      TARGET_CATEGORIES.includes(category)
    ) ? itemId : null
  }

  static extractItemId (url) {
    const r = url.match(REGEXP_ASIN)
    return r !== null && r.hasOwnProperty(1) ? r[1] : null
  }
}

const SAMPLE_LINKS = [
  'https://www.amazon.co.jp/gp/product/4130628348/ref=oh_aui_detailpage_o07_s00?ie=UTF8&psc=1',
  'https://www.amazon.co.jp/gp/product/B00DNMG8Q2/ref=oh_aui_d_detailpage_o08_?ie=UTF8&psc=1',
  'https://www.amazon.co.jp/gp/product/B004MKLQW0/ref=oh_aui_detailpage_o09_s00?ie=UTF8&psc=1'
]
if (require.main === module) {
  const amazon = new Amazon()
  amazon.extractTargetAsin(SAMPLE_LINKS)
    .then(r => console.log(r))
    .catch(e => console.error(JSON.stringify(e)))
}
module.exports = Amazon
