/**
 * Register Kindle books to booklog.jp
 */
const LABEL_ENQ = '#GAS/kinlog-enq'
const LABEL_DEQ = '#GAS/kinlog-deq'
const MAX_QUEUE = 10

/**
 * Walk through the target emails
 * https://developers.google.com/apps-script/reference/gmail/
 */
// eslint-disable-next-line no-unused-vars
const main = () => {
  const targetLabel = GmailApp.getUserLabelByName(LABEL_ENQ)
  const notifiedLabel = GmailApp.getUserLabelByName(LABEL_DEQ)
  const threads = targetLabel.getThreads(0, MAX_QUEUE).reverse()

  if (threads < 1) {
    Logger.log('Aborting... The queue is empty.')
    return
  }
  const scriptProperties = PropertiesService.getScriptProperties()
  const cookies = auth(
    scriptProperties.getProperty('booklog.jp:username'),
    scriptProperties.getProperty('booklog.jp:password'))
  threads.forEach(thread => {
    const asins = thread.getMessages().map(message => {
      return extractAsins(message.getBody())
    })
    Logger.log(`[${thread.getFirstMessageSubject()}] ASIN: ${asins.join()}`)
    if (asins.length > 0) {
      register(cookies, flatten(asins))
    }
    thread
      .removeLabel(targetLabel)
      .addLabel(notifiedLabel)
    if (threads.length > 1) {
      // 10ms
      Utilities.sleep(10)
    }
  })
  Logger.log('Done.')
}

const flatten = (list) => {
  return [].concat.apply([], list)
}

const isUnique = (v, i, a) => {
  return a.indexOf(v) === i
}

const REGEXP_ASIN = /dp%2F.{10}/g
const extractAsins = (body) => {
  const list = body.match(REGEXP_ASIN)
  if (list === null) {
    return []
  }
  return list.map(asin => {
    return asin.slice(-10)
  }).filter(isUnique)
}

/**
 * @returns {[String]} Cookies
 */
const auth = (username, password) => {
  const options = {
    method: 'post',
    followRedirects: false,
    payload: {
      'account': username,
      'password': password
    }
  }
  Logger.log(`Logging in as ${username}`)
  const response = UrlFetchApp.fetch('https://booklog.jp/login', options)
  const headers = response.getAllHeaders()
  if (typeof headers['Set-Cookie'] === 'undefined') {
    throw new Error(`[username:${username}] Authentication failed`)
  }
  const cookies = typeof headers['Set-Cookie'] === 'string' ? [ headers['Set-Cookie'] ] : headers['Set-Cookie']
  return cookies.map((cookie) => {
    return cookie.split(';')[0]
  })
}

const REGEXP_RESULT = /.*tc(?:pink|blue) t10M.*/g
const REGEXP_MESSAGE = />(.*)</
const register = (cookies, asins) => {
  const options = {
    method: 'post',
    payload: {
      'isbns': asins.join('\n'),
      'category_id': '0', // No category
      'status': '4' // Tsundoku
    },
    headers: {
      'Cookie': cookies.join(';')
    }
  }

  const response = UrlFetchApp.fetch('https://booklog.jp/input', options)
  const result = response.getContentText().match(REGEXP_RESULT)
  if (result !== null) {
    result.forEach(result => {
      const message = result.match(REGEXP_MESSAGE)
      return message.hasOwnProperty(1) ? Logger.log(`${message[1]}: ${asins.join()}`) : null
    })
  }
  return response
}
