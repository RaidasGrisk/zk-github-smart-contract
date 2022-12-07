
const url = 'https://proxy.berkeley.minaexplorer.com/graphql'
// const url = 'https://graphql.minaexplorer.com/'
const publicKey = 'B62qr8tFfnB7FANuJYnfwvffh8ERr2Nv8MZPZtER8NgJ811uJvQrSGM'
// const publicKey = 'B62qnuJGE11DiYL1WJm1UQafjMvqinEZfXK2i2K9TNwMY27iKTxmGWd'

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: `
      query MyQuery {
        transactions(limit: 5, sortBy: DATETIME_DESC, query: {from: \"${publicKey}"\}) {
          from
          to
          nonce
          amount
          hash
        }
      }
      `
  }),
})
  .then((res) => res.json())
  .then((result) => console.log(result));

export {}
