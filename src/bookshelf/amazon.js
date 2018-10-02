// @flow
/**
 * Amazon Product Advertising API
 * https://affiliate.amazon.co.jp/assoc_credentials/home
 */
const _ = require('lodash')
const objectPath = require('object-path')
const apa = require('amazon-product-api')
const util = require('util')
const localStorage = require('./local-storage')
const sleep = util.promisify(setTimeout)

const client = apa.createClient({
  awsTag: process.env.PA_ASSOCIATE_TAG || '',
  awsId: process.env.PA_ACCESS_KEY || '',
  awsSecret: process.env.PA_SECRET_KEY || ''
})

// https://docs.aws.amazon.com/ja_jp/AWSECommerceService/latest/DG/LocaleJP.html
// https://docs.aws.amazon.com/AWSECommerceService/latest/DG/PerformingMultipleItemLookupsinOneRequest.html
const MAX_ITEMS = 1
const REQUEST_PER_MS = 2 * 1000
const COMMON_PARAMS = {
  'domain': 'webservices.amazon.co.jp'
}
// AWS.InvalidParameterValue
// https://docs.aws.amazon.com/AWSECommerceService/latest/DG/ErrorMessages.html
const KNOWN_INVALID_IDS = [
  'B0029RSXLK',
  'B005EGDV5G',
  'B000FQNKPQ',
  'B009DBB9UC',
  'B0032244N2',
  'B00024CKTS',
  'B005DPEZ4Y',
  'B00J2L7B8M',
  'B013FKFICG',
  'B004Y9J1TO',
  'B00PGIPZJC',
  'B000OQ20HQ',
  'B009E1QWPI',
  'B013U094TY',
  'B00X5M67YI'
]
const TARGET_CATEGORIES = ['Book', 'eBooks']
const extractTargetAsin = async (urlList) => {
  const itemIds = urlList.map(extractItemId).filter(id => !KNOWN_INVALID_IDS.includes(id))
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
    const response = await fetch(candidates, (itemIds.length > MAX_ITEMS) ? REQUEST_PER_MS : 0)
    result.push(response)
  }
  const asinList = _.flatten(result)
    .filter(v => !_.isError(v))
    .map(extractTargetAttributes)
  return _.compact(asinList)
}

const fetch = async (itemIds, waitFor) => {
  const payload = {
    ...COMMON_PARAMS,
    'Condition': 'All',
    'IncludeReviewsSummary': false,
    'ItemId': itemIds.join()
  }
  // console.debug('payload:', payload)
  const cache = localStorage.retrieveData(payload)
  if (cache !== null) {
    return cache
  }
  if (_.some(itemIds, isBlacklisted)) {
    return new Error(JSON.stringify({message: 'Some of items are blacklisted', itemIds: itemIds}))
  }
  try {
    const response = await client.itemLookup(payload)
    localStorage.storeData(payload, response)
    if (waitFor > 0) {
      console.log(`Sleeping for ${waitFor}ms ...`)
      await sleep(waitFor)
    }
    return response
  } catch (error) {
    const detail = JSON.stringify({error: error, itemIds: itemIds})
    console.error(detail)
    // if (isRetriable(error)) {
    //   console.log(`Retrying the request. Remaining retry budget is ${retry} times.`, detail)
    //   await sleep(2 * waitFor)
    //   const result = fetch(itemIds, waitFor, --retry)
    //   console.debug({result: result, ...detail})
    //   return result
    // }
    if (itemIds.length === 1 && isAvoidableItem(error)) {
      blacklist(itemIds.pop())
    }
    return new Error(detail)
  }
}

const KEY_INVALID_ITEM = '__BLACKLIST_ITEMS'
const blacklist = (itemId) => {
  console.debug('Registering to blacklist:', {itemId: itemId})
  const blacklist = localStorage.retrieveData(KEY_INVALID_ITEM) || []
  blacklist.push(itemId)
  return localStorage.storeData(KEY_INVALID_ITEM, blacklist)
}

const isBlacklisted = (itemId) => {
  const blacklist = localStorage.retrieveData(KEY_INVALID_ITEM) || []
  return blacklist.includes(itemId)
}

const AVOIDALE_ERRORS = ['AWS.ECommerceService.ItemNotAccessible']
const isAvoidableItem = (error) => {
  // [{"Error":[{"Code":["AWS.ECommerceService.ItemNotAccessible"], ...
  if (!(_.isArray(error) && error.length > 0)) {
    return false
  }
  const e = objectPath(error.shift()).get('Error', []).shift() || {}
  const code = objectPath(e).get('Code', []).shift() || ''
  return AVOIDALE_ERRORS.includes(code)
}

// const RETRIABLE_ERRORS = ['RequestThrottled']
// const isRetriable = (error) => {
// //   // "Error":[{"Code":["RequestThrottled"], ...
// //   const e = objectPath(error).get('Error', []).shift() || {}
// //   const code = objectPath(e).get('Code', []).shift() || ''
// //   return RETRIABLE_ERRORS.includes(code)
// // }

const extractTargetAttributes = (result) => {
  console.debug('result:', result)
  const item = objectPath(result)
  const itemId = item.get('ASIN', []).shift() || ''
  const itemAttributes = item.get('ItemAttributes', []).shift()
  console.debug('itemAttributes:', itemAttributes)
  const ia = objectPath(itemAttributes)
  const isAdultProduct = ia.get('IsAdultProduct', []).shift() || ''
  const category = ia.get('ProductGroup', []).shift() || ''
  console.debug(JSON.stringify({
    itemId: itemId,
    isAdultProduct: isAdultProduct,
    category: category
  }), !!itemId, !parseInt(isAdultProduct, 10), TARGET_CATEGORIES.includes(category))
  return (
    !!itemId &&
    !parseInt(isAdultProduct, 10) &&
    TARGET_CATEGORIES.includes(category)
  ) ? itemId : null
}

const REGEXP_ASIN = /gp\/product\/(\w{10})/
const extractItemId = (url) => {
  const r = url.match(REGEXP_ASIN)
  return r !== null && r.hasOwnProperty(1) ? r[1] : null
}

const SAMPLE_LINKS = [
  'https://www.amazon.co.jp/gp/product/4130628348/ref=oh_aui_detailpage_o07_s00?ie=UTF8&psc=1',
  'https://www.amazon.co.jp/gp/product/B00DNMG8Q2/ref=oh_aui_d_detailpage_o08_?ie=UTF8&psc=1',
  'https://www.amazon.co.jp/gp/product/B004MKLQW0/ref=oh_aui_detailpage_o09_s00?ie=UTF8&psc=1'
]
if (require.main === module) {
  extractTargetAsin(SAMPLE_LINKS)
    .then(r => console.log(r))
    .catch(e => console.error(JSON.stringify(e)))
}
module.exports.extractTargetAsin = extractTargetAsin
