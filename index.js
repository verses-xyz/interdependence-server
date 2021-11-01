require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')

const app = express()
app.use(bodyParser.urlencoded({ extended: true }))

const port = process.env.PORT || 8080
const TWEET_TEMPLATE = "Verifying my identity to sign the Declaration of Interdependence: "
const Twitter = require('twitter')
const {checkIfVerified, persistVerification, signDeclaration} = require("./arweave")
const client = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  bearer_token: process.env.BEARER_TOKEN
})

app.get('/healthz', (req, res) => {
  res.send('ok')
})

app.get('/check/:handle/:address', (req, res) => {
  const { handle, address } = req.params
  checkIfVerified(handle, address).then(result => {
    if (result) {
      res.json({ verified: true, tx: result })
    } else {
      res.json({ verified: false })
    }
  })
})

// post: include name, address (from MM), handle
app.post('/sign/:declaration', (req, res) => {
  const declarationId = req.params.declaration
  const {
    name,
    address,
    handle,
  } = req.body

  // did the user include a handle?
  if (handle) {
    // verify if user is signed
    checkIfVerified(handle, address).then(result => {
      const verified = !!result
      signDeclaration(declarationId, address, name, handle, verified)
        .then(res.json)
        .catch(e => res.status(500).send(e))
    })
  } else {
    // pure metamask sig
    signDeclaration(declarationId, address, name, '', false)
      .then(res.json)
      .catch(e => res.status(500).send(e))
  }
})

// post: include address (from MM)
app.post('/verify/:handle', (req, res) => {
  const handle = req.params.handle
  const {
    address,
  } = req.body

  client.get('statuses/user_timeline', {
    screen_name: handle,
    include_rts: false,
    count: 5,
  }, (error, tweets, response) => {
    if (!error) {
      for (const tweet of tweets) {
        const parsedAddress = tweet.text.slice(TWEET_TEMPLATE.length)
        if (tweet.text.startsWith(TWEET_TEMPLATE) && (parsedAddress === address)) {
          // check to see if already linked
          checkIfVerified(handle, address)
            .then(result => {
              if (result) {
                // already linked
                res.json({ tx: result })
              } else {
                // need to link
                persistVerification(handle, address)
                  .then((tx) => res.status(201).json(tx))
                  .catch(e => res.status(500).send(e))
              }
            })
          return
        }
      }
      res.status(404).send('no matching tweets found')
    } else {
      res.status(400).send(error)
    }
  })
})

app.listen(port, () => {
  console.log(`server started on :${port}`)
})