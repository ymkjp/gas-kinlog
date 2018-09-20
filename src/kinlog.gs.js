/**
 * Kindle
 */
const LABEL_ENQ = '#GAS/kinlog-enq'
const LABEL_DEQ = '#GAS/kinlog-deq'

/**
 * Walk through the target emails
 * https://developers.google.com/apps-script/reference/gmail/
 */
// eslint-disable-next-line no-unused-vars
const main = () => {
  const targetLabel = GmailApp.getUserLabelByName(LABEL_ENQ)
  const notifiedLabel = GmailApp.getUserLabelByName(LABEL_DEQ)
  const threads = targetLabel.getThreads().reverse()

  if (threads <= 0) {
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
    Logger.log(`[${thread.getFirstMessageSubject()}] ${asins}`)
    register(cookies, flatten(asins))
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

const extractAsins = (body) => {
  const list = body.match(/dp%2F.{10}/g)
  if (list === null) {
    return []
  }
  return list.map(asin => {
    return asin.slice(-10)
  }).filter((v, i, a) => a.indexOf(v) === i)
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
  Logger.log(options)
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
const REGEXP_TITLE = />(.*)</
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
  response.getContentText().match(REGEXP_RESULT).forEach(result => {
    Logger.log(result.match(REGEXP_TITLE)[1])
  })
  return response
}
