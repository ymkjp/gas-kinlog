/**
 * MLIT mail magazine
*/
const WEBHOOK_URL = 'https://hooks.slack.com/services/__YOUR__PATH__'
const LABEL_ENQ = '#GAS/mlit-mm-enq'
const LABEL_DEQ = '#GAS/mlit-mm-deq'

/**
 * Walk through the target emails
 * https://developers.google.com/apps-script/reference/gmail/
 */
// eslint-disable-next-line no-unused-vars
const main = () => {
  const targetLabel = GmailApp.getUserLabelByName(LABEL_ENQ)
  const notifiedLabel = GmailApp.getUserLabelByName(LABEL_DEQ)
  const threads = targetLabel.getThreads().reverse()

  for (const i in threads) {
    const thread = threads[i]
    const messages = thread.getMessages()
    const results = []
    let body
    thread.removeLabel(targetLabel)
    for (const j in messages) {
      body = messages[j].getPlainBody()
      results.push(extract(body))
    }
    Logger.log(results.length)
    if (results.length > 0) {
      send(
        thread.getFirstMessageSubject(),
        results.join('\n\n'),
        thread.getPermalink())
    }
    thread.addLabel(notifiedLabel)
  }
  Logger.log('Done.')
}

/**
 * @param {GmailMessage} message
 * @returns {String} Tweet
 */
const extract = (message) => {
  return message
    .split('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛')
    .pop()
    .split('───────────────────────────────────')
    .shift()
    .trim()
}

/**
 * https://cloud.google.com/speech-to-text/docs/basics
 * https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app
 * @param {String} subject
 * @param {String} body
 * @param {String} url
 * @returns {String} content in JSON
 */
const send = (subject, body, url) => {
  const data = JSON.stringify({
    channel: '#mlit',
    username: 'MLIT',
    text: [`<${url}|${subject}>`, body].join('\n\n'),
    icon_emoji: ':motorway:'
  })
  Logger.log(data)
  try {
    const response = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'POST',
      payload: data,
      muteHttpExceptions: true
    })
    Logger.log(response)
    return response.getContentText()
  } catch (e) {
    Logger.log(e.message)
    throw e
  }
}
