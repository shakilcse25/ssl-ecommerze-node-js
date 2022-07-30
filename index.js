const express = require('express');
const app = express();
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const stripe = require('stripe')('sk_test_51LR3w4CVze8v9k3H3RvO8zPKCZu6CKnyvvAvvqMeRCX02xBr8SBMBPw0Snjr1ZrqnVENCSjU2gVDfXVmiSfEEsjE00eO51pNdU');

app.get('/', (req, res) => {
  res
    .status(200)
    .send('Hello server is running')
    .end();
});
 
// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

app.get("/test", (req, res, next) => {
 res.json(["Tony","Lisa","Michael","Ginger","Food"]);
});

app.post('/api/doPayment/', (req, res) => {
  return stripe.charges
    .create({
      amount: req.body.amount, // Unit: cents
      currency: 'usd',
      source: req.body.tokenId,
      description: 'Test payment',
    })
    .then(result => res.status(200).json(result));
});

app.listen(5000);

