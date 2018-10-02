const crypto = require('crypto')
const _ = require('lodash')
const localStorage = require('node-localstorage')

const sharedInstance = new localStorage.LocalStorage('./LocalStorage', 5 * 1024 * 1024 * 1024)

class Storage {
  constructor () {
    this.sharedInstance = sharedInstance
  }

  static createStorage (location, quota = 5 * 1024 * 1024 * 1024) {
    return new localStorage.LocalStorage(location, quota)
  }

  static createKey (obj) {
    const str = JSON.stringify(obj)
    return crypto.createHash('sha256').update(str).digest('hex')
  }

  storeData (key, data) {
    const serializedKey = _.isString(key) ? key : Storage.createKey(key)
    return this.sharedInstance.setItem(serializedKey, JSON.stringify(data))
  }

  retrieveData (key) {
    const serializedKey = _.isString(key) ? key : Storage.createKey(key)
    const data = this.sharedInstance.getItem(serializedKey)
    return (data === null) ? data : JSON.parse(data)
  }
}

module.exports = Storage
