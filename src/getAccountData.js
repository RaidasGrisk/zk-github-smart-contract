
const url = 'https://berkeley.graphql.minaexplorer.com/'
// const url = 'https://graphql.minaexplorer.com/'
const publicKey = 'B62qr8tFfnB7FANuJYnfwvffh8ERr2Nv8MZPZtER8NgJ811uJvQrSGM'
// const publicKey = 'B62qnuJGE11DiYL1WJm1UQafjMvqinEZfXK2i2K9TNwMY27iKTxmGWd'

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: `
    query MyQuery {
      zkapps(query: {zkappCommand: {accountUpdates: {body: {publicKey: \"${publicKey}"\}}}}) {
        hash
        blockHeight
        dateTime
        zkappCommand {
          feePayer {
            body {
              publicKey
            }
          }
        }
      }
    }

      `
  }),
})
const response_ = await response.json()
console.log(JSON.stringify(response_, null, 2))

export {}
