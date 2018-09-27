const crypto = require('crypto')
const _ = require('lodash')
const LocalStorage = require('node-localstorage').LocalStorage
const sharedInstance = new LocalStorage('./LocalStorage', 5 * 1024 * 1024 * 1024)

const createKey = (obj) => {
  const str = JSON.stringify(obj)
  return crypto.createHash('sha256').update(str).digest('hex')
}

const storeData = (key, data) => {
  const serializedKey = _.isString(key) ? key : createKey(key)
  return sharedInstance.setItem(serializedKey, JSON.stringify(data))
}

const retrieveData = (key) => {
  const serializedKey = _.isString(key) ? key : createKey(key)
  const data = sharedInstance.getItem(serializedKey)
  return (data === null) ? data : JSON.parse(data)
}

module.exports.storeData = storeData
module.exports.retrieveData = retrieveData
module.exports.LocalStorage = LocalStorage
