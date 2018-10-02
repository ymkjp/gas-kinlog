// @flow
/**
 * https://booklog.jp/input
 */

const os = require('os')
const _ = require('lodash')
const $ = require('cheerio')
const qs = require('qs')
const axios = require('axios')

const MAX_ENTRIES = 100
const COMMON_PARAMS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': ['text/html'].join()
}
axios.defaults.withcredential = true

class Booklog {
  constructor () {
    this.client = axios.create({
      baseURL: 'https://booklog.jp'
    })
    this.credential = {
      username: process.env.BOOKLOG_USERNAME,
      password: process.env.BOOKLOG_PASSWORD
    }
  }

  async auth (credential) {
    const response = await this.client.post('/login', {
      'account': credential.username,
      'password': credential.password
    })
    if (response.status >= 400) {
      throw new Error(response.statusText)
    }
    if (!response.headers.hasOwnProperty('set-cookie')) {
      throw new Error(`No 'set-cookie' in headers. Failed to login with username:${credential.username}.`)
    }
    const cookies = _.compact(response.headers['set-cookie'].map(cookie => cookie.split(';').shift()))
    if (cookies.length < 1) {
      throw new Error(`No cookie found in the 'set-cookie' header: ${response}.`)
    }
    return cookies
  }

  async input (cookies, asinList) {
    const payload = {
      'isbns': asinList.join('\n'),
      'category_id': '0', // No category
      'status': '4' // Tsundoku
    }
    console.debug('payload:', payload)
    const response = await this.client.post('/input', qs.stringify(payload), {
      headers: { ...COMMON_PARAMS, Cookie: cookies.join(';') }
    })
    if (response.status >= 400) {
      return new Error(response.statusText)
    }
    console.debug('response:', response)
    return response.data
  }
  format (asinList, resultList) {
    const messageList = _.flatten(resultList.map(data => {
      const $registration = $(data)('.tcpink.t10M,.tcblue.t10M')
      console.debug('$registration:', $registration)
      return $registration.length > 1 ? $registration.map((_, s) => $(s).text()) : null
    }))
    console.debug('length:', {
      asinList: asinList.length,
      resultList: resultList.length,
      messageList: messageList.length
    })
    return _.zipObject(asinList, messageList)
  }

  async register (asinList) {
    const cookies = await this.auth(this.credential)
    console.debug('cookies:', cookies)
    const resultList = []
    for (let i = 0; i < Math.ceil(asinList.length / MAX_ENTRIES); ++i) {
      const s = i * MAX_ENTRIES
      const result = await this.input(cookies, asinList.slice(s, s + MAX_ENTRIES + 1))
      resultList.push(result)
    }
    return this.format(asinList, resultList)
  }

  static output (asinList) {
    const result = []
    for (let i = 0; i < Math.ceil(asinList.length / MAX_ENTRIES); ++i) {
      const s = i * MAX_ENTRIES
      const list = asinList.slice(s, s + MAX_ENTRIES)
      // console.debug('output:', {
      //   i: i,
      //   s: s,
      //   'list.length': list.length
      // })
      result.push(list.join(os.EOL))
    }
    return result
  }
}

const SAMPLE_ASINS = ['4130628348', 'B00DNMG8Q2']
if (require.main === module) {
  const b = new Booklog()
  b.register(SAMPLE_ASINS)
    .then(r => console.log(r))
    .catch(e => console.error(JSON.stringify(e)))
}
module.exports = Booklog
