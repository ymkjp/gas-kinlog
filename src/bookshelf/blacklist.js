// @flow
const _ = require('lodash')
const objectPath = require('object-path')
const Storage = require('./storage')

const KEY_INVALID_ITEM = '__BLACKLIST_ITEMS'
const AVOIDABLE_ERRORS = [
  'AWS.ECommerceService.ItemNotAccessible',
  'AWS.InvalidParameterValue'
]

class Blacklist {
  constructor () {
    this.storage = new Storage()
    this.blacklist = this.storage.retrieveData(KEY_INVALID_ITEM) || []
  }

  add (itemId) {
    console.debug('Registering to blacklist:', {itemId: itemId})
    this.blacklist.push(itemId)
    return this.storage.storeData(KEY_INVALID_ITEM, this.blacklist)
  }

  isListed (itemId) {
    return this.blacklist.includes(itemId)
  }

  static isInvalidItem (error) {
    // [{"Error":[{"Code":["AWS.ECommerceService.ItemNotAccessible"], ...
    if (!(_.isArray(error) && error.length > 0)) {
      return false
    }
    const e = objectPath(error.shift()).get('Error', []).shift() || {}
    const code = objectPath(e).get('Code', []).shift() || ''
    return AVOIDABLE_ERRORS.includes(code)
  }
}
if (require.main === module) {
}
module.exports = Blacklist
